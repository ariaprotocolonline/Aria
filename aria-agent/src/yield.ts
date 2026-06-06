import { type Address, parseAbi } from 'viem';
import { publicClient } from './config';
import { getLiquidityScore } from './liquidity';
import { loadUserPools } from './feedServer';

export interface Opportunity {
  protocol: string;
  poolAddress: Address;    // UniV3 pool — used for APY/liquidity data reads only
  routerAddress: Address;  // DEX router — used for swap execution via exactInputSingle
  tokenIn: Address;
  tokenOut: Address;
  feeTier: number;         // UniV3 fee tier (e.g. 500 = 0.05%, 3000 = 0.3%) — MUST match pool
  apyBps: number;          // APY in basis points (e.g. 850 = 8.50%)
  liquidityScore: number;  // [0, 1]
}

const ZERO = '0x0000000000000000000000000000000000000000';

export const WETH_ADDRESS = (
  process.env.MANTLE_NETWORK === 'testnet' &&
  process.env.VITE_WETH_ADDRESS_TESTNET &&
  process.env.VITE_WETH_ADDRESS_TESTNET !== ZERO
    ? process.env.VITE_WETH_ADDRESS_TESTNET
    : '0xdeaddeaddeaddeaddeaddeaddeaddeaddead1111'
) as Address;

export const USDC_ADDRESS = (
  process.env.MANTLE_NETWORK === 'testnet' &&
  process.env.VITE_USDC_ADDRESS_TESTNET &&
  process.env.VITE_USDC_ADDRESS_TESTNET !== ZERO
    ? process.env.VITE_USDC_ADDRESS_TESTNET
    : '0x09bc4e0d864854c6afb6eb9a9cdf58ac190d0df9'
) as Address;

const WMNT_ADDRESS = (
  process.env.MANTLE_NETWORK === 'testnet' &&
  process.env.WMNT_ADDRESS_TESTNET &&
  process.env.WMNT_ADDRESS_TESTNET !== ZERO
    ? process.env.WMNT_ADDRESS_TESTNET
    : '0x78c1b0C915c4FAA5FffA6CAbf0219DA63d7f4cb8'
) as Address;

// DEX routers — exactInputSingle lives on the router, not the pool.
// These must match what is whitelisted in the vault's approvedProtocols + approvedSelectors.
const AGNI_ROUTER    = (process.env.AGNI_ROUTER_ADDRESS    ?? '0x319B69888b0d11cEC22caA5034e25FfFBDc88421') as Address;
const FUSIONX_ROUTER = (process.env.FUSIONX_ROUTER_ADDRESS ?? '0x5C6EC6E7F81120A2E7e15e61bE4F4fCcA05de596') as Address;

// ⚠️  VERIFY fee tiers on-chain before production: call pool.fee() on each address.
// Wrong fee tier causes exactInputSingle to revert, burning gas with no reallocation.
// UniV3 fee tiers: 100 (0.01%), 500 (0.05%), 3000 (0.3%), 10000 (1%).
const POOLS: Array<{
  protocol: string;
  poolAddress: Address;
  routerAddress: Address;
  tokenIn: Address;
  tokenOut: Address;
  feeTier: number;
  apyFallbackBps: number;
  live: boolean;
}> = [
  {
    protocol: 'Agni Finance WETH/USDC',
    poolAddress: '0x628f7131cf43e88ebe3921ae78c4ba0c31872bd4' as Address,
    routerAddress: AGNI_ROUTER,
    tokenIn:  WETH_ADDRESS,
    tokenOut: USDC_ADDRESS,
    feeTier:  500,
    apyFallbackBps: 820,
    live: true,
  },
  {
    protocol: 'Agni Finance WETH/WMNT',
    poolAddress: '0x585ec64f06afa80e474bb6574ef7be38a8ef94a7' as Address,
    routerAddress: AGNI_ROUTER,
    tokenIn:  WETH_ADDRESS,
    tokenOut: WMNT_ADDRESS,
    feeTier:  3000,
    apyFallbackBps: 950,
    live: true,
  },
  {
    protocol: 'FusionX WETH/USDC',
    poolAddress: '0xbe18aad013699c1cdd903cb3e6d596ef99c37650' as Address,
    routerAddress: FUSIONX_ROUTER,
    tokenIn:  WETH_ADDRESS,
    tokenOut: USDC_ADDRESS,
    feeTier:  500,
    apyFallbackBps: 780,
    live: true,
  },
  {
    // DISABLED: tokenIn === tokenOut — exactInputSingle(USDC→USDC) reverts at the
    // router level. Re-enable only after implementing a proper LP deposit path.
    protocol: 'Agni Finance USDC/USDT',
    poolAddress: '0x16867d00d45347a2ded25b8cdb7022b3171d4ae0' as Address,
    routerAddress: AGNI_ROUTER,
    tokenIn:  USDC_ADDRESS,
    tokenOut: USDC_ADDRESS,
    feeTier:  100,
    apyFallbackBps: 420,
    live: false,
  },
  {
    // DISABLED: tokenIn === tokenOut — see note above.
    protocol: 'FusionX USDC/USDT',
    poolAddress: '0x6488f911c6cd86c289aa319c5a826dcf8f1ca065' as Address,
    routerAddress: FUSIONX_ROUTER,
    tokenIn:  USDC_ADDRESS,
    tokenOut: USDC_ADDRESS,
    feeTier:  100,
    apyFallbackBps: 380,
    live: false,
  },
];

