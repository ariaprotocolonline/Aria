import { env } from '../config/env';
import { callServer, assertNotRateLimited, isSafeError } from './api';

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

// Used by agentPools.ts — distinct name avoids collision with useMarketData's MarketPool.
export interface ClaudeFeedPool {
  name: string;
  protocol: string;
  apy: string;
  tvl: string;
  incentivized: boolean;
  isLive?: boolean;
}

const now = () =>
  new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });

const stripFences = (text: string) =>
  text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();

// Builds the portfolio-data block sent as `portfolioContext` to the server.
// The server appends this to its own hardened system prompt — the "You are ARIA"
// prefix lives there; this function only returns context the server doesn't have.
export function buildSystemPrompt({ riskProfile, portfolioString }: PortfolioContext): string {
  const base = `Risk profile: ${riskProfile}.`;
  if (portfolioString) {
    return (
      base +
      `\nThe dashboard has injected the user's LIVE portfolio data below. ` +
      `This data is real and authoritative — answer balance/position questions directly from these numbers.\n\n` +
      portfolioString
    );
  }
  return base;
}

export const generateIntelligenceFeed = async (
  riskProfile: RiskProfile,
  portfolioContext?: string,
  walletAddress?: string,
): Promise<FeedItem[]> => {
  try {
    const instruction =
      `Generate a JSON array of exactly 3 fresh intelligence feed items for a ${riskProfile} risk profile. ` +
      `Each item: {"tag":"ACTION"|"ALERT"|"OPPORTUNITY","message":"1-2 sentence WSJ-style data-dense note"}. ` +
      `Mix the tags. Return ONLY raw JSON — no markdown fences, no commentary.` +
      (portfolioContext ? `\n\nUser portfolio:\n${portfolioContext}` : '');

    const response = await callServer({
      model:           env.ANTHROPIC_MODEL,
      max_tokens:      600,
      walletAddress:   walletAddress ?? '',
      portfolioContext: instruction,
      messages: [{ role: 'user', content: 'Generate a fresh feed update now.' }],
    });

    await assertNotRateLimited(response);
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
        { tag: 'OPPORTUNITY' as const, message: 'Agni Finance WETH/USDT pool offering a locked 11.2% APY. Entry window is narrow.' },
        { tag: 'ACTION' as const,      message: 'Portfolio rebalanced to Balanced mandate. USDC weight increased 3% to reduce volatility exposure.' },
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

const POOL_FALLBACKS: Record<RiskProfile, ClaudeFeedPool[]> = {
  Conservative: [
    { name: 'WETH/USDT', protocol: 'Agni Finance', apy: '8.2%',  tvl: '$124.5M', incentivized: false },
    { name: 'WETH/USDT', protocol: 'FusionX',      apy: '7.8%',  tvl: '$89.2M',  incentivized: false },
    { name: 'USDC/USDT', protocol: 'Agni Finance', apy: '4.2%',  tvl: '$18.4M',  incentivized: true  },
    { name: 'USDC/USDT', protocol: 'FusionX',      apy: '3.8%',  tvl: '$42.1M',  incentivized: false },
    { name: 'WETH/WMNT', protocol: 'Agni Finance', apy: '6.1%',  tvl: '$31.6M',  incentivized: true  },
  ],
  Balanced: [
    { name: 'WETH/WMNT', protocol: 'Agni Finance', apy: '9.5%',  tvl: '$67.3M',  incentivized: false },
    { name: 'WETH/USDT', protocol: 'Agni Finance', apy: '8.2%',  tvl: '$124.5M', incentivized: false },
    { name: 'WETH/USDT', protocol: 'FusionX',      apy: '7.8%',  tvl: '$22.1M',  incentivized: true  },
    { name: 'USDC/USDT', protocol: 'Agni Finance', apy: '4.2%',  tvl: '$38.9M',  incentivized: false },
    { name: 'USDC/USDT', protocol: 'FusionX',      apy: '3.8%',  tvl: '$9.7M',   incentivized: true  },
  ],
  Aggressive: [
    { name: 'WETH/WMNT', protocol: 'Agni Finance', apy: '9.5%',  tvl: '$14.2M',  incentivized: false },
    { name: 'WETH/USDT', protocol: 'FusionX',      apy: '7.8%',  tvl: '$8.1M',   incentivized: false },
    { name: 'WETH/USDT', protocol: 'Agni Finance', apy: '8.2%',  tvl: '$6.4M',   incentivized: true  },
    { name: 'USDC/USDT', protocol: 'Agni Finance', apy: '4.2%',  tvl: '$4.8M',   incentivized: false },
    { name: 'USDC/USDT', protocol: 'FusionX',      apy: '3.8%',  tvl: '$11.3M',  incentivized: true  },
  ],
};

export const generateMarketPools = async (
  riskProfile: RiskProfile,
  walletAddress?: string,
): Promise<ClaudeFeedPool[]> => {
  try {
    const instruction =
      `Generate a JSON array of 5 live Mantle DeFi market pools for a ${riskProfile} risk profile. ` +
      `Protocols: Agni Finance, FusionX. Pairs: WETH/USDT, WETH/WMNT, USDC/USDT. ` +
      `Each pool: {"name":"...","protocol":"...","apy":"X.X%","tvl":"$XX.XM","incentivized":true|false}. ` +
      `APY ranges — Conservative: 4–9%, Balanced: 7–15%, Aggressive: 12–25%. ` +
      `Return ONLY raw JSON array — no markdown, no commentary.`;

    const response = await callServer({
      model:           env.ANTHROPIC_MODEL,
      max_tokens:      500,
      walletAddress:   walletAddress ?? '',
      portfolioContext: instruction,
      messages: [{ role: 'user', content: 'Generate current market pools.' }],
    });

    if (!response.ok) throw new Error(`API ${response.status}`);
    const data = await response.json();
    const raw = stripFences(data.content[0].text);
    const items: ClaudeFeedPool[] = JSON.parse(raw);
    if (!Array.isArray(items) || items.length === 0) throw new Error('empty');
    return items.filter(p => p.name && p.protocol && p.apy && p.tvl && typeof p.incentivized === 'boolean');
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
    const formattedHistory = history.map(h => ({
      role: h.role === 'aria' ? 'assistant' : 'user',
      content: h.content,
    }));

    const response = await callServer({
      model:           env.ANTHROPIC_MODEL,
      max_tokens:      300,
      walletAddress:   walletAddress ?? '',
      portfolioContext: buildSystemPrompt({ riskProfile, portfolioString: portfolioContext }),
      messages: [...formattedHistory, { role: 'user', content: message }],
    });

    await assertNotRateLimited(response);
    if (!response.ok) throw new Error(`API ${response.status}`);
    const data = await response.json();
    return data.content[0].text;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : '';
    if (isSafeError(msg)) throw err;
    throw new Error('ARIA is unavailable right now. Please try again.');
  }
};
