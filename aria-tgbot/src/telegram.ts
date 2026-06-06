const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TG_BASE   = BOT_TOKEN ? `https://api.telegram.org/bot${BOT_TOKEN}` : null;

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
  } catch { return false; }
}

export async function setWebhook(url: string, secretToken?: string): Promise<boolean> {
  if (!TG_BASE) return false;
  try {
    const payload: Record<string, unknown> = { url, allowed_updates: ['message'] };
    if (secretToken) payload.secret_token = secretToken;
    const res  = await fetch(`${TG_BASE}/setWebhook`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
      signal:  AbortSignal.timeout(8_000),
    });
    const data = await res.json() as { ok: boolean; description?: string };
    if (data.ok) {
      console.log(`[Telegram] Webhook set: ${url}${secretToken ? ' (secret token enabled)' : ''}`);
      return true;
    }
    console.warn(`[Telegram] Webhook failed: ${data.description}`);
    return false;
  } catch (err) {
    console.warn('[Telegram] setWebhook error:', err instanceof Error ? err.message : err);
    return false;
  }
}

export async function deleteWebhook(): Promise<void> {
  if (!TG_BASE) return;
  await fetch(`${TG_BASE}/deleteWebhook`, { method: 'POST', signal: AbortSignal.timeout(5_000) }).catch(() => {});
}

export async function getUpdates(offset: number): Promise<{
  ok: boolean;
  result: { update_id: number; message?: { chat: { id: number }; from?: { username?: string }; text?: string } }[];
}> {
  if (!TG_BASE) return { ok: false, result: [] };
  const res = await fetch(
    `${TG_BASE}/getUpdates?offset=${offset}&timeout=30&allowed_updates=message`,
    { signal: AbortSignal.timeout(40_000) },
  );
  return res.json() as Promise<{ ok: boolean; result: { update_id: number; message?: { chat: { id: number }; from?: { username?: string }; text?: string } }[] }>;
}

export function formatAction(text: string, txHash?: string): string {
  let msg = `⚡ <b>ARIA Reallocation</b>\n\n${text}`;
  if (txHash) msg += `\n\n🔗 <a href="https://explorer.mantle.xyz/tx/${txHash}">View on Explorer</a>`;
  return msg;
}

export function formatAlert(text: string): string {
  return `⚠️ <b>ARIA Alert</b>\n\n${text}`;
}

export interface PoolSnapshot {
  protocol:      string;
  apyBps:        number;
  liquidityScore: number;
}

export function formatHourlyUpdate(pools: PoolSnapshot[]): string {
  const now = new Date().toLocaleTimeString('en-US', {
    hour: '2-digit', minute: '2-digit', timeZone: 'UTC', hour12: false,
  });

  const sorted = [...pools].sort((a, b) => b.apyBps - a.apyBps);
  const best   = sorted[0];

  const poolLines = sorted.map(p => {
    const apy   = (p.apyBps / 100).toFixed(2);
    const score = p.liquidityScore.toFixed(2);
    const qual  = p.liquidityScore >= 0.75 ? '🟢' : p.liquidityScore >= 0.55 ? '🟡' : '🔴';
    return `${qual} <b>${p.protocol}</b>\n   APY <code>${apy}%</code> · Liquidity <code>${score}/1.00</code>`;
  }).join('\n\n');

  const bestApy = best ? (best.apyBps / 100).toFixed(2) : '—';

  return (
    `📊 <b>ARIA Market Update</b>  <i>${now} UTC</i>\n\n` +

    `<b>Live Liquidity Pools on Mantle</b>\n` +
    `${poolLines}\n\n` +

    `<b>💡 How you benefit</b>\n` +
    `ARIA scans these pools every 5 minutes. When a better yield opportunity clears its safety gates ` +
    `(liquidity depth, APY threshold, protocol whitelist) it reallocates your WETH and USDC automatically.\n\n` +

    (best
      ? `Best current opportunity: <b>${best.protocol}</b> at <code>${bestApy}%</code> APY\n\n`
      : '') +

    `Your capital stays in your vault at all times. ARIA can only move funds between pre-approved protocols. ` +
    `It can never transfer funds to an external address.\n\n` +

    `<i>Reply /status to check your vault balance.</i>`
  );
}

export function formatDailySummary(weth: string, usdc: string, reallocations: number): string {
  return (
    `📈 <b>ARIA Daily Summary</b>\n\n` +
    `<b>Vault</b>\n• WETH: <code>${weth}</code>\n• USDC: <code>${usdc}</code>\n\n` +
    `<b>Today</b>\n• Reallocations: <b>${reallocations}</b>\n\n` +
    `<i>Reply with /status for live data.</i>`
  );
}

export function formatWelcome(wallet: string): string {
  const short = wallet.slice(0, 6) + '…' + wallet.slice(-4);
  return (
    `✅ <b>Telegram connected.</b>\n\n` +
    `Your vault on Mantle is now linked to this chat:\n` +
    `<code>${wallet}</code>\n\n` +
    `ARIA is live. You'll hear from it the moment it acts on your portfolio — ` +
    `reallocations, yield shifts, pool alerts, and daily summaries will land here automatically.\n\n` +
    `<i>No action needed on your end. ARIA works 24/7.</i>`
  );
}

export function formatOnboarding(wallet: string): string {
  const short = wallet.slice(0, 6) + '…' + wallet.slice(-4);
  return (
    `📖 <b>Here's how ARIA works</b>\n\n` +

    `<b>What ARIA does</b>\n` +
    `Every 5 minutes, ARIA scans Agni Finance and FusionX liquidity pools on Mantle. ` +
    `When it finds a better yield opportunity that clears its safety gates, it reallocates your WETH and USDC automatically — ` +
    `no approval needed from you.\n\n` +

    `<b>What you'll receive here</b>\n` +
    `⚡ <b>Reallocation alerts</b> — every time funds move, with the tx hash\n` +
    `⚠️ <b>Risk alerts</b> — if a pool's liquidity quality drops below your threshold\n` +
    `📈 <b>Daily summaries</b> — vault balance + reallocation count each morning\n\n` +

    `<b>Your vault</b>\n` +
    `<code>${wallet}</code>\n` +
    `Non-custodial · ARIA can only reallocate within approved protocols\n\n` +

    `<b>Commands</b>\n` +
    `/status — live vault balance\n` +
    `/disconnect — unlink this chat\n` +
    `/help — all commands\n\n` +

    `<i>Or just message me — I can answer questions about your positions, yield strategy, and recent moves.</i>\n\n` +
    `🔗 <a href="https://ariaprotocol.online">Open dashboard</a>`
  );
}
