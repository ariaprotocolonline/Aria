import { useState, useEffect, useCallback } from 'react';
import { useAccount } from 'wagmi';
// aria-tgbot is proxied by nginx at /tg — separate from aria-server at /api
const TG_BASE = (import.meta.env.VITE_TGBOT_URL as string | undefined) ?? '/tg';

export interface TelegramStatus {
  connected: boolean;
  username:  string | null;
  linkedAt:  string | null;
}

export function useTelegram() {
  const { address } = useAccount();
  const [status, setStatus]   = useState<TelegramStatus>({ connected: false, username: null, linkedAt: null });
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    if (!address) { setStatus({ connected: false, username: null, linkedAt: null }); return; }
    try {
      const res  = await fetch(`${TG_BASE}/status/${address}`);
      if (!res.ok) return;
      const data = await res.json() as TelegramStatus;
      setStatus(data);
    } catch { /* silent */ }
  }, [address]);

  useEffect(() => { fetchStatus(); }, [fetchStatus]);

  const generateLink = useCallback(async (): Promise<string | null> => {
    if (!address) return null;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${TG_BASE}/link`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ walletAddress: address }),
      });
      if (!res.ok) throw new Error('Failed to generate link');
      const data = await res.json() as { deepLink: string };
      return data.deepLink;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate link');
      return null;
    } finally {
      setLoading(false);
    }
  }, [address]);

  const disconnect = useCallback(async (): Promise<void> => {
    if (!address) return;
    setLoading(true);
    try {
      await fetch(`${TG_BASE}/unlink`, {
        method:  'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ walletAddress: address }),
      });
      setStatus({ connected: false, username: null, linkedAt: null });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to disconnect');
    } finally {
      setLoading(false);
    }
  }, [address]);

  return { status, loading, error, generateLink, disconnect, refresh: fetchStatus };
}
