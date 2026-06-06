import { useCallback, useState } from 'react';
import { useReadContract, useWriteContract, useChainId } from 'wagmi';
import { readContract } from '@wagmi/core';
import { waitForTransactionReceipt } from '@wagmi/core';
import { erc20Abi, type Address, zeroAddress } from 'viem';
import { useConfig } from 'wagmi';
import ARIA_ABI from '../contracts/ARIAVault.abi.json';
import { VAULT_ADDRESS, TOKEN_ADDRESSES, type SupportedToken } from '../contracts/addresses';
import { useVaultFactory } from './useVaultFactory';

function useVaultAddress(): Address {
  const { userVaultAddress } = useVaultFactory();
  const chainId = useChainId();

  if (userVaultAddress && userVaultAddress !== zeroAddress) {
    return userVaultAddress;
  }

  return (VAULT_ADDRESS[chainId] ?? zeroAddress) as Address;
}

function useTokenAddress(symbol: SupportedToken): Address {
  const chainId = useChainId();
  return (TOKEN_ADDRESSES[chainId]?.[symbol] ?? zeroAddress) as Address;
}

export function useVaultBalance(token: SupportedToken, _vaultOverride?: Address) {
  const vaultAddr = useVaultAddress();
  const tokenAddr = useTokenAddress(token);
  const isDeployed = vaultAddr !== zeroAddress && tokenAddr !== zeroAddress;

  return useReadContract({
    address: vaultAddr,
    abi: ARIA_ABI,
    functionName: 'getBalance',
    args: [tokenAddr],
    query: { enabled: isDeployed, refetchInterval: 15_000 },
  });
}

export function useVaultPaused(_vaultOverride?: Address) {
  const vaultAddr = useVaultAddress();
  const isDeployed = vaultAddr !== zeroAddress;

  return useReadContract({
    address: vaultAddr,
    abi: ARIA_ABI,
    functionName: 'paused',
    query: { enabled: isDeployed, refetchInterval: 15_000 },
  });
}

export function useVaultAgent(_vaultOverride?: Address) {
  const vaultAddr = useVaultAddress();
  const isDeployed = vaultAddr !== zeroAddress;

  return useReadContract({
    address: vaultAddr,
    abi: ARIA_ABI,
    functionName: 'agent',
    query: { enabled: isDeployed, refetchInterval: 15_000 },
  });
}

export function useDeposit(_vaultOverride?: Address) {
  const config = useConfig();
  const vaultAddr = useVaultAddress();
  const { writeContractAsync, isPending, error } = useWriteContract();

  const approveAndDeposit = useCallback(
    async (_tokenSymbol: SupportedToken, tokenAddr: Address, amount: bigint) => {
      // Step 1: approve vault to spend tokens
      const approveTx = await writeContractAsync({
        address: tokenAddr,
        abi: erc20Abi,
        functionName: 'approve',
        args: [vaultAddr, amount],
        gas: BigInt(100_000),
      });

      await waitForTransactionReceipt(config, { hash: approveTx });

      // Step 2: deposit into vault
      const depositTx = await writeContractAsync({
        address: vaultAddr,
        abi: ARIA_ABI,
        functionName: 'deposit',
        args: [tokenAddr, amount],
        gas: BigInt(150_000),
      });

      return waitForTransactionReceipt(config, { hash: depositTx });
    },
    [config, vaultAddr, writeContractAsync]
  );

  return { approveAndDeposit, isPending, error };
}

export function useWithdraw(_vaultOverride?: Address) {
  const config = useConfig();
  const vaultAddr = useVaultAddress();
  const { writeContractAsync, isPending, error } = useWriteContract();

  const withdraw = useCallback(
    async (tokenAddr: Address, amount: bigint) => {
      const hash = await writeContractAsync({
        address: vaultAddr,
        abi: ARIA_ABI,
        functionName: 'withdraw',
        args: [tokenAddr, amount],
        gas: BigInt(150_000),
      });
      return waitForTransactionReceipt(config, { hash });
    },
    [config, vaultAddr, writeContractAsync]
  );

  return { withdraw, isPending, error };
}

// Uniswap V3 exactInputSingle selector — valid for Agni, FusionX, and any UniV3 fork.
const EXACT_INPUT_SINGLE_SELECTOR = '0x414bf389' as `0x${string}`;

export function useAddCustomAsset() {
  const config = useConfig();
  const vaultAddr = useVaultAddress();
  const { writeContractAsync } = useWriteContract();
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const addCustomAsset = useCallback(
    async (tokenAddr: Address, routerAddr: Address) => {
      setIsPending(true);
      setError(null);
      try {
        // Read approval state first — avoid reverting on "already approved"
        const [tokenApproved, protocolApproved] = await Promise.all([
          readContract(config, { address: vaultAddr, abi: ARIA_ABI, functionName: 'approvedTokens', args: [tokenAddr] }) as Promise<boolean>,
          readContract(config, { address: vaultAddr, abi: ARIA_ABI, functionName: 'approvedProtocols', args: [routerAddr] }) as Promise<boolean>,
        ]);

        if (!tokenApproved) {
          const tx = await writeContractAsync({ address: vaultAddr, abi: ARIA_ABI, functionName: 'addApprovedToken', args: [tokenAddr], gas: BigInt(120_000) });
          await waitForTransactionReceipt(config, { hash: tx });
        }
        if (!protocolApproved) {
          const tx = await writeContractAsync({ address: vaultAddr, abi: ARIA_ABI, functionName: 'addApprovedProtocol', args: [routerAddr], gas: BigInt(120_000) });
          await waitForTransactionReceipt(config, { hash: tx });
        }
        // addApprovedSelector is idempotent (sets mapping to true, no revert if already set)
        const tx = await writeContractAsync({ address: vaultAddr, abi: ARIA_ABI, functionName: 'addApprovedSelector', args: [routerAddr, EXACT_INPUT_SINGLE_SELECTOR], gas: BigInt(120_000) });
        await waitForTransactionReceipt(config, { hash: tx });
      } catch (e) {
        setError(e as Error);
        throw e;
      } finally {
        setIsPending(false);
      }
    },
    [config, vaultAddr, writeContractAsync]
  );

  return { addCustomAsset, isPending, error };
}

export function useTokenBalance(tokenSymbol: SupportedToken, owner: Address | undefined) {
  const tokenAddr = useTokenAddress(tokenSymbol);
  const isReady = !!owner && tokenAddr !== zeroAddress;

  return useReadContract({
    address: tokenAddr,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: owner ? [owner] : undefined,
    query: { enabled: isReady, refetchInterval: 15_000 },
  });
}
