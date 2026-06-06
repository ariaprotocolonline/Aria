import { type Address, parseAbi } from 'viem';
import { publicClient, RISK_PROFILE, DEEPSEEK_API_KEY, DEEPSEEK_MODEL } from './config';
import { getYieldOpportunities, type Opportunity, USDC_ADDRESS, XSTOCK_LABELS, XSTOCKS_ENABLED } from './yield';
import { validateAgentResponse, scanForInjection } from './security';
import { getMemorySummary, getRecentMemory } from './memory';
import { getElfaSignals, elfaSignalSummary } from './elfa';
import { getNansenPoolIntel, nansenIntelSummary } from './nansen';

export interface ReallocationDecision {
  shouldReallocate: boolean;
  opportunity: Opportunity | null;
  currentApyBps: number;
  vaultTokenIn: Address;
  amount: bigint;
  reason: string;
  claudeConfidence?: number;
  claudeUrgency?: 'low' | 'medium' | 'high';
  riskProfile?: string;
  scannedOpportunities?: Opportunity[];
}

const AGENT_ANALYSIS_SYSTEM_PROMPT = `\
You are ARIA's intelligence layer, analyzing live onchain data to produce reallocation decisions for WETH and USDC positions on Mantle.

Your job is to evaluate the provided pool data and return a structured decision. You are not executing anything — your output is validated by deterministic TypeScript code before anything touches the chain.

Always return your analysis followed by a JSON block in <decision> tags:
<decision>
{
  "action": "reallocate" | "hold" | "alert",
  "fromProtocol": "protocol name currently holding funds, or null",
  "toProtocol": "target protocol name",
  "toPoolAddress": "0x pool address",
  "reason": "concise plain-English explanation of the decision",
  "apyImprovementBps": number,
  "liquidityScoreCurrent": number between 0 and 1,
  "liquidityScoreNew": number between 0 and 1,
  "confidence": number between 0 and 1,
  "urgency": "low" | "medium" | "high"
}
</decision>

Rules:
- Only recommend protocols from the list provided. Do not invent addresses.
- If no reallocation is warranted, set action to "hold" with a clear reason.
- Liquidity score weights equally with APY — a 0.3 liquidity score pool should not be recommended even at high APY.
- Be conservative with confidence: 0.9+ only when data strongly supports the move.`;

const VAULT_ABI = parseAbi([
  'function getBalance(address token) external view returns (uint256)',
  'function paused() external view returns (bool)',
]);

const PROFILE_FLOORS: Record<string, number> = {
  Conservative: 0.70,
  Balanced:     0.55,
  Aggressive:   0.40,
};

const PROFILE_THRESHOLDS: Record<string, number> = {
  Conservative: 150,
  Balanced:     75,
  Aggressive:   40,
};

function noOp(reason: string, opportunity: Opportunity | null = null): ReallocationDecision {
  return {
    shouldReallocate: false,
    opportunity,
    currentApyBps: 0,
    vaultTokenIn: '0x0000000000000000000000000000000000000000',
    amount: 0n,
    reason,
  };
}

async function getVaultBalances(vaultAddress: Address, tokenAddresses: Address[]): Promise<Map<Address, bigint>> {
  const unique = [...new Set(tokenAddresses.map(a => a.toLowerCase() as Address))];
  const entries = await Promise.all(
    unique.map(async (token) => {
      try {
        const balance = await publicClient.readContract({
          address: vaultAddress,
          abi: VAULT_ABI,
          functionName: 'getBalance',
          args: [token],
        });
        return [token, balance] as [Address, bigint];
      } catch {
        return [token, 0n] as [Address, bigint];
      }
    })
  );
  return new Map(entries);
}

interface ClaudeDecision {
  action: string;
  fromProtocol: string | null;
  toProtocol: string;
  toPoolAddress: string;
  reason: string;
  liquidityScoreCurrent: number;
  liquidityScoreNew: number;
  confidence: number;
  urgency: 'low' | 'medium' | 'high';
}

// H7: Sanitize a memory string before injecting it into a Claude prompt.
// Returns the original if safe, or a redacted placeholder if suspicious.
function sanitizeForPrompt(input: string, label: string): string {
  const scan = scanForInjection(input);
  if (!scan.safe) {
    console.warn(`[agent] SECURITY: ${label} failed injection scan — redacted. Pattern: ${scan.pattern}`);
    return `[${label} redacted — content failed security scan]`;
  }
  return input;
}

// Per-vault hold cache: skip the Claude call when pool APYs and vault balances
// are identical to the last cycle that ended in a hold for that vault.
const holdCache = new Map<Address, { key: string; decision: ReallocationDecision }>();

