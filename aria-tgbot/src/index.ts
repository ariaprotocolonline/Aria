import http   from 'http';
import dotenv from 'dotenv';
import path   from 'path';
import {
  sendMessage, setWebhook, deleteWebhook, getUpdates,
  formatAction, formatAlert, formatWelcome, formatOnboarding,
} from './telegram';
import {
  linkWallet, unlinkWallet, getChatId, getWalletByChatId,
  isConnected, getUser, generateCode, savePendingLink, consumePendingLink,
} from './storage';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const PORT            = parseInt(process.env.TG_PORT ?? '3003', 10);
const INTERNAL_TOKEN  = process.env.INTERNAL_SECRET ?? '';
const BOT_USERNAME    = process.env.TELEGRAM_BOT_USERNAME ?? 'AriaRWAbot';
const WEBHOOK_SECRET  = process.env.TELEGRAM_WEBHOOK_SECRET ?? '';
const ARIA_SERVER    = process.env.ARIA_SERVER_URL ?? 'http://127.0.0.1:3002';
const WALLET_RE      = /^0x[0-9a-fA-F]{40}$/;

// Blockchain config resolved inside getVaultContext (network-aware)

const log = (msg: string) => console.log(`[${new Date().toISOString()}] ${msg}`);

// ─── Vault context cache ──────────────────────────────────────────────────────
// RPC calls to fetch balances take 4-8s. Cache per-wallet for 2 min so only
// the first message in a conversation pays the latency cost.

interface VaultCacheEntry { value: string | null; expiresAt: number }
const vaultContextCache = new Map<string, VaultCacheEntry>();
const VAULT_CACHE_TTL   = 120_000; // 2 minutes

// ─── Live vault balance via raw JSON-RPC ──────────────────────────────────────
// Uses eth_call so no library is needed — plain fetch to Mantle RPC.

function padAddr(addr: string): string {
  return '000000000000000000000000' + addr.replace('0x', '').toLowerCase();
}

async function ethCall(rpc: string, to: string, data: string): Promise<string> {
  const res = await fetch(rpc, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_call', params: [{ to, data }, 'latest'] }),
    signal:  AbortSignal.timeout(8_000),
  });
  const json = await res.json() as { result?: string; error?: { message: string } };
  if (json.error) throw new Error(json.error.message);
  return json.result ?? '0x0';
}

function formatUnits(hex: string, decimals: number): string {
  const raw     = BigInt(hex === '0x' ? '0x0' : hex);
  const divisor = 10n ** BigInt(decimals);
  const whole   = raw / divisor;
  const frac    = raw % divisor;
  const fracStr = frac.toString().padStart(decimals, '0').slice(0, 4).replace(/0+$/, '') || '0';
  return `${whole}.${fracStr}`;
}

