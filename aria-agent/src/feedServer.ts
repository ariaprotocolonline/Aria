import http from 'http';
import { getMemorySummary, getRecentMemory, saveMemory } from './memory';

export interface AgentFeedItem {
  id: string;
  timestamp: string;
  tag: 'ACTION' | 'ALERT' | 'OPPORTUNITY';
  message: string;
}

export interface PoolSnapshot {
  protocol: string;
  poolAddress: string;
  tokenIn: string;
  apyBps: number;
  liquidityScore: number;
  scannedAt: string;
}

const MAX_ITEMS = 100;
const feedBuffer: AgentFeedItem[] = [];
let latestPools: PoolSnapshot[] = [];

export function setLatestPools(pools: Omit<PoolSnapshot, 'scannedAt'>[]): void {
  const scannedAt = new Date().toISOString();
  latestPools = pools.map(p => ({ ...p, scannedAt }));
}

export function addFeedItem(item: Omit<AgentFeedItem, 'id' | 'timestamp'>): void {
  feedBuffer.unshift({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: new Date().toISOString(),
    ...item,
  });
  if (feedBuffer.length > MAX_ITEMS) feedBuffer.pop();
}

// ── Rate limiting: 60 req/min per IP ─────────────────────────────────────────

const feedRateMap = new Map<string, { count: number; windowStart: number }>();
const FEED_RATE_LIMIT = 60;
const FEED_WINDOW_MS  = 60_000;

function checkFeedRateLimit(ip: string): boolean {
  const now    = Date.now();
  const record = feedRateMap.get(ip);
  if (!record || now - record.windowStart > FEED_WINDOW_MS) {
    feedRateMap.set(ip, { count: 1, windowStart: now });
    return true;
  }
  if (record.count >= FEED_RATE_LIMIT) return false;
  record.count++;
  return true;
}

export function startFeedServer(port = 3001): http.Server {
  const server = http.createServer((req, res) => {
    const ip = req.socket.remoteAddress ?? 'unknown';

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, DELETE, OPTIONS');
    res.setHeader('Content-Type', 'application/json');

    if (!checkFeedRateLimit(ip)) {
      res.writeHead(429);
      res.end(JSON.stringify({ error: 'Rate limit exceeded' }));
      return;
    }

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    if (req.method === 'GET' && req.url === '/health') {
      res.writeHead(200);
      res.end(JSON.stringify({ status: 'ok', uptime: process.uptime() }));
      return;
    }

    if (req.method === 'GET' && req.url === '/feed') {
      res.writeHead(200);
      res.end(JSON.stringify(feedBuffer));
      return;
    }

    if (req.method === 'GET' && req.url === '/pools') {
      res.writeHead(200);
      res.end(JSON.stringify(latestPools));
      return;
    }

    if (req.method === 'GET' && req.url === '/memory') {
      res.writeHead(200);
      res.end(JSON.stringify({
        summary: getMemorySummary(),
        recent: getRecentMemory(20),
      }));
      return;
    }

    if (req.method === 'DELETE' && req.url === '/memory') {
      saveMemory([]);
      res.writeHead(200);
      res.end(JSON.stringify({ success: true }));
      return;
    }

    res.writeHead(404);
    res.end(JSON.stringify({ error: 'Not found' }));
  });

  server.listen(port, () => {
    console.log(`[feedServer] Listening on :${port}`);
  });

  return server;
}
