import { useState, useCallback } from 'react';
import { useSignMessage } from 'wagmi';
import { env } from '../config/env';

const SESSION_KEY_PREFIX = 'aria-session:';
const API = env.API_URL ?? '';

export interface SiweSession {
  token: string;
  wallet: string;
  expiresAt: number;
}

function storageKey(wallet: string) {
  return SESSION_KEY_PREFIX + wallet.toLowerCase();
}

export function loadSession(wallet: string): SiweSession | null {
  try {
    const raw = sessionStorage.getItem(storageKey(wallet));
    if (!raw) return null;
    const s: SiweSession = JSON.parse(raw);
    if (Date.now() > s.expiresAt) { sessionStorage.removeItem(storageKey(wallet)); return null; }
    return s;
  } catch { return null; }
}

function saveSession(s: SiweSession) {
  try { sessionStorage.setItem(storageKey(s.wallet), JSON.stringify(s)); } catch { /* ignore */ }
}

export function clearSession(wallet: string) {
  try { sessionStorage.removeItem(storageKey(wallet)); } catch { /* ignore */ }
}

export function useSiweAuth() {
  const { signMessageAsync } = useSignMessage();
  const [signing, setSigning] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  const signIn = useCallback(async (wallet: string): Promise<SiweSession | null> => {
    setSigning(true);
    setError(null);

    try {
      // 1. Get nonce from server
      const nonceRes = await fetch(`${API}/auth/nonce`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet }),
      });
      if (!nonceRes.ok) throw new Error('Failed to get sign-in nonce');
      const { nonce, message } = await nonceRes.json() as { nonce: string; message: string; issuedAt: string };

      // 2. Ask wallet to sign the message
      const signature = await signMessageAsync({ message });

      // 3. Verify with server → receive session token
      const verifyRes = await fetch(`${API}/auth/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet, nonce, signature }),
      });
      if (!verifyRes.ok) {
        const err = await verifyRes.json().catch(() => ({ error: 'Verification failed' }));
        throw new Error((err as { error?: string }).error ?? 'Verification failed');
      }
      const { token, expiresIn } = await verifyRes.json() as { token: string; expiresIn: number };

      const session: SiweSession = { token, wallet: wallet.toLowerCase(), expiresAt: Date.now() + expiresIn };
      saveSession(session);
      return session;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Sign-in failed';
      setError(msg);
      return null;
    } finally {
      setSigning(false);
    }
  }, [signMessageAsync]);

  return { signIn, signing, error };
}
