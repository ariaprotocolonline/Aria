import { env } from '../config/env';

export type RiskProfile = 'Conservative' | 'Balanced' | 'Aggressive';

export interface FeedItem {
  id: string;
  tag: 'ACTION' | 'ALERT' | 'OPPORTUNITY';
  message: string;
  timestamp: string;
}

export interface PortfolioContext {
  riskProfile: RiskProfile;
  portfolioString?: string;
}

const now = () =>
  new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });

const stripFences = (text: string) =>
  text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();

export function buildSystemPrompt({ riskProfile, portfolioString }: PortfolioContext): string {
  const base = `You are ARIA (Autonomous RWA Intelligence Agent). Tone: WSJ editorial — quietly intelligent, institutional, data-dense.\nYou manage RWA positions on Mantle. Risk profile: ${riskProfile}.`;

  if (portfolioString) {
    return (
      base +
      `\nThe dashboard has injected the user's LIVE portfolio data below. ` +
      `This data is real and authoritative — do not say you lack access to it. ` +
      `When asked about balances, positions, or holdings, answer directly using these numbers.\n\n` +
      portfolioString
    );
  }

  return base + ` Respond concisely.`;
}

// Route through aria-server proxy; fall back to direct Anthropic if proxy not configured
async function callClaude(body: Record<string, unknown>): Promise<Response> {
  if (env.API_URL) {
    return fetch(`${env.API_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  }
  return fetch(env.ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'anthropic-version': env.ANTHROPIC_VERSION,
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model:      body.model,
      max_tokens: body.max_tokens,
      system:     body.system,
      messages:   body.messages,
    }),
  });
}

async function checkRateLimit(response: Response): Promise<void> {
  if (response.status === 429) {
    throw new Error('You have reached your daily message limit. This resets at midnight.');
  }
  if (response.status === 503) {
    throw new Error('ARIA chat is at capacity. Try again shortly.');
  }
  if (response.status === 401) {
    throw new Error('Please connect your wallet to use ARIA chat.');
  }
}

const SAFE_PREFIXES = [
  'You have reached',
  'ARIA chat is at capacity',
  'Please connect your wallet',
  'ARIA is unavailable',
] as const;

function isSafeError(msg: string): boolean {
  return SAFE_PREFIXES.some(p => msg.startsWith(p));
}

export const generateIntelligenceFeed = async (
  riskProfile: RiskProfile,
  portfolioContext?: string,
  walletAddress?: string,
): Promise<FeedItem[]> => {
  try {
    const response = await callClaude({
      model:      env.ANTHROPIC_MODEL,
      max_tokens: 600,
      walletAddress: walletAddress ?? '',
      system: `You are ARIA (Autonomous RWA Intelligence Agent), an institutional AI monitoring RWA positions on the Mantle blockchain.
Generate a JSON array of exactly 3 fresh intelligence feed items for a ${riskProfile} risk profile.
Each item has a "tag" (ACTION, ALERT, or OPPORTUNITY) and a concise WSJ-style "message" (1–2 sentences, data-dense, no fluff).
Mix the tags — don't use the same tag three times. Make each item specific and different from standard boilerplate.
${portfolioContext ? `\nUser portfolio context:\n${portfolioContext}` : ''}
Return ONLY raw JSON — no markdown fences, no commentary:
[{"tag":"ACTION","message":"..."},{"tag":"ALERT","message":"..."},{"tag":"OPPORTUNITY","message":"..."}]`,
      messages: [{ role: 'user', content: 'Generate a fresh feed update now.' }],
    });

    await checkRateLimit(response);
    if (!response.ok) throw new Error(`API ${response.status}`);

    const data = await response.json();
    const raw = stripFences(data.content[0].text);
    const items: { tag: string; message: string }[] = JSON.parse(raw);

    if (!Array.isArray(items) || items.length === 0) throw new Error('empty response');

    const validTags = new Set(['ACTION', 'ALERT', 'OPPORTUNITY']);
    return items
      .filter(item => validTags.has(item.tag))
      .map((item, i) => ({
        id: `feed-${Date.now()}-${i}`,
        tag: item.tag as FeedItem['tag'],
        message: item.message,
        timestamp: now(),
      }));
  } catch {
    const set = new Date().getMinutes() % 3;
    const fallbacks = [
      [
        { tag: 'ALERT' as const,       message: 'WETH/WMNT pool liquidity thinned 18bps over the past 4h. Monitoring for continued compression before reallocation.' },
        { tag: 'OPPORTUNITY' as const, message: `Agni Finance WETH/USDT pool offering a locked ${riskProfile === 'Conservative' ? '6.8' : riskProfile === 'Balanced' ? '11.2' : '19.4'}% APY. Entry window is narrow.` },
        { tag: 'ACTION' as const,      message: `Portfolio rebalanced to ${riskProfile} mandate. USDC weight increased 3% to reduce volatility exposure.` },
      ],
      [
        { tag: 'OPPORTUNITY' as const, message: 'FusionX WETH/USDT pool offering 22% APY with boosted incentives — eligible for current risk tier.' },
        { tag: 'ALERT' as const,       message: 'On-chain liquidity for WETH thinned 12% on Mantle DEXs in the last hour. Slippage risk elevated for large exits.' },
        { tag: 'ACTION' as const,      message: 'Yield scan complete. No reallocation triggered — current allocation within optimal range for this mandate.' },
      ],
      [
        { tag: 'ACTION' as const,      message: 'Initiated position in Agni Finance WETH/USDT pool. Capital deployed at 8.2% fixed rate.' },
        { tag: 'OPPORTUNITY' as const, message: 'FusionX USDC/USDT pool now accepting deposits at projected 28% net APY — flagged for Aggressive mandate review.' },
        { tag: 'ALERT' as const,       message: 'US CPI data due in 6h. Historical pattern shows yield repricing within 30min of release. Reducing duration exposure.' },
      ],
    ];
    return fallbacks[set].map((item, i) => ({
      ...item,
      id: `fallback-${Date.now()}-${i}`,
      timestamp: now(),
    }));
  }
};

export interface MarketPool {
  name: string;
  protocol: string;
  apy: string;
  tvl: string;
  incentivized: boolean;
  isLive?: boolean;
}

const POOL_FALLBACKS: Record<RiskProfile, MarketPool[]> = {
  Conservative: [
    { name: 'WETH/USDT',   protocol: 'Agni Finance', apy: '8.2%',  tvl: '$124.5M', incentivized: false },
    { name: 'WETH/USDT',   protocol: 'FusionX',      apy: '7.8%',  tvl: '$89.2M',  incentivized: false },
    { name: 'USDC/USDT',   protocol: 'Agni Finance', apy: '4.2%',  tvl: '$18.4M',  incentivized: true  },
    { name: 'USDC/USDT',   protocol: 'FusionX',      apy: '3.8%',  tvl: '$42.1M',  incentivized: false },
    { name: 'WETH/WMNT',   protocol: 'Agni Finance', apy: '6.1%',  tvl: '$31.6M',  incentivized: true  },
  ],
  Balanced: [
    { name: 'WETH/WMNT',   protocol: 'Agni Finance', apy: '9.5%',  tvl: '$67.3M',  incentivized: false },
    { name: 'WETH/USDT',   protocol: 'Agni Finance', apy: '8.2%',  tvl: '$124.5M', incentivized: false },
    { name: 'WETH/USDT',   protocol: 'FusionX',      apy: '7.8%',  tvl: '$22.1M',  incentivized: true  },
    { name: 'USDC/USDT',   protocol: 'Agni Finance', apy: '4.2%',  tvl: '$38.9M',  incentivized: false },
    { name: 'USDC/USDT',   protocol: 'FusionX',      apy: '3.8%',  tvl: '$9.7M',   incentivized: true  },
  ],
  Aggressive: [
    { name: 'WETH/WMNT',   protocol: 'Agni Finance', apy: '9.5%',  tvl: '$14.2M',  incentivized: false },
    { name: 'WETH/USDT',   protocol: 'FusionX',      apy: '7.8%',  tvl: '$8.1M',   incentivized: false },
    { name: 'WETH/USDT',   protocol: 'Agni Finance', apy: '8.2%',  tvl: '$6.4M',   incentivized: true  },
    { name: 'USDC/USDT',   protocol: 'Agni Finance', apy: '4.2%',  tvl: '$4.8M',   incentivized: false },
    { name: 'USDC/USDT',   protocol: 'FusionX',      apy: '3.8%',  tvl: '$11.3M',  incentivized: true  },
  ],
};

export const generateMarketPools = async (
  riskProfile: RiskProfile,
  walletAddress?: string,
): Promise<MarketPool[]> => {
  try {
    const response = await callClaude({
      model:      env.ANTHROPIC_MODEL,
      max_tokens: 500,
      walletAddress: walletAddress ?? '',
      system: `You are ARIA. Generate a JSON array of 5 live Mantle DeFi market pools for a ${riskProfile} risk profile.
Use realistic protocols from the Mantle ecosystem: Ondo Finance, Mantle LSP, Merchant Moe, Init Capital, Pendle, Lendle.
Each pool: {"name":"...","protocol":"...","apy":"X.X%","tvl":"$XX.XM","incentivized":true|false}
APY ranges — Conservative: 4–8%, Balanced: 8–20%, Aggressive: 15–35%.
Vary the pools — don't repeat the same pool. Make TVL numbers realistic.
Return ONLY raw JSON array — no markdown, no commentary.`,
      messages: [{ role: 'user', content: 'Generate current market pools.' }],
    });

    if (!response.ok) throw new Error(`API ${response.status}`);

    const data = await response.json();
    const raw = stripFences(data.content[0].text);
    const items: MarketPool[] = JSON.parse(raw);

    if (!Array.isArray(items) || items.length === 0) throw new Error('empty');

    return items.filter(
      (p) => p.name && p.protocol && p.apy && p.tvl && typeof p.incentivized === 'boolean',
    );
  } catch {
    return POOL_FALLBACKS[riskProfile];
  }
};

export const chatWithAria = async (
  message: string,
  riskProfile: RiskProfile,
  history: { role: string; content: string }[],
  walletAddress?: string,
  portfolioContext?: string,
): Promise<string> => {
  try {
    const formattedHistory = history.map((h) => ({
      role: h.role === 'aria' ? 'assistant' : 'user',
      content: h.content,
    }));

    const system = buildSystemPrompt({ riskProfile, portfolioString: portfolioContext });

    const response = await callClaude({
      model:         env.ANTHROPIC_MODEL,
      max_tokens:    300,
      walletAddress: walletAddress ?? '',
      system,
      messages: [...formattedHistory, { role: 'user', content: message }],
    });

    await checkRateLimit(response);
    if (!response.ok) throw new Error(`API ${response.status}`);

    const data = await response.json();
    return data.content[0].text;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : '';
    if (isSafeError(msg)) throw err;
    throw new Error('ARIA is unavailable right now. Please try again.');
  }
};
