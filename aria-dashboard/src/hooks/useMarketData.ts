import { useState, useEffect } from 'react';
import { env } from '../config/env';

export interface MarketPool {
  gl: string;
  bg: string;
  nm: string;
  sub: string;
  asset: string;
  q: number;
  apy: string;
  apyRaw: number;
  inc: string;
  depth: string;
  trend: 'up' | 'down' | 'flat';
  status: string;
  statusColor: string;
}

interface DefiLlamaPool {
  pool: string;
  chain: string;
  project: string;
  symbol: string;
  tvlUsd: number;
  apy: number;
  apyBase: number;
  apyReward: number | null;
  apyPct7D: number | null;
}

const PROTOCOL_DISPLAY: Record<string, { gl: string; bg: string; nm: string }> = {
  'agni-finance':         { gl: 'A', bg: 'linear-gradient(135deg,#75e5b0,#4dd394)', nm: 'Agni' },
  'lendle':               { gl: 'L', bg: 'linear-gradient(135deg,#ff7878,#d84a4a)', nm: 'Lendle' },
  'init-capital':         { gl: 'I', bg: 'linear-gradient(135deg,#8ec5ff,#5a8ed8)', nm: 'Init Capital' },
  'pendle':               { gl: 'P', bg: 'linear-gradient(135deg,#a78bff,#7a4dff)', nm: 'Pendle' },
  'fusionx-v3':           { gl: 'F', bg: 'linear-gradient(135deg,#7afff0,#3dd9c4)', nm: 'FusionX' },
  'cleopatra-exchange':   { gl: 'C', bg: 'linear-gradient(135deg,#8ec5ff,#5a8ed8)', nm: 'Cleopatra' },
};

function fmtDisplay(project: string): { gl: string; bg: string; nm: string } {
  if (PROTOCOL_DISPLAY[project]) return PROTOCOL_DISPLAY[project];
  const nm = project.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  const gl = nm.charAt(0).toUpperCase();
  return { gl, bg: 'linear-gradient(135deg,#7a7d83,#44474c)', nm };
}

function computeQuality(apyBase: number, apyTotal: number, tvlUsd: number): number {
  if (apyTotal <= 0) return 0;
  const incentiveFrac = apyTotal > 0 ? Math.max(0, (apyTotal - apyBase) / apyTotal) : 0;
  const organicScore = Math.round((1 - incentiveFrac) * 55);
  const tvlScore = Math.min(45, Math.round((Math.log10(Math.max(1, tvlUsd)) / Math.log10(100_000_000)) * 45));
  return Math.min(99, organicScore + tvlScore);
}

function detectAsset(symbol: string): string {
  const s = symbol.toUpperCase();
  if (s.includes('WETH') || s.includes('ETH')) return 'WETH';
  if (s.includes('USDC')) return 'USDC';
  if (s.includes('USDT')) return 'USDT';
  if (s.includes('MNT')) return 'MNT';
  return s.split('-')[0] ?? s.split('/')[0] ?? s.slice(0, 4);
}

function mapPool(p: DefiLlamaPool): MarketPool {
  const cfg = fmtDisplay(p.project);
  const apyTotal = p.apy ?? 0;
  const apyBase = p.apyBase ?? 0;
  const incRatio = apyTotal > 0 ? Math.max(0, (apyTotal - apyBase) / apyTotal) : 0;
  const q = computeQuality(apyBase, apyTotal, p.tvlUsd ?? 0);
  const asset = detectAsset(p.symbol);
  const trend: MarketPool['trend'] = (p.apyPct7D ?? 0) > 0.5 ? 'up' : (p.apyPct7D ?? 0) < -0.5 ? 'down' : 'flat';
  const status = q >= 70 ? 'candidate' : q >= 55 ? 'watch' : 'below floor';
  const statusColor = q >= 70 ? 'var(--accent)' : q >= 55 ? 'var(--warm)' : 'var(--red)';
  const tvl = p.tvlUsd;
  const depth = tvl >= 1_000_000 ? `$${(tvl / 1_000_000).toFixed(1)}M`
              : tvl >= 1_000    ? `$${(tvl / 1_000).toFixed(0)}K`
              : '—';

  return {
    gl: cfg.gl,
    bg: cfg.bg,
    nm: cfg.nm,
    sub: p.symbol,
    asset,
    q,
    apy: `${apyTotal.toFixed(1)}%`,
    apyRaw: apyTotal,
    inc: incRatio.toFixed(2),
    depth,
    trend,
    status,
    statusColor,
  };
}

// Static fallback — known live Mantle pools from the ARIA agent config.
// Used when DefiLlama is unreachable or returns empty results.
const FALLBACK_POOLS: MarketPool[] = [
  { gl:'A', bg:'linear-gradient(135deg,#75e5b0,#4dd394)', nm:'Agni',    sub:'WETH/MNT-0.3%',  asset:'WETH', q:82, apy:'14.2%', apyRaw:14.2, inc:'0.18', depth:'$8.1M', trend:'up',   status:'candidate', statusColor:'var(--accent)' },
  { gl:'A', bg:'linear-gradient(135deg,#75e5b0,#4dd394)', nm:'Agni',    sub:'WETH/USDC-0.05%', asset:'WETH', q:78, apy:'11.1%', apyRaw:11.1, inc:'0.12', depth:'$5.2M', trend:'flat', status:'candidate', statusColor:'var(--accent)' },
  { gl:'F', bg:'linear-gradient(135deg,#7afff0,#3dd9c4)', nm:'FusionX', sub:'WETH/USDC-0.05%', asset:'WETH', q:71, apy:'9.3%',  apyRaw:9.3,  inc:'0.20', depth:'$2.1M', trend:'up',   status:'candidate', statusColor:'var(--accent)' },
];

export function useMarketData() {
  const [pools, setPools] = useState<MarketPool[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function tryFeedUrl(): Promise<boolean> {
      if (!env.FEED_URL) return false;
      try {
        const res = await fetch(`${env.FEED_URL}/markets`, { signal: AbortSignal.timeout(5000) });
        if (!res.ok) return false;
        const data: MarketPool[] = await res.json();
        if (!cancelled && Array.isArray(data) && data.length > 0) {
          setPools(data);
          setLoading(false);
          setLastUpdated(new Date());
          return true;
        }
      } catch { /* fall through */ }
      return false;
    }

    async function tryDefiLlama(): Promise<boolean> {
      try {
        const res = await fetch('https://yields.llama.fi/pools', { signal: AbortSignal.timeout(20000) });
        if (!res.ok) return false;
        const json: { data: DefiLlamaPool[] } = await res.json();

        const mantlePools = json.data
          .filter(p => p.chain === 'Mantle' && (p.apy ?? 0) > 0 && (p.tvlUsd ?? 0) > 10_000)
          .sort((a, b) => (b.tvlUsd ?? 0) - (a.tvlUsd ?? 0))
          .slice(0, 12)
          .map(mapPool)
          .sort((a, b) => b.q - a.q);

        if (!cancelled && mantlePools.length > 0) {
          setPools(mantlePools);
          setLoading(false);
          setLastUpdated(new Date());
          return true;
        }
      } catch { /* fall through */ }
      return false;
    }

    async function load() {
      const fromFeed = await tryFeedUrl();
      if (fromFeed) return;
      const fromLlama = await tryDefiLlama();
      if (!fromLlama && !cancelled) {
        // DefiLlama unavailable or no Mantle pools — use static fallback
        setPools(FALLBACK_POOLS);
        setLoading(false);
      }
    }

    load();
    const id = setInterval(load, 5 * 60_000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  return { pools, loading, lastUpdated };
}
