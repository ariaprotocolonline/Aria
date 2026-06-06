const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TG_BASE   = BOT_TOKEN ? `https://api.telegram.org/bot${BOT_TOKEN}` : null;

// ─── Core send ───────────────────────────────────────────────────────────────

export async function sendMessage(chatId: number | string, text: string): Promise<boolean> {
  if (!TG_BASE) return false;
  try {
    const res = await fetch(`${TG_BASE}/sendMessage`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
      signal:  AbortSignal.timeout(8_000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// ─── Webhook registration ─────────────────────────────────────────────────────

export async function setWebhook(url: string): Promise<boolean> {
  if (!TG_BASE) return false;
  try {
    const res = await fetch(`${TG_BASE}/setWebhook`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ url, allowed_updates: ['message'] }),
      signal:  AbortSignal.timeout(8_000),
    });
    const data = await res.json() as { ok: boolean; description?: string };
    if (data.ok) {
      console.log('[Telegram] Webhook registered:', url);
    } else {
      console.warn('[Telegram] Webhook registration failed:', data.description);
    }
    return data.ok;
  } catch (err) {
    console.warn('[Telegram] setWebhook error:', err instanceof Error ? err.message : err);
    return false;
  }
}

// ─── Message formatters ───────────────────────────────────────────────────────

export function formatActionNotification(
  type: 'ACTION' | 'ALERT' | 'OPPORTUNITY',
  text: string,
  txHash?: string
): string {
  const icon  = type === 'ACTION' ? '⚡' : type === 'ALERT' ? '⚠️' : '📊';
  const label = type === 'ACTION' ? 'Reallocation' : type === 'ALERT' ? 'Alert' : 'Opportunity';
  let msg = `${icon} <b>ARIA ${label}</b>\n\n${text}`;
  if (txHash) {
    msg += `\n\n🔗 <a href="https://explorer.mantle.xyz/tx/${txHash}">View on Mantle Explorer</a>`;
  }
  return msg;
}

export function formatDailySummary(
  balance:            { weth: string; usdc: string },
  apyBps:             number,
  reallocationCount:  number,
  lastAction:         string
): string {
  const apy = (apyBps / 100).toFixed(2);
  return (
    `📈 <b>ARIA Daily Summary</b>\n\n` +
    `<b>Vault balances</b>\n` +
    `• WETH: <code>${balance.weth}</code>\n` +
    `• USDC: <code>${balance.usdc}</code>\n\n` +
    `<b>Performance</b>\n` +
    `• Current APY: <b>${apy}%</b>\n` +
    `• Reallocations today: <b>${reallocationCount}</b>\n\n` +
    `<b>Last action</b>\n${lastAction}\n\n` +
    `<i>ARIA is watching 24/7. Reply with /status for live data.</i>`
  );
}

export function formatWelcome(walletAddress: string): string {
  return (
    `🤖 <b>Welcome to ARIA</b>\n\n` +
    `Your Telegram is now linked to vault:\n<code>${walletAddress}</code>\n\n` +
    `You'll receive real-time notifications when ARIA reallocates your funds.\n\n` +
    `<b>Commands</b>\n` +
    `/status — current vault status\n` +
    `/disconnect — unlink this account\n` +
    `/help — show all commands`
  );
}
