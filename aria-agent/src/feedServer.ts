import http from 'http';
import fs from 'fs';
import path from 'path';
import { getMemorySummary, getRecentMemory, saveMemory } from './memory';

// ── User-defined custom pools ─────────────────────────────────────────────────

export interface UserPool {
  id: string;
  protocol: string;
  tokenSymbol: string;
  tokenAddress: string;
  tokenDecimals: number;
  tokenInAddress: string;
  tokenInSymbol: string;
  poolAddress: string;
  routerAddress: string;
  feeTier: number;
  apyBps: number;
  addedBy: string;
  addedAt: string;
}

const USER_POOLS_FILE = path.join(__dirname, '../data/user-pools.json');

export function loadUserPools(): UserPool[] {
  try {
    if (!fs.existsSync(USER_POOLS_FILE)) return [];
    return JSON.parse(fs.readFileSync(USER_POOLS_FILE, 'utf-8'));
  } catch { return []; }
}

function saveUserPools(pools: UserPool[]): void {
  const dir = path.dirname(USER_POOLS_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const tmp = USER_POOLS_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(pools, null, 2));
  fs.renameSync(tmp, USER_POOLS_FILE);
}

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
    // Opportunistically prune stale entries to prevent unbounded map growth.
    if (feedRateMap.size > 5_000) {
      for (const [key, val] of feedRateMap) {
        if (now - val.windowStart > FEED_WINDOW_MS) feedRateMap.delete(key)
      }
    }
    feedRateMap.set(ip, { count: 1, windowStart: now });
    return true;
  }
  if (record.count >= FEED_RATE_LIMIT) return false;
  record.count++;
  return true;
}

export function startFeedServer(port = 3001): http.Server {
  const ALLOWED_FEED_ORIGINS = new Set([
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:4173',
    'https://ariaprotocol.online',        // production domain
    'https://www.ariaprotocol.online',
    ...(process.env.ALLOWED_ORIGINS?.split(',').map(s => s.trim()).filter(Boolean) ?? []),
  ]);

  const REQUEST_TIMEOUT_MS = 5_000;

  const server = http.createServer((req, res) => {
    // Enforce 5-second request timeout to prevent slow-connection attacks.
    req.socket.setTimeout(REQUEST_TIMEOUT_MS);
    req.socket.once('timeout', () => {
      res.writeHead(408);
      res.end(JSON.stringify({ error: 'Request timeout' }));
    });
    // When proxied by nginx, use X-Real-IP so rate limiting works per-client, not per-proxy.
    const socketIp = req.socket.remoteAddress ?? '';
    const isLocal  = socketIp === '127.0.0.1' || socketIp === '::1' || socketIp === '::ffff:127.0.0.1';
    const ip = (isLocal ? (req.headers['x-real-ip'] as string) : socketIp) || socketIp || 'unknown';

    const origin = req.headers['origin'] ?? '';
    const corsOrigin = ALLOWED_FEED_ORIGINS.has(origin) ? origin : '';
    if (corsOrigin) {
      res.setHeader('Access-Control-Allow-Origin', corsOrigin);
      res.setHeader('Vary', 'Origin');
    }
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
      if (ip !== '127.0.0.1' && ip !== '::1' && ip !== '::ffff:127.0.0.1') {
        res.writeHead(403);
        res.end(JSON.stringify({ error: 'Forbidden' }));
        return;
      }
      res.writeHead(200);
      res.end(JSON.stringify({
        summary: getMemorySummary(),
        recent: getRecentMemory(20),
      }));
      return;
    }

    if (req.method === 'DELETE' && req.url === '/memory') {
      if (ip !== '127.0.0.1' && ip !== '::1' && ip !== '::ffff:127.0.0.1') {
        res.writeHead(403);
        res.end(JSON.stringify({ error: 'Forbidden' }));
        return;
      }
      saveMemory([]);
      res.writeHead(200);
      res.end(JSON.stringify({ success: true }));
      return;
    }

    // ── User-defined pools ──────────────────────────────────────────────────

    if (req.method === 'GET' && req.url === '/user-pools') {
      res.writeHead(200);
      res.end(JSON.stringify(loadUserPools()));
      return;
    }

    if (req.method === 'POST' && req.url === '/user-pools') {
      if (ip !== '127.0.0.1' && ip !== '::1' && ip !== '::ffff:127.0.0.1') {
        res.writeHead(403);
        res.end(JSON.stringify({ error: 'Forbidden' }));
        return;
      }
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        try {
          const pool = JSON.parse(body) as Omit<UserPool, 'id' | 'addedAt'>;
          const pools = loadUserPools();
          const newPool: UserPool = {
            ...pool,
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            addedAt: new Date().toISOString(),
          };
          pools.push(newPool);
          saveUserPools(pools);
          res.writeHead(201);
          res.end(JSON.stringify(newPool));
        } catch {
          res.writeHead(400);
          res.end(JSON.stringify({ error: 'Invalid payload' }));
        }
      });
      return;
    }

    if (req.method === 'DELETE' && req.url?.startsWith('/user-pools/')) {
      if (ip !== '127.0.0.1' && ip !== '::1' && ip !== '::ffff:127.0.0.1') {
        res.writeHead(403);
        res.end(JSON.stringify({ error: 'Forbidden' }));
        return;
      }
      const id = req.url.slice('/user-pools/'.length);
      const pools = loadUserPools().filter(p => p.id !== id);
      saveUserPools(pools);
      res.writeHead(200);
      res.end(JSON.stringify({ success: true }));
      return;
    }

    res.writeHead(404);
    res.end(JSON.stringify({ error: 'Not found' }));
  });

  server.listen(port, '127.0.0.1', () => {
    console.log(`[feedServer] Listening on 127.0.0.1:${port}`);
  });

  return server;
}
