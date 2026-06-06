import { type Address, parseAbi } from 'viem';
import { publicClient } from './config';
import { getNansenPoolIntel } from './nansen';

// Agni Finance and FusionX are UniV3 forks — their pool contracts expose liquidity()
// but do NOT implement ERC20 totalSupply(). Calling totalSupply() would revert on
// every pool, causing the catch block to return 0 and permanently blocking reallocation.
const UNIV3_POOL_ABI = parseAbi([
  'function liquidity() external view returns (uint128)',
]);

const SAMPLE_BLOCKS = 5;
const BLOCK_STEP    = 2n;

/**
 * Returns a liquidity stability score in [0, 1].
 * Samples liquidity() across SAMPLE_BLOCKS evenly-spaced blocks and computes
 * 1 - (stddev / mean). Stable liquidity → score near 1.
 * Nansen riskAdjustment is applied on top when available:
 *   - High mercenary capital ratio → multiplier < 1 (pool is riskier)
 *   - Strong smart money inflow   → multiplier > 1 (up to 1.2)
 * Returns 0 on any error so an unreachable pool is excluded from decisions.
 */
export async function getLiquidityScore(poolAddress: Address): Promise<number> {
  let baseScore = 0;
  const RPC_TIMEOUT_MS = 10_000;

  try {
    const latest = await Promise.race([
      publicClient.getBlockNumber(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('getBlockNumber timeout')), RPC_TIMEOUT_MS)
      ),
    ]);

    const blockNumbers = Array.from(
      { length: SAMPLE_BLOCKS },
      (_, i) => latest - BigInt(i) * BLOCK_STEP
    );

    // Fetch all samples in parallel — 5x faster than sequential awaits.
    // Each individual read races against a 10s timeout; any failure returns neutral 0.5.
    const samples = await Promise.all(
      blockNumbers.map((blockNumber) =>
        Promise.race([
          publicClient.readContract({
            address: poolAddress,
            abi: UNIV3_POOL_ABI,
            functionName: 'liquidity',
            blockNumber,
          }),
          new Promise<bigint>((_, reject) =>
            setTimeout(() => reject(new Error('readContract timeout')), RPC_TIMEOUT_MS)
          ),
        ])
      )
    );

    // Normalise relative to the first sample before converting to Number.
    const base = samples[0] ?? 1n;
    if (base === 0n) return 0;

    const SCALE = 1_000_000n;
    const nums  = samples.map((s) => Number((s * SCALE) / base));

    const mean = nums.reduce((a, b) => a + b, 0) / nums.length;
    if (mean === 0) return 0;

    const variance = nums.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / nums.length;
    const stddev   = Math.sqrt(variance);
    const cv       = stddev / mean;

    baseScore = Math.max(0, 1 - cv);
  } catch {
    return 0; // treat unreadable pools as having no liquidity — fail safe
  }

  // Enhance with Nansen smart money intelligence when available.
  try {
    const intel = await getNansenPoolIntel(poolAddress);
    if (intel) {
      const adjusted = Math.max(0, Math.min(1, baseScore * intel.riskAdjustment));
      console.log(
        `[Nansen] ${poolAddress.slice(0, 8)}… ` +
        `base=${baseScore.toFixed(3)} × adj=${intel.riskAdjustment.toFixed(2)} ` +
        `= ${adjusted.toFixed(3)} (mercenary=${intel.mercenaryCapitalRatio.toFixed(2)})`
      );
      return adjusted;
    }
  } catch {
    // Nansen unavailable — fall through to base score
  }

  return baseScore;
}
