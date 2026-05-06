import { type Address, parseAbi } from 'viem';
import { publicClient } from './config';

// ERC20 totalSupply is available on all pool tokens regardless of DEX type
const ERC20_ABI = parseAbi([
  'function totalSupply() external view returns (uint256)',
]);

const SAMPLE_BLOCKS = 5;
const BLOCK_STEP    = 2n;

/**
 * Returns a liquidity stability score in [0, 1].
 * Samples totalSupply() across SAMPLE_BLOCKS evenly-spaced blocks and computes
 * 1 - (stddev / mean). Stable supply → score near 1. Returns 0.5 on any error
 * so a single unreachable pool never blocks all reallocation decisions.
 */
export async function getLiquidityScore(poolAddress: Address): Promise<number> {
  try {
    const latest = await publicClient.getBlockNumber();

    const samples: bigint[] = [];
    for (let i = 0; i < SAMPLE_BLOCKS; i++) {
      const blockNumber = latest - BigInt(i) * BLOCK_STEP;
      const supply = await publicClient.readContract({
        address: poolAddress,
        abi: ERC20_ABI,
        functionName: 'totalSupply',
        blockNumber,
      });
      samples.push(supply);
    }

    const nums = samples.map((s) => Number(s));
    const mean = nums.reduce((a, b) => a + b, 0) / nums.length;
    if (mean === 0) return 0;

    const variance = nums.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / nums.length;
    const stddev   = Math.sqrt(variance);
    const cv       = stddev / mean; // coefficient of variation

    return Math.max(0, 1 - cv);
  } catch {
    return 0.5; // neutral — don't punish pools that are hard to read
  }
}