async function fetchVaultContextFromRPC(walletAddress: string): Promise<string | null> {
  // Prefer mainnet factory; fall back to testnet for local dev
  const isMainnet   = !!process.env.FACTORY_ADDRESS;
  const factoryAddr = process.env.FACTORY_ADDRESS || process.env.VITE_FACTORY_ADDRESS_TESTNET || '';
  if (!factoryAddr) return null;

  const rpc      = isMainnet
    ? (process.env.MANTLE_RPC          ?? 'https://rpc.mantle.xyz')
    : (process.env.MANTLE_TESTNET_RPC  ?? 'https://rpc.sepolia.mantle.xyz');
  const wethAddr = (isMainnet
    ? process.env.VITE_WETH_ADDRESS_MAINNET
    : process.env.VITE_WETH_ADDRESS_TESTNET) ?? '';
  const usdcAddr = (isMainnet
    ? process.env.VITE_USDC_ADDRESS_MAINNET
    : process.env.VITE_USDC_ADDRESS_TESTNET) ?? '';
  if (!wethAddr || !usdcAddr) return null;

  // Inner eth_call bound to the resolved network
  const call = async (to: string, data: string) => ethCall(rpc, to, data);

  // Fallback vault: single-vault override (VAULT_ADDRESS for mainnet, VITE_VAULT_ADDRESS_TESTNET for testnet)
  const PLACEHOLDER = new Set(['0x0000000000000000000000000000000000000000', '0x0000000000000000000000000000000000000001']);
  const vaultOverride = isMainnet
    ? (process.env.VAULT_ADDRESS ?? '')
    : (process.env.VITE_VAULT_ADDRESS_TESTNET ?? '');
  const hasOverride = WALLET_RE.test(vaultOverride) && !PLACEHOLDER.has(vaultOverride.toLowerCase());

  const network = isMainnet ? 'Mantle mainnet' : 'Mantle testnet';

  try {
    // factory.getVault(address) selector: 0x0eb9af38
    const vaultHex = await call(factoryAddr, '0x0eb9af38' + padAddr(walletAddress));
    let vault      = '0x' + vaultHex.slice(-40);

    if (vault === '0x' + '0'.repeat(40)) {
      // No per-user vault found — try single-vault override
      if (hasOverride) {
        vault = vaultOverride;
      } else {
        return 'LIVE VAULT STATE: No vault deployed for this wallet yet. Connect your wallet on the ARIA dashboard to create your vault.';
      }
    }

    // vault.getBalance(address token) selector: 0xf8b2cb4f
    const [wethHex, usdcHex] = await Promise.all([
      call(vault, '0xf8b2cb4f' + padAddr(wethAddr)),
      call(vault, '0xf8b2cb4f' + padAddr(usdcAddr)),
    ]);
    const weth = formatUnits(wethHex, 18);
    const usdc = formatUnits(usdcHex, 6);
    return `LIVE VAULT STATE (fetched from ${network} — use these exact numbers for balance questions):\nVault address: ${vault}\nWETH balance: ${weth} WETH\nUSDC balance: ${usdc} USDC`;
  } catch {
    return null; // non-critical — skip if RPC unavailable
  }
}

async function getVaultContext(walletAddress: string): Promise<string | null> {
  const cached = vaultContextCache.get(walletAddress);
  if (cached && Date.now() < cached.expiresAt) return cached.value;
  const value = await fetchVaultContextFromRPC(walletAddress);
  vaultContextCache.set(walletAddress, { value, expiresAt: Date.now() + VAULT_CACHE_TTL });
  return value;
}

// ─── Claude proxy — send user message to aria-server and get reply ────────────

