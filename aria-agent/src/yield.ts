import { type Address, parseAbi } from 'viem';
import { publicClient } from './config';
import { getLiquidityScore } from './liquidity';

export interface Opportunity {
  protocol: string;
  poolAddress: Address;
  tokenIn: Address;
  tokenOut: Address;
  apyBps: number;        // APY in basis points (e.g. 850 = 8.50%)
  liquidityScore: number; // [0, 1]
}

// Lendle LendingPool — mainnet only; APY reads fall back gracefully on testnet
const LENDLE_POOL: Address = '0x401eCb1D350407f13ba348573E5630B83638E30D';

const USDY_ADDRESS = (process.env.MANTLE_NETWORK === 'testnet'
  ? process.env.VITE_USDY_ADDRESS_TESTNET
  : process.env.VITE_USDY_ADDRESS_MAINNET) as Address;

const METH_ADDRESS = (process.env.MANTLE_NETWORK === 'testnet'
  ? process.env.VITE_METH_ADDRESS_TESTNET
  : process.env.VITE_METH_ADDRESS_MAINNET) as Address;

// Only verified on-chain pools. Fallback APYs used when the live read fails.
// TODO: Add FusionX pools once V3 pool addresses are confirmed on Mantle explorer
// TODO: Add Agni Finance pools once LP addresses are confirmed
// TODO: Add Cleopatra pools once deployment is live on Mantle mainnet
const POOLS: Array<{
  protocol: string;
  poolAddress: Address;
  tokenIn: Address;
  tokenOut: Address;
  apyFallbackBps: number;
}> = [
  {
    protocol: 'Lendle USDY',
    poolAddress: LENDLE_POOL,
    tokenIn:  USDY_ADDRESS,
    tokenOut: USDY_ADDRESS,
    apyFallbackBps: 620,
  },
  {
    protocol: 'Lendle mETH',
    poolAddress: LENDLE_POOL,
    tokenIn:  METH_ADDRESS,
    tokenOut: METH_ADDRESS,
    apyFallbackBps: 480,
  },
];

// Aave V2 LendingPool ABI — Lendle is an Aave V2 fork on Mantle.
// currentLiquidityRate is the supply APY expressed in ray (1e27 = 100%).
const LENDLE_ABI = parseAbi([
  'function getReserveData(address asset) external view returns ((uint256 data) configuration, uint128 liquidityIndex, uint128 variableBorrowIndex, uint128 currentLiquidityRate, uint128 currentVariableBorrowRate, uint128 currentStableBorrowRate, uint40 lastUpdateTimestamp, address aTokenAddress, address stableDebtTokenAddress, address variableDebtTokenAddress, address interestRateStrategyAddress, uint8 id)',
]);

async function fetchApyBps(pool: (typeof POOLS)[number]): Promise<number> {
  try {
    const data = await publicClient.readContract({
      address: pool.poolAddress,
      abi: LENDLE_ABI,
      functionName: 'getReserveData',
      args: [pool.tokenIn],
    });
    // Return tuple: [configuration, liquidityIndex, variableBorrowIndex, currentLiquidityRate, ...]
    // currentLiquidityRate is at index 3, expressed in ray (1e27 = 100% = 10 000 bps)
    const currentLiquidityRate = data[3] as bigint;
    const apyBps = Math.round(Number(currentLiquidityRate) / 1e23);
    return apyBps > 0 ? apyBps : pool.apyFallbackBps;
  } catch {
    return pool.apyFallbackBps;
  }
}

export async function getYieldOpportunities(): Promise<Opportunity[]> {
  const results = await Promise.all(
    POOLS.map(async (pool) => {
      const [apyBps, liquidityScore] = await Promise.all([
        fetchApyBps(pool),
        getLiquidityScore(pool.poolAddress),
      ]);
      return {
        protocol:      pool.protocol,
        poolAddress:   pool.poolAddress,
        tokenIn:       pool.tokenIn,
        tokenOut:      pool.tokenOut,
        apyBps,
        liquidityScore,
      };
    })
  );
  return results;
}