// ─── xStocks on Mantle mainnet ─────────────────────────────────────────────
// Tokenized US equities trading 24/7 via Fluxion DEX
// Backed 1:1 by underlying securities, compliant with Swiss DLT Act
// Partnership: Mantle x Bybit x BackedFi x Flowdesk — live April 10 2026
// Addresses verified on Mantlescan June 2026
// ─────────────────────────────────────────────────────────────────────────────

export const XSTOCK_ADDRESSES: Record<string, Address> = {
  TSLAx:  '0x8ad3c73f833d3f9a523ab01476625f269aeb7cf0' as Address, // Tesla Inc
  NVDAx:  '0xc845b2894dbddd03858fd2d643b4ef725fe0849d' as Address, // Nvidia Corporation
  AAPLx:  '0x9d275685dc284c8eb1c79f6aba7a63dc75ec890a' as Address, // Apple Inc
  METAx:  '0x96702be57cd9777f835117a809c7124fe4ec989a' as Address, // Meta Platforms
  GOOGLx: '0xe92f673ca36c5e2efd2de7628f815f84807e803f' as Address, // Alphabet (Google)
  MSTRx:  '0xae2f842ef90c0d5213259ab82639d5bbf649b08e' as Address, // MicroStrategy
  HOODx:  '0xe1385fdd5ffb10081cd52c56584f25efa9084015' as Address, // Robinhood Markets
  SPYx:   '0x90a2a4c76b5d8c0bc892a69ea28aa775a8f2dd48' as Address, // S&P 500 ETF
  QQQx:   '0xa753a7395cae905cd615da0b82a53e0560f250af' as Address, // Nasdaq-100 ETF
  CRCLx:  '0xfebded1b0986a8ee107f5ab1a1c5a813491deceb' as Address, // Circle (tokenized equity)
};

export const XSTOCK_LABELS: Record<string, string> = {
  TSLAx:  'Tesla Inc',
  NVDAx:  'Nvidia Corporation',
  AAPLx:  'Apple Inc',
  METAx:  'Meta Platforms',
  GOOGLx: 'Alphabet (Google)',
  MSTRx:  'MicroStrategy',
  HOODx:  'Robinhood Markets',
  SPYx:   'S&P 500 ETF',
  QQQx:   'Nasdaq-100 ETF',
  CRCLx:  'Circle',
};

export const XSTOCKS_ENABLED = process.env.XSTOCKS_ENABLED === 'true';

// ─── UniV3 pool ABI — Agni Finance and FusionX are both UniV3 forks on Mantle ─

const UNIV3_POOL_ABI = parseAbi([
  'function liquidity() external view returns (uint128)',
]);

const RPC_TIMEOUT_MS = 10_000;

async function fetchApyBps(pool: (typeof POOLS)[number]): Promise<number> {
  try {
    const liquidityRaw = await Promise.race([
      publicClient.readContract({
        address: pool.poolAddress,
        abi: UNIV3_POOL_ABI,
        functionName: 'liquidity',
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('RPC timeout')), RPC_TIMEOUT_MS)
      ),
    ]);

    // Pool with zero liquidity is inactive — return 0 so it is excluded.
    if (liquidityRaw === 0n) return 0;

    // Pool is active. True APY requires off-chain volume history.
    // apyFallbackBps values are calibrated estimates — clearly marked as such.
    return pool.apyFallbackBps;
  } catch (err) {
    console.warn(`[yield] fetchApyBps fallback for ${pool.protocol}: ${err instanceof Error ? err.message : err}`);
    return pool.apyFallbackBps;
  }
}

export async function getYieldOpportunities(): Promise<Opportunity[]> {
  // Merge built-in live pools with user-defined custom pools
  const userPools = loadUserPools().map(u => ({
    protocol:       u.protocol,
    poolAddress:    u.poolAddress as Address,
    routerAddress:  u.routerAddress as Address,
    tokenIn:        u.tokenInAddress as Address,
    tokenOut:       u.tokenAddress as Address,
    feeTier:        u.feeTier,
    apyFallbackBps: u.apyBps,
    live:           true,
  }));

  const allPools = [...POOLS.filter(p => p.live), ...userPools];

  const results = await Promise.all(
    allPools.map(async (pool) => {
      const [apyBps, liquidityScore] = await Promise.all([
        fetchApyBps(pool),
        getLiquidityScore(pool.poolAddress),
      ]);
      return {
        protocol:      pool.protocol,
        poolAddress:   pool.poolAddress,
        routerAddress: pool.routerAddress,
        tokenIn:       pool.tokenIn,
        tokenOut:      pool.tokenOut,
        feeTier:       pool.feeTier,
        apyBps,
        liquidityScore,
      };
    })
  );
  return results;
}
