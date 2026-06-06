import { useAccount, useReadContract, useWriteContract, useChainId } from 'wagmi';
import { waitForTransactionReceipt } from '@wagmi/core';
import { useConfig } from 'wagmi';
import { zeroAddress, type Address } from 'viem';
import { FACTORY_ADDRESS } from '../contracts/addresses';

const FACTORY_ABI = [
  {
    name: 'createVault',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [],
    outputs: [{ type: 'address' }],
  },
  {
    name: 'getVault',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'owner', type: 'address' }],
    outputs: [{ type: 'address' }],
  },
  {
    name: 'hasVault',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'owner', type: 'address' }],
    outputs: [{ type: 'bool' }],
  },
] as const;

export function useVaultFactory() {
  const { address } = useAccount();
  const chainId = useChainId();
  const config = useConfig();
  const factoryAddr = FACTORY_ADDRESS[chainId] as Address;
  const isFactoryDeployed = !!factoryAddr && factoryAddr !== zeroAddress;

  const { data: userVaultAddress, refetch: refetchVault } = useReadContract({
    address: factoryAddr,
    abi: FACTORY_ABI,
    functionName: 'getVault',
    args: address ? [address] : undefined,
    query: { enabled: isFactoryDeployed && !!address, refetchInterval: 30_000 },
  });

  const { data: hasVault } = useReadContract({
    address: factoryAddr,
    abi: FACTORY_ABI,
    functionName: 'hasVault',
    args: address ? [address] : undefined,
    query: { enabled: isFactoryDeployed && !!address, refetchInterval: 30_000 },
  });

  const { writeContractAsync, isPending } = useWriteContract();

  const createVault = async () => {
    const hash = await writeContractAsync({
      address: factoryAddr,
      abi: FACTORY_ABI,
      functionName: 'createVault',
      gas: BigInt(3_000_000),
    });
    await waitForTransactionReceipt(config, {
      hash,
      timeout: 60_000,
      confirmations: 1,
      pollingInterval: 2_000,
    });
    await refetchVault();
    return hash;
  };

  return {
    userVaultAddress: userVaultAddress as Address | undefined,
    hasVault: hasVault as boolean | undefined,
    createVault,
    isPending,
    factoryDeployed: isFactoryDeployed,
  };
}
