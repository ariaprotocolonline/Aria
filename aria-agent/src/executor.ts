import { type Address, encodeFunctionData, parseAbi } from 'viem';
import { walletClient, publicClient, VAULT_ADDRESS } from './config';
import { type ReallocationDecision } from './agent';

const VAULT_ABI = parseAbi([
  'function reallocate(address tokenIn, address tokenOut, address protocol, uint256 amount, uint256 expectedApyBps, uint256 newApyBps, bytes calldata data) external',
  'function approvedProtocols(address) external view returns (bool)',
  'function getBalance(address token) external view returns (uint256)',
]);

export interface ExecutionResult {
  txHash: `0x${string}`;
  amountIn: bigint;
  tokenIn: Address;
  tokenOut: Address;
  protocol: Address;
}

export async function executeReallocation(
  decision: ReallocationDecision
): Promise<ExecutionResult> {
  if (!decision.shouldReallocate || !decision.opportunity) {
    throw new Error('executeReallocation called on a no-op decision');
  }

  const { opportunity, amount } = decision;
  const protocol = opportunity.poolAddress;

  // Verify protocol is whitelisted before sending tx
  const isApproved = await publicClient.readContract({
    address: VAULT_ADDRESS,
    abi: VAULT_ABI,
    functionName: 'approvedProtocols',
    args: [protocol],
  });

  if (!isApproved) {
    throw new Error(`Protocol ${protocol} is not approved on vault — add it first`);
  }

  // Build protocol-specific calldata.
  // This is a generic swap selector (e.g. UniswapV2-style).
  // Replace with the actual protocol ABI once known.
  const swapData = encodeFunctionData({
    abi: parseAbi([
      'function swap(address tokenIn, address tokenOut, uint256 amountIn, address recipient) external returns (uint256)',
    ]),
    functionName: 'swap',
    args: [opportunity.tokenIn, opportunity.tokenOut, amount, VAULT_ADDRESS],
  });

  const txHash = await walletClient.writeContract({
    address: VAULT_ADDRESS,
    abi: VAULT_ABI,
    functionName: 'reallocate',
    args: [
      opportunity.tokenIn,
      opportunity.tokenOut,
      protocol,
      amount,
      BigInt(decision.currentApyBps),
      BigInt(opportunity.apyBps),
      swapData,
    ],
  });

  await publicClient.waitForTransactionReceipt({ hash: txHash });

  return {
    txHash,
    amountIn: amount,
    tokenIn: opportunity.tokenIn,
    tokenOut: opportunity.tokenOut,
    protocol,
  };
}
