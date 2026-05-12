import { formatUnits } from 'viem';
import { useAccount, useBalance, useChainId, useReadContract } from 'wagmi';
import { erc20Abi, zeroAddress } from 'viem';
import { VAULT_ADDRESS, TOKEN_ADDRESSES } from '../contracts/addresses';
import { useVaultBalance } from './useARIAVault';
import { RiskProfile } from '../services/claude';

export interface PortfolioData {
  address: `0x${string}` | undefined;
  chainId: number;
  vaultDeployed: boolean;
  wethDisplay: number;
  usdcDisplay: number;
  nativeDisplay: number;
  nativeSymbol: string;
  nativeLoading: boolean;
  totalUsd: number;
  toContextString: () => string;
}

export function usePortfolioData(): PortfolioData {
  const { address } = useAccount();
  const chainId = useChainId();

  const _vaultAddr = VAULT_ADDRESS[chainId];
  const vaultDeployed = _vaultAddr !== undefined && _vaultAddr !== zeroAddress;

  const { data: wethVaultBalance } = useVaultBalance('WETH');
  const { data: usdcVaultBalance } = useVaultBalance('USDC');

  const wethAddr = TOKEN_ADDRESSES[chainId]?.WETH;
  const usdcAddr = TOKEN_ADDRESSES[chainId]?.USDC;
  const tokensDeployed = !!wethAddr && wethAddr !== zeroAddress;

  const { data: wethWalletRaw } = useReadContract({
    address: wethAddr as `0x${string}`,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!address && tokensDeployed, refetchInterval: 30_000 },
  });

  const { data: usdcWalletRaw } = useReadContract({
    address: usdcAddr as `0x${string}`,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!address && tokensDeployed, refetchInterval: 30_000 },
  });

  const { data: nativeBalance, isLoading: nativeLoading } = useBalance({
    address,
    query: { refetchInterval: 15_000 },
  });

  const toFloat = (raw: unknown) =>
    raw !== undefined ? parseFloat(formatUnits(raw as bigint, 18)) : 0;

  const wethDisplay = vaultDeployed ? toFloat(wethVaultBalance) : toFloat(wethWalletRaw);
  const usdcDisplay = vaultDeployed ? toFloat(usdcVaultBalance) : toFloat(usdcWalletRaw);
  const nativeDisplay = nativeBalance ? parseFloat(nativeBalance.formatted) : 0;
  const nativeSymbol = nativeBalance?.symbol ?? 'MNT';
  const totalUsd = wethDisplay + usdcDisplay + (vaultDeployed ? 0 : nativeDisplay);

  const toContextString = (): string => {
    if (!address) return '';
    const chainName =
      chainId === 5000 ? 'Mantle Mainnet' :
      chainId === 5003 ? 'Mantle Sepolia Testnet' :
      `Chain ${chainId}`;
    const riskProfile = (localStorage.getItem('aria-risk-profile') as RiskProfile) || 'Balanced';
    const now = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });
    return [
      `[Live portfolio snapshot @ ${now}]`,
      `Wallet: ${address}`,
      `Network: ${chainName}`,
      `WETH: ${wethDisplay.toFixed(4)}${vaultDeployed ? ' (in vault)' : ' (wallet)'}`,
      `USDC: ${usdcDisplay.toFixed(4)}${vaultDeployed ? ' (in vault)' : ' (wallet)'}`,
      `${nativeSymbol}: ${nativeDisplay.toFixed(4)} (native gas token)`,
      `Total value: ~$${totalUsd.toFixed(2)}`,
      `Risk profile: ${riskProfile}`,
      `Vault status: ${vaultDeployed ? 'deployed and active' : 'not yet deployed (testnet mode — balances shown from wallet)'}`,
    ].join('\n');
  };

  return {
    address,
    chainId,
    vaultDeployed,
    wethDisplay,
    usdcDisplay,
    nativeDisplay,
    nativeSymbol,
    nativeLoading,
    totalUsd,
    toContextString,
  };
}