async function askClaude(walletAddress: string, userText: string): Promise<string> {
  const portfolioCtx = await getVaultContext(walletAddress).catch(() => null);
  try {
    const res = await fetch(`${ARIA_SERVER}/api/chat`, {
      method:  'POST',
      headers: {
        'Content-Type':     'application/json',
        'X-Internal-Token': INTERNAL_TOKEN,
      },
      body: JSON.stringify({
        walletAddress,
        messages:        [{ role: 'user', content: userText }],
        max_tokens:      350,
        portfolioContext: portfolioCtx ?? undefined,
      }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) return 'ARIA is temporarily unavailable. Try again shortly.';
    const data = await res.json() as { content?: { type: string; text: string }[] };
    return data.content?.[0]?.text ?? 'ARIA is temporarily unavailable.';
  } catch {
    return 'ARIA is temporarily unavailable. Try again shortly.';
  }
}

// ─── Telegram update handler ──────────────────────────────────────────────────

async function handleUpdate(body: string): Promise<void> {
  let update: {
    message?: { chat: { id: number }; from?: { username?: string }; text?: string };
  };
  try { update = JSON.parse(body); } catch { return; }

  const msg = update?.message;
  if (!msg?.text) return;

  const chatId   = msg.chat.id;
  const text     = msg.text.trim();
  const username = msg.from?.username;

  // /start <code>
  if (text.startsWith('/start')) {
    const code = text.split(' ')[1]?.trim();
    if (!code) {
      await sendMessage(chatId,
        '👋 Welcome to ARIA.\n\n' +
        'To get started, open the dashboard and connect your wallet there first.\n\n' +
        '🔗 <a href="https://ariaprotocol.online">ariaprotocol.online</a>\n\n' +
        '<i>Once connected, go to Settings and tap "Connect Telegram" to link this chat to your vault.</i>'
      );
      return;
    }
    const wallet = consumePendingLink(code);
    if (!wallet) {
      await sendMessage(chatId, '❌ Link expired or invalid. Generate a new one from the ARIA dashboard.');
      return;
    }
    linkWallet(wallet, chatId, username);
    log(`Linked wallet ${wallet} to chatId ${chatId}`);
    await sendMessage(chatId, formatWelcome(wallet));
    // Send the onboarding guide 1.5s later so it reads as a natural follow-up
    setTimeout(() => {
      sendMessage(chatId, formatOnboarding(wallet)).catch(() => {});
    }, 1_500);
    return;
  }

  // /status
  if (text === '/status') {
    const wallet = getWalletByChatId(chatId);
    if (!wallet) {
      await sendMessage(chatId,
        'No wallet linked to this chat yet.\n\n' +
        '🔗 <a href="https://ariaprotocol.online">ariaprotocol.online</a>\n\n' +
        '<i>Connect your wallet on the dashboard, then go to Settings and tap "Connect Telegram".</i>'
      );
      return;
    }
    await sendMessage(chatId, `✅ Connected to vault\n<code>${wallet}</code>\n\nARIA is monitoring your position.`);
    return;
  }

  // /disconnect
  if (text === '/disconnect') {
    const wallet = getWalletByChatId(chatId);
    if (!wallet) {
      await sendMessage(chatId,
        'No wallet linked to this chat.\n\n' +
        '🔗 <a href="https://ariaprotocol.online">ariaprotocol.online</a>'
      );
      return;
    }
    unlinkWallet(wallet);
    await sendMessage(chatId, '🔌 Disconnected. You will no longer receive ARIA notifications.');
    return;
  }

  // /help
  if (text === '/help') {
    await sendMessage(chatId,
      `🤖 <b>ARIA Bot</b>\n\n` +
      `/status — check your vault\n` +
      `/disconnect — unlink wallet\n` +
      `/help — this message\n\n` +
      `<i>Send any message to chat with ARIA directly.</i>`
    );
    return;
  }

  // Chat — forward to Claude via aria-server
  const wallet = getWalletByChatId(chatId);
  if (!wallet) {
    await sendMessage(chatId,
      'You need to connect your wallet before chatting with ARIA.\n\n' +
      '🔗 <a href="https://ariaprotocol.online">ariaprotocol.online</a>\n\n' +
      '<i>Once connected, go to Settings and tap "Connect Telegram" to link this chat.</i>'
    );
    return;
  }
  const reply = await askClaude(wallet, text);
  await sendMessage(chatId, reply);
}

// ─── HTTP server ──────────────────────────────────────────────────────────────

function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => { data += chunk; if (data.length > 65_536) req.destroy(); });
    req.on('end',   () => resolve(data));
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  const url    = req.url ?? '/';
  const method = req.method ?? 'GET';
  res.setHeader('Content-Type', 'application/json');

  // ── Health ──────────────────────────────────────────────────────────────────
  if (method === 'GET' && url === '/health') {
    res.writeHead(200);
    res.end(JSON.stringify({ status: 'ok', uptime: process.uptime() }));
    return;
  }

  // ── Telegram webhook (called by Telegram) ───────────────────────────────────
  if (method === 'POST' && url === '/webhook') {
    // Validate secret token if configured — rejects spoofed webhook requests
    if (WEBHOOK_SECRET) {
      const incoming = req.headers['x-telegram-bot-api-secret-token'];
      if (incoming !== WEBHOOK_SECRET) {
        log(`[Security] Webhook rejected — invalid or missing secret token`);
        res.writeHead(403); res.end('{}');
        return;
      }
    }
    res.writeHead(200); res.end('{}'); // Acknowledge immediately
    const body = await readBody(req).catch(() => '');
    handleUpdate(body).catch(() => {});
    return;
  }

  // ── Internal: notify (called by aria-agent, protected) ─────────────────────
  if (method === 'POST' && url === '/notify') {
    const token = req.headers['x-internal-token'];
    if (!INTERNAL_TOKEN || token !== INTERNAL_TOKEN) {
      res.writeHead(403); res.end(JSON.stringify({ error: 'Forbidden' })); return;
    }
    const body = await readBody(req).catch(() => '{}');
    const { walletAddress, type, text, txHash } = JSON.parse(body) as {
      walletAddress?: string; type?: string; text?: string; txHash?: string;
    };
    if (!walletAddress || !text) {
      res.writeHead(400); res.end(JSON.stringify({ error: 'Missing walletAddress or text' })); return;
    }
    const chatId = getChatId(walletAddress);
    if (!chatId) { res.end(JSON.stringify({ sent: false, reason: 'not linked' })); return; }
    const msg    = type === 'ALERT'  ? formatAlert(text)
                 : type === 'RAW'   ? text
                 : formatAction(text, txHash);
    const sent   = await sendMessage(chatId, msg);
    res.end(JSON.stringify({ sent }));
    return;
  }

  // ── API: generate link (called by dashboard via nginx proxy) ────────────────
  if (method === 'POST' && url === '/link') {
    const body   = await readBody(req).catch(() => '{}');
    const { walletAddress } = JSON.parse(body) as { walletAddress?: string };
    if (!walletAddress || !WALLET_RE.test(walletAddress)) {
      res.writeHead(400); res.end(JSON.stringify({ error: 'Invalid wallet address' })); return;
    }
    const code     = generateCode();
    savePendingLink(code, walletAddress);
    const deepLink = `https://t.me/${BOT_USERNAME}?start=${code}`;
    res.end(JSON.stringify({ code, deepLink }));
    return;
  }

  // ── API: status (called by dashboard via nginx proxy) ───────────────────────
  if (method === 'GET' && url.startsWith('/status/')) {
    const wallet = url.replace('/status/', '').toLowerCase();
    if (!WALLET_RE.test(wallet)) {
      res.writeHead(400); res.end(JSON.stringify({ error: 'Invalid wallet' })); return;
    }
    const connected = isConnected(wallet);
    const user      = connected ? getUser(wallet) : null;
    res.end(JSON.stringify({ connected, username: user?.username ?? null, linkedAt: user?.linkedAt ?? null }));
    return;
  }

  // ── API: disconnect (called by dashboard via nginx proxy) ───────────────────
  if (method === 'DELETE' && url === '/unlink') {
    const body   = await readBody(req).catch(() => '{}');
    const { walletAddress } = JSON.parse(body) as { walletAddress?: string };
    if (!walletAddress || !WALLET_RE.test(walletAddress)) {
      res.writeHead(400); res.end(JSON.stringify({ error: 'Invalid wallet' })); return;
    }
    const chatId = getChatId(walletAddress);
    unlinkWallet(walletAddress);
    if (chatId) sendMessage(chatId, '🔌 Disconnected from ARIA. Use /start to reconnect.').catch(() => {});
    res.end(JSON.stringify({ success: true }));
    return;
  }

  res.writeHead(404); res.end(JSON.stringify({ error: 'Not found' }));
});

