import { useState, useEffect, useRef } from 'react';
import { type FeedItem } from '../services/claude';
import { env } from '../config/env';

const FEED_KEY    = 'aria-feed-cache';
const POLL_MS     = 15_000;

interface ActivityStats {
  reallocations: number;
  traps: number;
  opportunities: number;
  uptimeLabel: string;
  lastUpdated: string | null;
  agentOnline: boolean;
}

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try { return JSON.parse(raw) as T; } catch { return fallback; }
}

function computeStats(items: FeedItem[], agentOnline: boolean, uptimeSeconds: number | null): ActivityStats {
  const reallocations = items.filter(i => i.tag === 'ACTION').length;
  const traps         = items.filter(i => i.tag === 'ALERT').length;
  const opportunities = items.filter(i => i.tag === 'OPPORTUNITY').length;
  const lastUpdated   = items.length > 0 ? items[0].timestamp : null;

  let uptimeLabel: string;
  if (!agentOnline) {
    uptimeLabel = 'Offline';
  } else if (uptimeSeconds === null) {
    uptimeLabel = 'Online';
  } else {
    const h = Math.floor(uptimeSeconds / 3600);
    const m = Math.floor((uptimeSeconds % 3600) / 60);
    uptimeLabel = h > 0 ? `${h}h ${m}m` : `${m}m`;
  }

  return { reallocations, traps, opportunities, uptimeLabel, lastUpdated, agentOnline };
}

export function useActivityFeed(liveFeed: FeedItem[]): ActivityStats {
  const [agentOnline, setAgentOnline]       = useState(false);
  const [uptimeSeconds, setUptimeSeconds]   = useState<number | null>(null);
  const [allItems, setAllItems]             = useState<FeedItem[]>(() =>
    safeParse<FeedItem[]>(localStorage.getItem(FEED_KEY + '-all'), [])
  );
  const allItemsRef = useRef(allItems);
  allItemsRef.current = allItems;

  // Merge items from Claude's intelligence feed (MiddleRow) into the cache
  useEffect(() => {
    if (liveFeed.length === 0) return;
    const existing = allItemsRef.current;
    const existingIds = new Set(existing.map(i => i.id));
    const newItems = liveFeed.filter(i => !existingIds.has(i.id));
    if (newItems.length === 0) return;
    const merged = [...newItems, ...existing].slice(0, 500);
    localStorage.setItem(FEED_KEY + '-all', JSON.stringify(merged));
    setAllItems(merged);
  }, [liveFeed]);

  // Poll aria-agent feed endpoint every 15s
  useEffect(() => {
    const feedUrl = env.FEED_URL;
    if (!feedUrl) return;

    async function poll() {
      try {
        const [feedRes, healthRes] = await Promise.all([
          fetch(`${feedUrl}/feed`),
          fetch(`${feedUrl}/health`),
        ]);

        if (!feedRes.ok || !healthRes.ok) {
          setAgentOnline(false);
          return;
        }

        const agentItems: FeedItem[] = await feedRes.json();
        const health: { uptime?: number } = await healthRes.json();

        setAgentOnline(true);
        setUptimeSeconds(health.uptime ?? null);

        if (agentItems.length === 0) return;
        const existing = allItemsRef.current;
        const existingIds = new Set(existing.map(i => i.id));
        const fresh = agentItems.filter(i => !existingIds.has(i.id));
        if (fresh.length === 0) return;
        const merged = [...fresh, ...existing].slice(0, 500);
        localStorage.setItem(FEED_KEY + '-all', JSON.stringify(merged));
        setAllItems(merged);
      } catch {
        setAgentOnline(false);
      }
    }

    poll();
    const interval = setInterval(poll, POLL_MS);
    return () => clearInterval(interval);
  }, []);

  return computeStats(allItems, agentOnline, uptimeSeconds);
}
