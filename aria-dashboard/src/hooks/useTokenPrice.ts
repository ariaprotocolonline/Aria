import { useState, useEffect } from 'react';

interface TokenPrices {
  eth: number;
  mnt: number;
  loading: boolean;
}

export function useTokenPrice(): TokenPrices {
  const [prices, setPrices] = useState<TokenPrices>({ eth: 0, mnt: 0, loading: true });

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(
          'https://coins.llama.fi/prices/current/coingecko:ethereum,coingecko:mantle'
        );
        if (!res.ok) throw new Error('price fetch failed');
        const data: { coins: Record<string, { price: number }> } = await res.json();
        const eth = data.coins['coingecko:ethereum']?.price ?? 0;
        const mnt = data.coins['coingecko:mantle']?.price ?? 0;
        if (!cancelled) setPrices({ eth, mnt, loading: false });
      } catch {
        if (!cancelled) setPrices(p => ({ ...p, loading: false }));
      }
    }
    load();
    const id = setInterval(load, 60_000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  return prices;
}
