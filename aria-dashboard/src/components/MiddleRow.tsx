import React, { useState, useEffect } from 'react';
import { RiskProfile, FeedItem, generateIntelligenceFeed, generateMarketPools, MarketPool } from '../services/claude';
import { usePortfolioData } from '../hooks/usePortfolioData';
import { AlertCircle, ArrowRight, Zap, Loader2 } from 'lucide-react';

interface MiddleRowProps {
  riskProfile: RiskProfile;
  onFeedUpdate?: (items: FeedItem[]) => void;
}

const POOL_CACHE_KEY = 'aria-pool-cache';
const POOL_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

type Pool = MarketPool;

interface PoolCache {
  riskProfile: RiskProfile;
  pools: Pool[];
  cachedAt: number;
}

function loadCachedPools(riskProfile: RiskProfile): Pool[] | null {
  try {
    const raw = localStorage.getItem(POOL_CACHE_KEY);
    if (!raw) return null;
    const cache: PoolCache = JSON.parse(raw);
    if (cache.riskProfile !== riskProfile) return null;
    if (Date.now() - cache.cachedAt > POOL_CACHE_TTL) return null;
    return cache.pools;
  } catch {
    return null;
  }
}

function saveCachedPools(riskProfile: RiskProfile, pools: Pool[]): void {
  try {
    localStorage.setItem(POOL_CACHE_KEY, JSON.stringify({ riskProfile, pools, cachedAt: Date.now() }));
  } catch {
    // localStorage quota exceeded — ignore
  }
}


const MiddleRow: React.FC<MiddleRowProps> = ({ riskProfile, onFeedUpdate }) => {
  const [feed, setFeed]       = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [poolsDelayed, setPoolsDelayed] = useState(false);
  const portfolio = usePortfolioData();
  const { toContextString } = portfolio;

  const [pools, setPools] = useState<Pool[]>(() => loadCachedPools(riskProfile) ?? []);

  useEffect(() => {
    let isMounted = true;

    const cached = loadCachedPools(riskProfile);
    if (cached) {
      setPools(cached);
      setPoolsDelayed(false);
      return;
    }

    // No valid cache — fetch fresh pool data
    setPools([]);
    setPoolsDelayed(true);

    generateMarketPools(riskProfile, portfolio.address).then((fetched) => {
      if (!isMounted) return;
      setPools(fetched);
      setPoolsDelayed(false);
      saveCachedPools(riskProfile, fetched);
    });

    return () => { isMounted = false; };
  }, [riskProfile, portfolio.address]);

  useEffect(() => {
    let isMounted = true;

    const fetchFeed = () => {
      setLoading(true);
      generateIntelligenceFeed(riskProfile, toContextString(), portfolio.address).then(items => {
        if (isMounted) {
          setFeed(items);
          setLoading(false);
          onFeedUpdate?.(items);
        }
      });
    };

    fetchFeed();
    const interval = setInterval(fetchFeed, 5 * 60 * 1000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  // toContextString is stable (inline fn) — intentionally excluded from deps
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [riskProfile]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 py-8 border-b border-soft">
      {/* Left: Intelligence Feed */}
      <div className="flex flex-col gap-4">
        <div className="flex justify-between items-end mb-2">
          <h3 data-tour="intelligence-feed" className="font-serif text-2xl font-semibold text-text-primary">Intelligence Feed</h3>
          {loading && <Loader2 size={16} className="text-text-secondary animate-spin mb-1" />}
        </div>
        <div className="flex flex-col gap-4">
          {feed.map((item) => (
            <div key={item.id} className="p-5 border border-soft bg-card rounded-sm flex gap-4">
              <div className="pt-1">
                {item.tag === 'ACTION'      && <ArrowRight  size={18} className="text-accent"   />}
                {item.tag === 'ALERT'       && <AlertCircle size={18} className="text-red-500"  />}
                {item.tag === 'OPPORTUNITY' && <Zap         size={18} className="text-accent"   />}
              </div>
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-3">
                  <span className={`text-xs font-bold tracking-widest uppercase ${
                    item.tag === 'ALERT' ? 'text-red-500' : 'text-accent'
                  }`}>
                    {item.tag}
                  </span>
                  <span className="text-xs text-text-secondary">{item.timestamp}</span>
                </div>
                <p className="text-text-primary text-sm leading-relaxed">{item.message}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Right: Available Pools */}
      <div className="flex flex-col gap-4">
        <div className="flex justify-between items-end mb-2">
          <h3 data-tour="market-pools" className="font-serif text-2xl font-semibold text-text-primary">Available Market Pools</h3>
          {poolsDelayed && (
            <span className="text-[10px] uppercase tracking-wider text-text-secondary mb-1">Data may be delayed</span>
          )}
        </div>
        {/* Mobile pool cards */}
        <div className="md:hidden space-y-3">
          {pools.length === 0 ? (
            <div className="p-4 text-center text-text-secondary text-sm border border-soft rounded-sm bg-card">
              Loading live pool data…
            </div>
          ) : pools.map((pool, i) => (
            <div key={i} className="p-4 bg-card border border-soft rounded-sm">
              <div className="flex justify-between items-start">
                <div>
                  <div className="font-semibold text-text-primary text-sm flex items-center gap-2">
                    {pool.name}
                    {pool.incentivized && (
                      <span className="bg-accent/10 text-accent text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded-sm">Boost</span>
                    )}
                  </div>
                  <div className="text-xs text-text-secondary mt-1">{pool.protocol}</div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-accent font-mono">{pool.apy}</div>
                  <div className="text-xs text-text-secondary">APY</div>
                </div>
              </div>
              <div className="flex justify-between mt-3 pt-3 border-t border-soft">
                <span className="text-xs text-text-secondary">TVL</span>
                <span className="text-xs font-medium text-text-primary font-mono">{pool.tvl}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Desktop table */}
        <div className="hidden md:block border border-soft rounded-sm overflow-hidden bg-bg">
          <table className="w-full text-left text-sm">
            <thead className="bg-bg-soft text-text-secondary">
              <tr>
                <th className="px-5 py-3 font-semibold uppercase tracking-wider text-xs">Pool</th>
                <th className="px-5 py-3 font-semibold uppercase tracking-wider text-xs">Protocol</th>
                <th className="px-5 py-3 font-semibold uppercase tracking-wider text-xs text-right">TVL</th>
                <th className="px-5 py-3 font-semibold uppercase tracking-wider text-xs text-right">APY</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-soft">
              {pools.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-5 py-6 text-center text-text-secondary text-sm">
                    Loading live pool data…
                  </td>
                </tr>
              ) : pools.map((pool, i) => (
                <tr key={i} className="hover:bg-card transition-colors">
                  <td className="px-5 py-4 font-medium text-text-primary">
                    <span className="flex items-center gap-2">
                      {pool.name}
                      {pool.incentivized && (
                        <span className="bg-accent/10 text-accent text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded-sm">Boost</span>
                      )}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-text-secondary">{pool.protocol}</td>
                  <td className="px-5 py-4 text-right font-mono text-text-secondary">{pool.tvl}</td>
                  <td className="px-5 py-4 text-right font-mono text-text-primary font-medium">{pool.apy}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default MiddleRow;
