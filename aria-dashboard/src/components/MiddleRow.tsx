import React, { useState, useEffect } from 'react';
import { RiskProfile, FeedItem, generateIntelligenceFeed, generateMarketPools, MarketPool } from '../services/claude';
import { fetchAgentPools } from '../services/agentPools';
import { usePortfolioData } from '../hooks/usePortfolioData';
import { AlertCircle, ArrowRight, Zap, Loader2 } from 'lucide-react';

interface MiddleRowProps {
  riskProfile: RiskProfile;
  onFeedUpdate?: (items: FeedItem[]) => void;
  onPoolsUpdate?: (pools: MarketPool[]) => void;
}

const POOL_CACHE_KEY = 'aria-pool-cache';
const POOL_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

type Pool = MarketPool;

interface PoolCache {
  riskProfile: RiskProfile;
  pools: Pool[];
  cachedAt: number;
  isLive: boolean;
}

function loadCachedPools(riskProfile: RiskProfile): { pools: Pool[]; isLive: boolean } | null {
  try {
    const raw = localStorage.getItem(POOL_CACHE_KEY);
    if (!raw) return null;
    const cache: PoolCache = JSON.parse(raw);
    if (cache.riskProfile !== riskProfile) return null;
    if (Date.now() - cache.cachedAt > POOL_CACHE_TTL) return null;
    return { pools: cache.pools, isLive: cache.isLive ?? false };
  } catch {
    return null;
  }
}

function saveCachedPools(riskProfile: RiskProfile, pools: Pool[], isLive: boolean): void {
  try {
    localStorage.setItem(POOL_CACHE_KEY, JSON.stringify({ riskProfile, pools, cachedAt: Date.now(), isLive }));
  } catch {
    // localStorage quota exceeded — ignore
  }
}

const MiddleRow: React.FC<MiddleRowProps> = ({ riskProfile, onFeedUpdate, onPoolsUpdate }) => {
  const [feed, setFeed]       = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [poolsLoading, setPoolsLoading] = useState(false);
  const [isLivePools, setIsLivePools] = useState(false);
  const portfolio = usePortfolioData();
  const { toContextString } = portfolio;

  const [pools, setPools] = useState<Pool[]>(() => {
    const cached = loadCachedPools(riskProfile);
    return cached ? cached.pools : [];
  });

  // Fetch pools: agent (real on-chain) → Claude fallback
  useEffect(() => {
    let isMounted = true;

    const cached = loadCachedPools(riskProfile);
    if (cached) {
      setPools(cached.pools);
      setIsLivePools(cached.isLive);
      onPoolsUpdate?.(cached.pools);
      return;
    }

    setPools([]);
    setPoolsLoading(true);

    const fetchPools = async () => {
      // 1. Try real on-chain data from the agent
      const agentPools = await fetchAgentPools();
      if (agentPools && agentPools.length > 0) {
        if (!isMounted) return;
        setPools(agentPools);
        setIsLivePools(true);
        setPoolsLoading(false);
        saveCachedPools(riskProfile, agentPools, true);
        onPoolsUpdate?.(agentPools);
        return;
      }

      // 2. Agent offline or returned no data — ask Claude
      const claudePools = await generateMarketPools(riskProfile, portfolio.address);
      if (!isMounted) return;
      setPools(claudePools);
      setIsLivePools(false);
      setPoolsLoading(false);
      saveCachedPools(riskProfile, claudePools, false);
      onPoolsUpdate?.(claudePools);
    };

    fetchPools();
    return () => { isMounted = false; };
  }, [riskProfile, portfolio.address]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch intelligence feed every 5 minutes
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
    return () => { isMounted = false; clearInterval(interval); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [riskProfile]);

  // Column header: "Liquidity" when showing agent data (score-based), "TVL" for Claude data
  const tvlHeader = isLivePools ? 'Liquidity' : 'TVL';

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
          <div className="flex items-center gap-2 mb-1">
            {isLivePools && (
              <span className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-accent font-semibold">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
                Live
              </span>
            )}
            {!isLivePools && !poolsLoading && (
              <span className="text-[10px] uppercase tracking-wider text-text-secondary">Estimated</span>
            )}
          </div>
        </div>

        {/* Mobile pool cards */}
        <div className="md:hidden space-y-3">
          {pools.length === 0 ? (
            <div className="p-4 text-center text-text-secondary text-sm border border-soft rounded-sm bg-card">
              {poolsLoading ? 'Fetching live pool data…' : 'No pool data available.'}
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
                <span className="text-xs text-text-secondary">{tvlHeader}</span>
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
                <th className="px-5 py-3 font-semibold uppercase tracking-wider text-xs text-right">{tvlHeader}</th>
                <th className="px-5 py-3 font-semibold uppercase tracking-wider text-xs text-right">APY</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-soft">
              {pools.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-5 py-6 text-center text-text-secondary text-sm">
                    {poolsLoading ? 'Fetching live pool data…' : 'No pool data available.'}
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
