const NANSEN_BASE = 'https://api.nansen.ai/v1';
const NANSEN_KEY  = process.env.NANSEN_API_KEY;

export interface NansenPoolIntel {
  poolAddress:             string;
  smartMoneyInflow:        number;  // USD added by smart money wallets in last 24h
  smartMoneyOutflow:       number;  // USD removed by smart money wallets in last 24h
  mercenaryCapitalRatio:   number;  // 0–1: higher = more incentive/mercenary capital
  topHolderConcentration:  number;  // 0–1: higher = more concentrated ownership
  riskAdjustment:          number;  // multiplier for liquidity score: 0.5–1.2
}

export async function getNansenPoolIntel(poolAddress: string): Promise<NansenPoolIntel | null> {
  if (!NANSEN_KEY) {
    console.warn('[Nansen] No API key — skipping pool intel fetch');
    return null;
  }

  try {
    const res = await fetch(
      `${NANSEN_BASE}/pool/${poolAddress}?chain=mantle`,
      {
        headers: {
          'apiKey':        NANSEN_KEY,
          'Content-Type':  'application/json',
        },
        signal: AbortSignal.timeout(5_000),
      }
    );

    if (!res.ok) {
      console.warn(`[Nansen] Failed for ${poolAddress}: HTTP ${res.status}`);
      return null;
    }

    const data = await res.json() as Record<string, unknown>;

    const mercenaryRatio = typeof data.mercenaryCapitalRatio === 'number'
      ? Math.max(0, Math.min(1, data.mercenaryCapitalRatio))
      : 0.5;

    // Higher mercenary ratio = riskier pool = lower multiplier
    const riskAdjustment = Math.max(0.5, Math.min(1.2, 1.2 - mercenaryRatio * 0.7));

    return {
      poolAddress,
      smartMoneyInflow:       typeof data.smartMoneyInflow      === 'number' ? data.smartMoneyInflow      : 0,
      smartMoneyOutflow:      typeof data.smartMoneyOutflow     === 'number' ? data.smartMoneyOutflow     : 0,
      mercenaryCapitalRatio:  mercenaryRatio,
      topHolderConcentration: typeof data.topHolderConcentration === 'number'
        ? Math.max(0, Math.min(1, data.topHolderConcentration))
        : 0.5,
      riskAdjustment,
    };
  } catch (err) {
    console.warn('[Nansen] Pool intel fetch failed:', err instanceof Error ? err.message : err);
    return null;
  }
}

export function nansenIntelSummary(intel: NansenPoolIntel | null): string {
  if (!intel) return 'No Nansen data available.';
  const net = intel.smartMoneyInflow - intel.smartMoneyOutflow;
  return (
    `Pool ${intel.poolAddress.slice(0, 8)}…: ` +
    `smart_money_net=${net >= 0 ? '+' : ''}${net.toFixed(0)} USD, ` +
    `mercenary_ratio=${intel.mercenaryCapitalRatio.toFixed(2)}, ` +
    `concentration=${intel.topHolderConcentration.toFixed(2)}, ` +
    `risk_adj=${intel.riskAdjustment.toFixed(2)}`
  );
}
