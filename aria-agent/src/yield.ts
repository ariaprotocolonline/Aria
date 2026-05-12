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

const ZERO = '0x0000000000000000000000000000000000000000';

const WETH_ADDRESS = (
  process.env.MANTLE_NETWORK === 'testnet' &&
  process.env.VITE_WETH_ADDRESS_TESTNET &&
  process.env.VITE_WETH_ADDRESS_TESTNET !== ZERO
    ? process.env.VITE_WETH_ADDRESS_TESTNET
    : '0xdEAddEaDdeadDEadDEADDEaDDeaDDeAD00000000'
) as Address;

const USDC_ADDRESS = (
  process.env.MANTLE_NETWORK === 'testnet' &&
  process.env.VITE_USDC_ADDRESS_TESTNET &&
  process.env.VITE_USDC_ADDRESS_TESTNET !== ZERO
    ? process.env.VITE_USDC_ADDRESS_TESTNET
    : '0x09bc4e0d864854c6afb6eb9a9cdf58ac190d0df9'
) as Address;

const WMNT_ADDRESS = '0x78c1b0C915c4FAA5FffA6CAbf0219DA63d7f4cb' as Address;

const POOLS: Array<{
  protocol: string;
  poolAddress: Address;
  tokenIn: Address;
  tokenOut: Address;
  apyFallbackBps: number;
}> = [
  {
    protocol: 'Agni Finance WETH/USDT',
    poolAddress: '0x628f7131cf43e88ebe3921ae78c4ba0c31872bd4' as Address,
    tokenIn:  WETH_ADDRESS,
    tokenOut: USDC_ADDRESS,
    apyFallbackBps: 820,
  },
  {
    protocol: 'Agni Finance WETH/WMNT',
    poolAddress: '0x585ec64f06afa80e474bb6574ef7be38a8ef94a7' as Address,
    tokenIn:  WETH_ADDRESS,
    tokenOut: WMNT_ADDRESS,
    apyFallbackBps: 950,
  },
  {
    protocol: 'FusionX WETH/USDT',
    poolAddress: '0xbe18aad013699c1cdd903cb3e6d596ef99c37650' as Address,
    tokenIn:  WETH_ADDRESS,
    tokenOut: USDC_ADDRESS,
    apyFallbackBps: 780,
  },
  {
    protocol: 'Agni Finance USDC/USDT',
    poolAddress: '0x16867d00d45347a2ded25b8cdb7022b3171d4ae0' as Address,
    tokenIn:  USDC_ADDRESS,
    tokenOut: USDC_ADDRESS,
    apyFallbackBps: 420,
  },
  {
    protocol: 'FusionX USDC/USDT',
    poolAddress: '0x6488f911c6cd86c289aa319c5a826dcf8f1ca065' as Address,
    tokenIn:  USDC_ADDRESS,
    tokenOut: USDC_ADDRESS,
    apyFallbackBps: 380,
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
