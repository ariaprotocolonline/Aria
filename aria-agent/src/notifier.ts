// Sends Telegram notifications to aria-server after each agent cycle.
// Calls POST /internal/notify — protected by X-Internal-Token header.
// Silently no-ops if ARIA_SERVER_URL or INTERNAL_SECRET are not configured.

// aria-tgbot is a standalone service — agent calls it directly, server-to-server.
// Set ARIA_TGBOT_URL in .env (default: http://127.0.0.1:3003).
const TG_BOT_URL      = process.env.ARIA_TGBOT_URL ?? 'http://127.0.0.1:3003';
const INTERNAL_SECRET = process.env.INTERNAL_SECRET ?? '';

interface NotifyPayload {
  walletAddress: string;
  type:          'ACTION' | 'ALERT' | 'OPPORTUNITY' | 'RAW';
  text:          string;
  txHash?:       string;
}

async function notify(payload: NotifyPayload): Promise<void> {
  if (!INTERNAL_SECRET) return;
  try {
    await fetch(`${TG_BOT_URL}/notify`, {
      method:  'POST',
      headers: {
        'Content-Type':    'application/json',
        'X-Internal-Token': INTERNAL_SECRET,
      },
      body:   JSON.stringify(payload),
      signal: AbortSignal.timeout(5_000),
    });
  } catch {
    // Notification failure is non-critical — agent cycle must continue
  }
}

export async function notifyAction(
  walletAddress: string,
  text:          string,
  txHash?:       string
): Promise<void> {
  return notify({ walletAddress, type: 'ACTION', text, txHash });
}

export async function notifyAlert(
  walletAddress: string,
  text:          string
): Promise<void> {
  return notify({ walletAddress, type: 'ALERT', text });
}

// ─── Daily summary scheduler ──────────────────────────────────────────────────
// Fires once at midnight UTC each day. Calls the provided callback which should
// fetch vault state and call notify() directly with type ACTION and a formatted summary.

export async function notifyRaw(
  walletAddress: string,
  text:          string
): Promise<void> {
  return notify({ walletAddress, type: 'RAW', text });
}

// ─── Hourly pool update scheduler ────────────────────────────────────────────
// Fires immediately on start, then every 60 minutes. The callback should fetch
// current pool data, discover all vault owners, and send a formatted update to each.

export function scheduleHourlyUpdate(callback: () => Promise<void>): void {
  const run = async () => {
    try { await callback(); } catch { /* non-critical */ }
  };
  // Fire once immediately (offset 60s to let pools warm up on startup)
  setTimeout(run, 60_000);
  // Then every hour
  setInterval(run, 60 * 60_000);
  console.log('[Notifier] Hourly pool updates scheduled (first in 60s, then every 60min)');
}

export function scheduleDailySummary(callback: () => Promise<void>): void {
  const scheduleNext = () => {
    const now        = new Date();
    const nextMidnight = new Date(Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() + 1,
      0, 0, 0, 0
    ));
    const msUntilMidnight = nextMidnight.getTime() - Date.now();
    setTimeout(async () => {
      try { await callback(); } catch { /* non-critical */ }
      scheduleNext(); // reschedule for next midnight
    }, msUntilMidnight);
    console.log(`[Notifier] Daily summary scheduled in ${Math.round(msUntilMidnight / 60_000)} min`);
  };
  scheduleNext();
}
