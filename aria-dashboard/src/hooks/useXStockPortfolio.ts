import { useEffect, useState } from 'react';
import { useReadContracts, useChainId } from 'wagmi';
import { type Address, zeroAddress, parseAbi } from 'viem';
import { VAULT_ADDRESS, MANTLE_MAINNET_ID } from '../contracts/addresses';
import { useVaultFactory } from './useVaultFactory';

// Verified xStock addresses on Mantle mainnet — confirmed on Mantlescan June 2026
const XSTOCKS = [
  { symbol: 'TSLAx',  label: 'Tesla Inc',          address: '0x8ad3c73f833d3f9a523ab01476625f269aeb7cf0' as Address },
  { symbol: 'NVDAx',  label: 'Nvidia Corporation', address: '0xc845b2894dbddd03858fd2d643b4ef725fe0849d' as Address },
  { symbol: 'AAPLx',  label: 'Apple Inc',          address: '0x9d275685dc284c8eb1c79f6aba7a63dc75ec890a' as Address },
  { symbol: 'METAx',  label: 'Meta Platforms',     address: '0x96702be57cd9777f835117a809c7124fe4ec989a' as Address },
  { symbol: 'GOOGLx', label: 'Alphabet (Google)',  address: '0xe92f673ca36c5e2efd2de7628f815f84807e803f' as Address },
  { symbol: 'MSTRx',  label: 'MicroStrategy',      address: '0xae2f842ef90c0d5213259ab82639d5bbf649b08e' as Address },
  { symbol: 'HOODx',  label: 'Robinhood Markets',  address: '0xe1385fdd5ffb10081cd52c56584f25efa9084015' as Address },
  { symbol: 'SPYx',   label: 'S&P 500 ETF',        address: '0x90a2a4c76b5d8c0bc892a69ea28aa775a8f2dd48' as Address },
  { symbol: 'QQQx',   label: 'Nasdaq-100 ETF',     address: '0xa753a7395cae905cd615da0b82a53e0560f250af' as Address },
  { symbol: 'CRCLx',  label: 'Circle',             address: '0xfebded1b0986a8ee107f5ab1a1c5a813491deceb' as Address },
] as const;

const VAULT_ABI = parseAbi([
  'function getBalance(address token) external view returns (uint256)',
]);

export interface XStockPosition {
  symbol:       string;
  label:        string;
  address:      string;
  balance:      bigint;   // raw 18-decimal vault balance
  balanceHuman: number;
  priceUsd:     number;
  valueUsd:     number;
}

export function useXStockPortfolio() {
  const chainId       = useChainId();
  const { userVaultAddress } = useVaultFactory();
  const isMainnet     = chainId === MANTLE_MAINNET_ID;

  const vaultAddr = (
    userVaultAddress && userVaultAddress !== zeroAddress
      ? userVaultAddress
      : VAULT_ADDRESS[chainId] ?? zeroAddress
  ) as Address;

  const isDeployed = vaultAddr !== zeroAddress;

  // ── Vault balances — one multicall for all 10 tokens ──────────────────────
  const { data: balanceData } = useReadContracts({
    contracts: XSTOCKS.map(s => ({
      address:      vaultAddr,
      abi:          VAULT_ABI,
      functionName: 'getBalance' as const,
      args:         [s.address],
    })),
    query: {
      enabled:        isDeployed && isMainnet,
      refetchInterval: 15_000,
    },
  });

  // ── Live prices from DefiLlama ─────────────────────────────────────────────
  // Format: mantle:<address> — works for any ERC-20 indexed on Mantle mainnet
  const [prices, setPrices] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!isMainnet) return;
    let cancelled = false;

    async function load() {
      try {
        const keys = XSTOCKS.map(s => `mantle:${s.address}`).join(',');
        const res  = await fetch(`https://coins.llama.fi/prices/current/${keys}`, {
          signal: AbortSignal.timeout(8_000),
        });
        if (!res.ok) return;
        const data: { coins: Record<string, { price: number }> } = await res.json();
        const map: Record<string, number> = {};
        XSTOCKS.forEach(s => {
          const p = data.coins[`mantle:${s.address}`]?.price;
          if (p && p > 0) map[s.address] = p;
        });
        if (!cancelled) setPrices(map);
      } catch { /* silent — prices stay at last known value */ }
    }

    load();
    const id = setInterval(load, 60_000);
    return () => { cancelled = true; clearInterval(id); };
  }, [isMainnet]);

  // ── Combine balances + prices — all 10 always returned ───────────────────
  const positions: XStockPosition[] = XSTOCKS.map((s, i) => {
    const raw          = (balanceData?.[i]?.result ?? 0n) as bigint;
    const balanceHuman = Number(raw) / 1e18;
    const priceUsd     = prices[s.address] ?? 0;
    return {
      symbol:       s.symbol,
      label:        s.label,
      address:      s.address,
      balance:      raw,
      balanceHuman,
      priceUsd,
      valueUsd:     balanceHuman * priceUsd,
    };
  });

  // Held = vault has a non-zero balance
  const heldPositions = positions.filter(p => p.balance > 0n);
  const totalValueUsd = heldPositions.reduce((sum, p) => sum + p.valueUsd, 0);

  return { positions, heldPositions, totalValueUsd, isMainnet };
}
