import { WETH_ADDRESS, USDC_ADDRESS } from './yield';

const ELFA_BASE = 'https://api.elfa.ai/v1';
const ELFA_KEY  = process.env.ELFA_API_KEY;

export interface ElfaSignal {
  token:               string;
  sentiment:           'bullish' | 'bearish' | 'neutral';
  smartMoneyActivity:  'accumulating' | 'distributing' | 'neutral';
  mentionVelocity:     number;
  score:               number; // 0–1, higher is more bullish
}

export async function getElfaSignals(): Promise<ElfaSignal[]> {
  if (!ELFA_KEY) {
    console.warn('[Elfa] No API key — skipping signal fetch');
    return [];
  }

  const tokens  = [WETH_ADDRESS, USDC_ADDRESS];
  const results: ElfaSignal[] = [];

  for (const token of tokens) {
    try {
      const res = await fetch(
        `${ELFA_BASE}/signals?token=${token}&chain=mantle`,
        {
          headers: {
            'Authorization': `Bearer ${ELFA_KEY}`,
            'Content-Type':  'application/json',
          },
          signal: AbortSignal.timeout(5_000),
        }
      );

      if (!res.ok) {
        console.warn(`[Elfa] Failed for ${token}: HTTP ${res.status}`);
        continue;
      }

      const data = await res.json() as Record<string, unknown>;

      const sentiment = (['bullish','bearish','neutral'] as const)
        .includes(data.sentiment as never)
        ? (data.sentiment as ElfaSignal['sentiment'])
        : 'neutral';

      const smartMoneyActivity = (['accumulating','distributing','neutral'] as const)
        .includes(data.smartMoneyActivity as never)
        ? (data.smartMoneyActivity as ElfaSignal['smartMoneyActivity'])
        : 'neutral';

      results.push({
        token,
        sentiment,
        smartMoneyActivity,
        mentionVelocity: typeof data.mentionVelocity === 'number' ? data.mentionVelocity : 0,
        score:           typeof data.score           === 'number'
          ? Math.max(0, Math.min(1, data.score))
          : 0.5,
      });
    } catch (err) {
      console.warn(`[Elfa] Signal fetch failed for ${token}:`, err instanceof Error ? err.message : err);
    }
  }

  return results;
}

export function elfaSignalSummary(signals: ElfaSignal[]): string {
  if (signals.length === 0) return 'No Elfa signal data available.';
  return signals
    .map(s =>
      `${s.token.slice(0, 8)}…: sentiment=${s.sentiment}, ` +
      `smart_money=${s.smartMoneyActivity}, ` +
      `mention_velocity=${s.mentionVelocity}, ` +
      `score=${s.score.toFixed(2)}`
    )
    .join(' | ');
}