// ─── Polling fallback ─────────────────────────────────────────────────────────
// Used when webhook registration fails (e.g. local dev with no public HTTPS URL).

async function startPolling(): Promise<void> {
  log('[Telegram] Starting long-poll mode (no webhook)');
  await deleteWebhook();
  let offset = 0;
  while (true) {
    try {
      const data = await getUpdates(offset);
      if (data.ok && data.result.length > 0) {
        for (const update of data.result) {
          offset = update.update_id + 1;
          if (update.message) {
            handleUpdate(JSON.stringify({ message: update.message })).catch(() => {});
          }
        }
      }
    } catch {
      // network blip — wait a moment then retry
      await new Promise(r => setTimeout(r, 3_000));
    }
  }
}

// ─── Start ────────────────────────────────────────────────────────────────────

server.listen(PORT, '127.0.0.1', async () => {
  log(`aria-tgbot running on 127.0.0.1:${PORT}`);
  log(`Bot: @${BOT_USERNAME}`);

  const webhookUrl = process.env.TELEGRAM_WEBHOOK_URL;
  if (process.env.TELEGRAM_BOT_TOKEN && webhookUrl) {
    const ok = await setWebhook(webhookUrl, WEBHOOK_SECRET || undefined);
    if (!ok) {
      // Webhook failed — fall back to polling so the bot still works locally
      startPolling().catch(() => {});
    }
  } else {
    log('TELEGRAM_WEBHOOK_URL not set — starting in poll mode');
    startPolling().catch(() => {});
  }
});

process.on('SIGINT',  () => { log('Shutting down'); server.close(); process.exit(0); });
process.on('SIGTERM', () => { log('Shutting down'); server.close(); process.exit(0); });
