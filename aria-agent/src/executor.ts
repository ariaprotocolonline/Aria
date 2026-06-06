import { type Address, encodeFunctionData, parseAbi } from 'viem';
import { walletClient, publicClient } from './config';
import { type ReallocationDecision } from './agent';

// ── Slippage protection ──────────────────────────────────────────────────────
// Max acceptable slippage per risk profile (basis points).
const SLIPPAGE_BPS: Record<string, bigint> = {
  conservative: 30n,   // 0.3%
  moderate:     50n,   // 0.5%
  aggressive:   100n,  // 1.0%
};
const DEFAULT_SLIPPAGE_BPS = 50n;

// Token address → CoinGecko ID mapping for DefiLlama price API.
// Addresses must exactly match those in yield.ts and addresses.ts (lowercase).
const TOKEN_CG_ID: Record<string, string> = {
  // Mantle mainnet WETH — must match yield.ts WETH_ADDRESS lowercased
  '0xdeaddeaddeaddeaddeaddeaddeaddead00000000': 'coingecko:ethereum',
  // Mantle mainnet USDC (0x09bc...df9)
  '0x09bc4e0d864854c6afb6eb9a9cdf58ac190d0df9': 'coingecko:usd-coin',
  // Mantle mainnet mETH
  '0xcda86a272531e8640cd7f1a92c01839911b90bb0': 'coingecko:mantle-staked-ether',
  // Mantle mainnet WMNT
  '0x78c1b0c915c4faa5fffa6cabf0219da63d7f4cb8': 'coingecko:mantle',
};

// Token decimals — CRITICAL for cross-decimal slippage math (e.g. WETH=18, USDC=6).
// Wrong decimals cause minAmountOut to be orders of magnitude off, breaking every swap.
const TOKEN_DECIMALS: Record<string, number> = {
  '0xdeaddeaddeaddeaddeaddeaddeaddead00000000': 18, // WETH
  '0x09bc4e0d864854c6afb6eb9a9cdf58ac190d0df9': 6,  // USDC
  '0xcda86a272531e8640cd7f1a92c01839911b90bb0': 18, // mETH
  '0x78c1b0c915c4faa5fffa6cabf0219da63d7f4cb8': 18, // WMNT
};

async function fetchUsdPrice(tokenAddress: string): Promise<number | null> {
  const cgId = TOKEN_CG_ID[tokenAddress.toLowerCase()];
  if (!cgId) return null;
  try {
    const res = await fetch(
      `https://coins.llama.fi/prices/current/${cgId}`,
      { signal: AbortSignal.timeout(4_000) }
    );
    if (!res.ok) return null;
    const data = await res.json() as { coins: Record<string, { price: number }> };
    return data.coins[cgId]?.price ?? null;
  } catch {
    return null;
  }
}

async function computeMinAmountOut(
  tokenIn: string,
  tokenOut: string,
  amountIn: bigint,
  riskProfile?: string,
): Promise<bigint> {
  const slippageBps = SLIPPAGE_BPS[riskProfile ?? ''] ?? DEFAULT_SLIPPAGE_BPS;

  // Same-token: enforce tight slippage floor regardless of oracle
  if (tokenIn.toLowerCase() === tokenOut.toLowerCase()) {
    return (amountIn * (10_000n - slippageBps)) / 10_000n;
  }

  const inDecimals  = TOKEN_DECIMALS[tokenIn.toLowerCase()]  ?? 18;
  const outDecimals = TOKEN_DECIMALS[tokenOut.toLowerCase()] ?? 18;

  // Cross-token: fetch prices from DefiLlama and compute expected output
  const [priceIn, priceOut] = await Promise.all([
    fetchUsdPrice(tokenIn),
    fetchUsdPrice(tokenOut),
  ]);

  if (!priceIn || !priceOut || priceOut === 0) {
    console.warn(`[executor] Price oracle unavailable for ${tokenIn}/${tokenOut} — skipping cycle to avoid unprotected swap`);
    // Do not return a fake floor — throw so the cycle aborts rather than executing
    // a swap with no real slippage protection. Losing a cycle is better than a sandwich.
    throw new Error(`Price oracle unavailable for ${tokenIn}/${tokenOut} — aborting reallocation`);
  }

  // Convert amountIn to USD, then to tokenOut units — correctly handles decimal differences.
  // e.g. 1 WETH (1e18) at $3000 → 3000 USDC → 3000e6 (6 decimals)
  const amountInHuman = Number(amountIn) / 10 ** inDecimals;
  const expectedOutHuman = amountInHuman * (priceIn / priceOut);
  const expectedOut = BigInt(Math.floor(expectedOutHuman * 10 ** outDecimals));

  // Apply slippage floor
  return (expectedOut * (10_000n - slippageBps)) / 10_000n;
}