// Accept pre-fetched opportunities to avoid a second RPC scan when the caller
// already has fresh data (e.g. index.ts fetches once for feed + decision).
export async function runCycle(vaultAddress: Address, prefetched?: Opportunity[]): Promise<ReallocationDecision> {
  const isPaused = await publicClient.readContract({
    address: vaultAddress,
    abi: VAULT_ABI,
    functionName: 'paused',
  });

  if (isPaused) return noOp('Vault is paused');

  const opportunities = prefetched ?? await getYieldOpportunities();
  if (opportunities.length === 0) return noOp('No pool data available');
  const withOpps = (d: ReallocationDecision): ReallocationDecision => ({ ...d, scannedOpportunities: opportunities });

  const tokenAddresses = opportunities.map(o => o.tokenIn);
  const vaultBalances  = await getVaultBalances(vaultAddress, tokenAddresses);

  // Skip Claude entirely if no assets are deployed — there is nothing to reallocate.
  const totalBalance = [...vaultBalances.values()].reduce((a, b) => a + b, 0n);
  if (totalBalance === 0n) return withOpps(noOp('No vault balance — skipping analysis'));

  // If pool APYs and vault balances are identical to the last cycle that held,
  // Claude would reach the same conclusion — skip the API call.
  const analysisKey = opportunities
    .map(o => `${o.protocol}:${o.apyBps}:${o.liquidityScore.toFixed(2)}`)
    .join('|') + `|${totalBalance.toString()}`;

  const cached = holdCache.get(vaultAddress);
  if (cached?.key === analysisKey) {
    return withOpps({ ...cached.decision, reason: cached.decision.reason + ' (market unchanged)' });
  }

  const poolSummary = opportunities
    .map(o => {
      const balance = vaultBalances.get(o.tokenIn.toLowerCase() as Address) ?? 0n;
      return (
        `Protocol: ${o.protocol}\n` +
        `Pool address: ${o.poolAddress}\n` +
        `Token: ${o.tokenIn}\n` +
        `APY: ${(o.apyBps / 100).toFixed(2)}%\n` +
        `Liquidity score: ${o.liquidityScore.toFixed(3)}\n` +
        `Vault balance of this token: ${
          o.tokenIn.toLowerCase() === USDC_ADDRESS.toLowerCase()
            ? (Number(balance) / 1e6).toFixed(2)
            : (Number(balance) / 1e18).toFixed(6)
        }`
      );
    })
    .join('\n\n');

  // H7: Scan and sanitize all memory content before injecting into the Claude prompt.
  const rawMemorySummary = getMemorySummary();
  const memorySummary = sanitizeForPrompt(rawMemorySummary, 'memory summary');

  const recentDecisions = getRecentMemory(5)
    .map(e => {
      const line = `${e.timestamp}: ${e.decision.reason} → ${e.outcome.executed ? 'executed' : 'held'}`;
      return sanitizeForPrompt(line, 'recent decision');
    })
    .join('\n');

  // C4: Derive current APY from the last executed reallocation recorded in memory.
  const lastExecuted = getRecentMemory(10).find(e => e.outcome.executed);
  const memoryTrackedCurrentApyBps = lastExecuted?.decision.apyImprovementBps ?? 0;

  // Fetch Elfa and Nansen intelligence in parallel — both are optional enhancements.
  // Failures are handled internally; nulls/empty arrays mean data is unavailable.
  const [elfaSignals, nansenData] = await Promise.all([
    getElfaSignals(),
    Promise.all(opportunities.map(o => getNansenPoolIntel(o.poolAddress))),
  ]);

  const elfaSummary  = elfaSignalSummary(elfaSignals);
  const nansenReport = nansenData.map(nansenIntelSummary).join('\n');

  // xStocks note — appended only when XSTOCKS_ENABLED is true so that placeholder
  // addresses never reach Claude during development.
  const xstocksNote = XSTOCKS_ENABLED
    ? `\n\nxStocks are available on Mantle via Fluxion DEX: ${Object.keys(XSTOCK_LABELS).join(', ')}. These are tokenized US equities trading 24/7, backed 1:1 by real securities. Conservative profiles should not hold xStocks. Balanced profiles may allocate up to 20%. Aggressive profiles may allocate up to 50%.`
    : '';

  const analysisPrompt =
    `${memorySummary}\n\nRecent decisions:\n${recentDecisions || 'None yet.'}\n\n` +
    `Elfa AI social + smart money signals:\n${elfaSummary}\n\n` +
    `Nansen pool intelligence:\n${nansenReport}\n\n` +
    `Live Mantle pool data — analyze and recommend:\n\n${poolSummary}\n\n` +
    `Risk profile: ${RISK_PROFILE}\n` +
    `Using the Elfa sentiment and Nansen smart money flows above alongside the onchain data, ` +
    `what is your recommendation? Return analysis and a <decision> block.` +
    xstocksNote;

  async function callAI(): Promise<string> {
    const attempt = async () => {
      const res = await fetch('https://api.deepseek.com/chat/completions', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${DEEPSEEK_API_KEY}` },
        body: JSON.stringify({
          model:      DEEPSEEK_MODEL,
          max_tokens: 1000,
          messages: [
            { role: 'system', content: AGENT_ANALYSIS_SYSTEM_PROMPT },
            { role: 'user',   content: analysisPrompt },
          ],
        }),
        signal: AbortSignal.timeout(45_000),
      });
      if (!res.ok) throw new Error(`DeepSeek ${res.status}: ${await res.text()}`);
      const data = await res.json() as { choices: { message: { content: string } }[] };
      const text = data.choices[0]?.message?.content ?? '';
      if (!text) throw new Error('DeepSeek returned empty response');
      return text;
    };

    try {
      const text = await attempt();
      console.log('[agent] AI provider: DeepSeek');
      return text;
    } catch (err) {
      console.warn(`[agent] DeepSeek failed — retrying once: ${err instanceof Error ? err.message : err}`);
      await new Promise(r => setTimeout(r, 2_000));
      const text = await attempt();
      console.log('[agent] AI provider: DeepSeek (retry)');
      return text;
    }
  }

  const text = await callAI();

  const responseCheck = validateAgentResponse(text);
  if (!responseCheck.safe) {
    console.error(`[SECURITY] Agent response blocked: ${responseCheck.reason}`);
    return withOpps(noOp('Response failed security validation'));
  }

  const decisionMatch = text.match(/<decision>([\s\S]*?)<\/decision>/);
  if (!decisionMatch) {
    console.warn('[agent] No <decision> block in Claude response — holding');
    return withOpps(noOp('No structured decision returned'));
  }

  let claudeDecision: ClaudeDecision;
  try {
    claudeDecision = JSON.parse(decisionMatch[1]!.trim());
  } catch {
    console.warn('[agent] Malformed <decision> JSON — holding');
    return withOpps(noOp('Could not parse decision block'));
  }

  // Validate and clamp numeric/enum fields — JSON.parse gives no type guarantees.
  if (typeof claudeDecision.confidence !== 'number' || isNaN(claudeDecision.confidence)) {
    claudeDecision.confidence = 0;
  } else {
    claudeDecision.confidence = Math.max(0, Math.min(1, claudeDecision.confidence));
  }
  if (!['low', 'medium', 'high'].includes(claudeDecision.urgency)) {
    claudeDecision.urgency = 'low';
  }
  if (typeof claudeDecision.liquidityScoreCurrent !== 'number') claudeDecision.liquidityScoreCurrent = 0;
  if (typeof claudeDecision.liquidityScoreNew     !== 'number') claudeDecision.liquidityScoreNew     = 0;
  if (typeof claudeDecision.reason !== 'string') claudeDecision.reason = '';
  if (typeof claudeDecision.toProtocol !== 'string') claudeDecision.toProtocol = '';

  if (claudeDecision.action !== 'reallocate') {
    const holdResult = withOpps(noOp(claudeDecision.reason ?? 'Claude recommends holding'));
    holdCache.set(vaultAddress, { key: analysisKey, decision: holdResult });
    return holdResult;
  }

  // All code-enforced safety gates below. Claude's recommendation only executes if ALL pass.

  const targetPool = opportunities.find(
    o => o.protocol === claudeDecision.toProtocol
  );
  if (!targetPool) {
    console.warn(`[agent] SECURITY: Claude recommended unknown protocol "${claudeDecision.toProtocol}" — blocked`);
    return withOpps(noOp(`Recommended protocol "${claudeDecision.toProtocol}" not in approved list`));
  }

  const liquidityFloor = PROFILE_FLOORS[RISK_PROFILE] ?? 0.55;
  if (targetPool.liquidityScore < liquidityFloor) {
    return withOpps(noOp(
      `Liquidity score ${targetPool.liquidityScore.toFixed(3)} below ${RISK_PROFILE} floor ${liquidityFloor}`,
      targetPool
    ));
  }

  // C4: Use memory-tracked APY as the authoritative baseline, not Claude's self-reported improvement.
  const actualImprovementBps = targetPool.apyBps - memoryTrackedCurrentApyBps;
  const improvementThreshold = PROFILE_THRESHOLDS[RISK_PROFILE] ?? 75;
  if (actualImprovementBps < improvementThreshold) {
    return withOpps(noOp(
      `APY improvement ${actualImprovementBps}bps (target ${targetPool.apyBps}bps vs tracked ${memoryTrackedCurrentApyBps}bps) below ${RISK_PROFILE} threshold ${improvementThreshold}bps`,
      targetPool
    ));
  }

  const vaultBalance = vaultBalances.get(targetPool.tokenIn.toLowerCase() as Address) ?? 0n;
  if (vaultBalance === 0n) {
    return withOpps(noOp('Vault has no balance in the required token', targetPool));
  }

  // Clear this vault's hold cache — reallocation warranted; re-analyse next cycle.
  holdCache.delete(vaultAddress);

  return withOpps({
    shouldReallocate: true,
    opportunity:      targetPool,
    currentApyBps:    memoryTrackedCurrentApyBps,
    vaultTokenIn:     targetPool.tokenIn,
    amount:           vaultBalance,
    reason:           claudeDecision.reason,
    claudeConfidence: claudeDecision.confidence,
    claudeUrgency:    claudeDecision.urgency,
  });
}
