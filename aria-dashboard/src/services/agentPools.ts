import { env } from '../config/env';
import { type ClaudeFeedPool } from './claude';

export interface AgentPoolRaw {
  protocol: string;
  poolAddress: string;
  tokenIn: string;
  apyBps: number;
  liquidityScore: number;
  scannedAt: string;
}

// "Agni Finance WETH/USDT" → { name: "WETH/USDT", protocolName: "Agni Finance" }
function splitProtocol(protocol: string): { name: string; protocolName: string } {
  const slashIdx = protocol.split(' ').findIndex(p => p.includes('/'));
  if (slashIdx >= 0) {
    const parts = protocol.split(' ');
    return {
      name:         parts.slice(slashIdx).join(' '),
      protocolName: parts.slice(0, slashIdx).join(' '),
    };
  }
  return { name: protocol, protocolName: protocol };
}

// Map liquidity stability score to a human label shown in the TVL column
function liquidityLabel(score: number): string {
  if (score >= 0.80) return 'High';
  if (score >= 0.60) return 'Medium';
  return 'Low';
}

export async function fetchAgentPools(): Promise<ClaudeFeedPool[] | null> {
  if (!env.FEED_URL) return null;
  try {
    const res = await fetch(`${env.FEED_URL}/pools`, {
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return null;
    const raw: AgentPoolRaw[] = await res.json();
    if (!Array.isArray(raw) || raw.length === 0) return null;

    return raw.map(p => {
      const { name, protocolName } = splitProtocol(p.protocol);
      return {
        name,
        protocol:    protocolName,
        apy:         `${(p.apyBps / 100).toFixed(2)}%`,
        tvl:         liquidityLabel(p.liquidityScore),
        incentivized: false,
        isLive:       true,
      };
    });
  } catch {
    return null;
  }
}

// Compute average APY in percent from raw agent pool data
export async function fetchBlendedApy(): Promise<number | null> {
  if (!env.FEED_URL) return null;
  try {
    const res = await fetch(`${env.FEED_URL}/pools`, {
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return null;
    const raw: AgentPoolRaw[] = await res.json();
    if (!Array.isArray(raw) || raw.length === 0) return null;
    const total = raw.reduce((sum, p) => sum + p.apyBps, 0);
    return (total / raw.length) / 100; // return as percent
  } catch {
    return null;
  }
}