const VAULT_ABI = parseAbi([
  'function reallocate(address tokenIn, address tokenOut, address protocol, uint256 amount, uint256 expectedApyBps, uint256 newApyBps, uint256 minAmountOut, bytes calldata data) external',
  'function approvedProtocols(address) external view returns (bool)',
  'function getBalance(address token) external view returns (uint256)',
  'function performanceFeeBps() external view returns (uint256)',
]);

export interface ExecutionResult {
  txHash: `0x${string}`;
  amountIn: bigint;
  tokenIn: Address;
  tokenOut: Address;
  protocol: Address;
}

// M4: Per-vault pending tx tracking. If a tx for a given vault is still pending
// when the next cycle fires, skip that vault rather than submitting a duplicate.
// TX_EXPIRE_MS prevents permanent lock if a tx is dropped from the mempool.
const TX_EXPIRE_MS = 5 * 60 * 1000; // 5 minutes
const pendingTxMap = new Map<Address, { hash: `0x${string}`; submittedAt: number }>();

export async function executeReallocation(
  decision: ReallocationDecision,
  vaultAddress: Address,
): Promise<ExecutionResult> {
  if (!decision.shouldReallocate || !decision.opportunity) {
    throw new Error('executeReallocation called on a no-op decision');
  }

  // M4: If a prior tx for this vault is still pending, check its status before proceeding.
  const pending = pendingTxMap.get(vaultAddress);
  if (pending) {
    if (Date.now() - pending.submittedAt > TX_EXPIRE_MS) {
      console.warn(`[executor] Vault ${vaultAddress}: tx ${pending.hash} unconfirmed after 5min — clearing`);
      pendingTxMap.delete(vaultAddress);
    } else {
      try {
        const receipt = await publicClient.getTransactionReceipt({ hash: pending.hash });
        if (receipt.status === 'success' || receipt.status === 'reverted') {
          pendingTxMap.delete(vaultAddress);
        } else {
          throw new Error(`Vault ${vaultAddress}: tx ${pending.hash} is still pending — skipping cycle`);
        }
      } catch (err) {
        if (err instanceof Error && err.message.includes('skipping cycle')) throw err;
        throw new Error(`Vault ${vaultAddress}: tx ${pending.hash} is unconfirmed — skipping cycle`);
      }
    }
  }

  const { opportunity, amount } = decision;

  // routerAddress is the DEX swap router (not the pool).
  // The vault calls exactInputSingle on the router, which routes through the pool.
  const protocol = opportunity.routerAddress;

  // Verify the router is whitelisted and read performance fee in parallel.
  const [isApproved, performanceFeeBps] = await Promise.all([
    publicClient.readContract({
      address: vaultAddress,
      abi: VAULT_ABI,
      functionName: 'approvedProtocols',
      args: [protocol],
    }),
    publicClient.readContract({
      address: vaultAddress,
      abi: VAULT_ABI,
      functionName: 'performanceFeeBps',
    }),
  ]);

  if (!isApproved) {
    throw new Error(`Router ${protocol} is not approved on vault — add it via addApprovedProtocol`);
  }

  // Mirror the vault's _calcPerformanceFee() to compute the net amount the router
  // will actually receive. The vault approves netAmount to the router — if amountIn
  // in the calldata differs, the router reverts and no reallocation happens.
  const MAX_APY_DELTA_BPS = 5000n;
  const currentApyBps = BigInt(decision.currentApyBps);
  const newApyBps      = BigInt(opportunity.apyBps);
  let netAmount = amount;
  if (newApyBps > currentApyBps && performanceFeeBps > 0n) {
    const rawDelta    = newApyBps - currentApyBps;
    const cappedDelta = rawDelta > MAX_APY_DELTA_BPS ? MAX_APY_DELTA_BPS : rawDelta;
    const yieldDelta  = amount * cappedDelta / 10_000n;
    const perfFee     = yieldDelta * performanceFeeBps / 10_000n;
    netAmount = perfFee < amount ? amount - perfFee : 0n;
  }
  if (netAmount === 0n) {
    throw new Error('Net amount after performance fee is zero — skipping');
  }

  // Build Uniswap V3 exactInputSingle calldata.
  // The contract validates that this selector is whitelisted via approvedSelectors.
  // fee must match the pool's actual fee tier — wrong tier routes to a different pool or reverts.
  // Compute oracle-backed minimum output before building calldata.
  const minAmountOut = await computeMinAmountOut(
    opportunity.tokenIn,
    opportunity.tokenOut,
    netAmount,
    decision.riskProfile,
  );

  const swapData = encodeFunctionData({
    abi: parseAbi([
      'function exactInputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 deadline, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96)) external returns (uint256 amountOut)',
    ]),
    functionName: 'exactInputSingle',
    args: [{
      tokenIn:              opportunity.tokenIn,
      tokenOut:             opportunity.tokenOut,
      fee:                  opportunity.feeTier,
      recipient:            vaultAddress,
      deadline:             BigInt(Math.floor(Date.now() / 1000) + 300),
      amountIn:             netAmount,
      amountOutMinimum:     minAmountOut,
      sqrtPriceLimitX96:    0n,
    }],
  });

  // Pre-flight: check agent MNT balance — if below 0.01 MNT skip rather than
  // submit a tx that will fail on-chain and waste gas.
  const agentMntBalance = await publicClient.getBalance({ address: walletClient.account.address });
  const MIN_MNT = 10_000_000_000_000_000n; // 0.01 MNT in wei
  if (agentMntBalance < MIN_MNT) {
    throw new Error(
      `[CRITICAL] Agent MNT balance too low: ${agentMntBalance} wei — ` +
      `fund ${walletClient.account.address} with at least 0.01 MNT before next cycle`
    );
  }

  // M10: EIP-1559 gas estimation — never use legacy gasPrice on Mantle.
  // Do NOT catch estimation failures silently: estimation fails precisely when the tx
  // would revert (wrong fee tier, bad approval, insufficient balance). Proceeding with
  // a fallback gas limit would submit a tx that reverts and burns MNT for nothing.
  const [feeData, gasEstimate] = await Promise.all([
    publicClient.estimateFeesPerGas(),
    publicClient.estimateContractGas({
      address: vaultAddress,
      abi: VAULT_ABI,
      functionName: 'reallocate',
      args: [
        opportunity.tokenIn,
        opportunity.tokenOut,
        protocol,
        amount,
        BigInt(decision.currentApyBps),
        BigInt(opportunity.apyBps),
        minAmountOut,
        swapData,
      ],
    }),
  ]);

  // Gas price sanity check — Mantle is cheap but spike protection matters.
  const MAX_GAS_PRICE_GWEI = 200n * 1_000_000_000n; // 200 gwei
  const effectiveGasPrice = feeData.maxFeePerGas ?? 0n;
  if (effectiveGasPrice > MAX_GAS_PRICE_GWEI) {
    throw new Error(
      `Gas price ${effectiveGasPrice / 1_000_000_000n} gwei exceeds 200 gwei ceiling — ` +
      `skipping cycle to avoid overpaying`
    );
  }

  const txHash = await walletClient.writeContract({
    address: vaultAddress,
    abi: VAULT_ABI,
    functionName: 'reallocate',
    args: [
      opportunity.tokenIn,
      opportunity.tokenOut,
      protocol,
      amount,
      BigInt(decision.currentApyBps),
      BigInt(opportunity.apyBps),
      minAmountOut,
      swapData,
    ],
    gas:                  (gasEstimate * 12n) / 10n, // 20% buffer
    maxFeePerGas:         feeData.maxFeePerGas         ?? undefined,
    maxPriorityFeePerGas: feeData.maxPriorityFeePerGas ?? undefined,
  });

  // M4: Mark this vault's tx as pending so the next cycle knows to wait.
  pendingTxMap.set(vaultAddress, { hash: txHash, submittedAt: Date.now() });

  try {
    // Wait for 2 confirmations before considering final — reduces reorganisation risk.
    const receipt = await publicClient.waitForTransactionReceipt({
      hash:             txHash,
      confirmations:    2,
      timeout:          120_000,
    });

    // A reverted tx still produces a receipt — check status explicitly so the caller
    // doesn't record a failed reallocation as successful in agent memory.
    if (receipt.status === 'reverted') {
      throw new Error(`Transaction ${txHash} reverted on-chain`);
    }
  } finally {
    // Always clear this vault's pending state — whether the tx succeeded, reverted, or timed out.
    pendingTxMap.delete(vaultAddress);
  }

  return {
    txHash,
    amountIn: amount,
    tokenIn: opportunity.tokenIn,
    tokenOut: opportunity.tokenOut,
    protocol,
  };
}
