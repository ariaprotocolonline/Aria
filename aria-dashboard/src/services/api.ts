import { env } from '../config/env';

// ── Conversation auth token ─────────────────────────────────────────────────
// Stored in sessionStorage — expires when the tab closes, which is fine since
// the server's 2-hour rolling HMAC window is short enough anyway.

const TOKEN_PREFIX = 'aria-conv-token:';

export function setConvToken(wallet: string, token: string): void {
  try { sessionStorage.setItem(TOKEN_PREFIX + wallet.toLowerCase(), token); } catch { /* ignore */ }
}

export function getConvToken(wallet: string): string | null {
  try { return sessionStorage.getItem(TOKEN_PREFIX + wallet.toLowerCase()); } catch { return null; }
}

// ── Chat ────────────────────────────────────────────────────────────────────
// Single HTTP entry point for all aria-server calls.
// Both claude.ts and useAgentMemory.ts import from here — no duplicate fetchers.
export async function callServer(body: Record<string, unknown>, sessionToken?: string | null): Promise<Response> {
  // Empty API_URL means relative path — Vite proxy routes /api/* to aria-server in dev,
  // nginx routes it in production. Never throw just because the env var is empty.
  const base = env.API_URL ?? '';
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (sessionToken) headers['Authorization'] = `Bearer ${sessionToken}`;
  return fetch(`${base}/api/chat`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
}

// Returns true if the server wants a SIWE sign-in
export async function isSiweRequired(response: Response): Promise<boolean> {
  if (response.status !== 401) return false;
  try {
    const body = await response.clone().json() as { code?: string };
    return body.code === 'SIWE_REQUIRED';
  } catch { return false; }
}

// Throws a user-safe error for known rate-limit / auth status codes.
export async function assertNotRateLimited(response: Response): Promise<void> {
  if (response.status === 429) throw new Error('You have reached your daily message limit. This resets at midnight.');
  if (response.status === 503) throw new Error('ARIA chat is at capacity. Try again shortly.');
  if (response.status === 401) throw new Error('Please connect your wallet to use ARIA chat.');
}

const SAFE_PREFIXES = [
  'You have reached',
  'ARIA chat is at capacity',
  'Please connect your wallet',
  'ARIA is unavailable',
] as const;

export function isSafeError(msg: string): boolean {
  return SAFE_PREFIXES.some(p => msg.startsWith(p));
}
