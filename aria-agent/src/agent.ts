import Anthropic from '@anthropic-ai/sdk';
import { type Address, parseAbi } from 'viem';
import { publicClient, VAULT_ADDRESS, RISK_PROFILE, ANTHROPIC_API_KEY } from './config';
import { getYieldOpportunities, type Opportunity } from './yield';
import { validateAgentResponse } from './security';
import { getMemorySummary, getRecentMemory } from './memory';

const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

export interface ReallocationDecision {
  shouldReallocate: boolean;
  opportunity: Opportunity | null;
  currentApyBps: number;
  vaultTokenIn: Address;
  amount: bigint;
  reason: string;
  claudeConfidence?: number;
  claudeUrgency?: 'low' | 'medium' | 'high';
  scannedOpportunities?: Opportunity[];
}

// ── System prompt for the agent analysis cycle ─────────────────────────────
// This is NOT the chat system prompt. This is only used when the agent loop
// calls Claude to analyze onchain data and produce a reallocation decision.
// Claude talks. Code validates. Chain executes.

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

// ── Vault ABI ──────────────────────────────────────────────────────────────

const VAULT_ABI = parseAbi([
  'function getBalance(address token) external view returns (uint256)',
  'function paused() external view returns (bool)',
]);

// ── Risk profile thresholds ────────────────────────────────────────────────
// minLiquidityScore: floor below which a pool is rejected regardless of APY
// minImprovementBps: minimum APY gain required to trigger reallocation

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

// ── Helpers ────────────────────────────────────────────────────────────────

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

async function getVaultBalances(tokenAddresses: Address[]): Promise<Map<Address, bigint>> {
  const unique = [...new Set(tokenAddresses.map(a => a.toLowerCase() as Address))];
  const entries = await Promise.all(
    unique.map(async (token) => {
      try {
        const balance = await publicClient.readContract({
          address: VAULT_ADDRESS,
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

// ── Claude decision block type ─────────────────────────────────────────────

interface ClaudeDecision {
  action: string;
  fromProtocol: string | null;
  toProtocol: string;
  toPoolAddress: string;
  reason: string;
  apyImprovementBps: number;
  liquidityScoreCurrent: number;
  liquidityScoreNew: number;
  confidence: number;
  urgency: 'low' | 'medium' | 'high';
}

// ── Main cycle ─────────────────────────────────────────────────────────────

export async function runCycle(): Promise<ReallocationDecision> {
  // 1. Bail early if vault is paused
  const isPaused = await publicClient.readContract({
    address: VAULT_ADDRESS,
    abi: VAULT_ABI,
    functionName: 'paused',
  });

  if (isPaused) return noOp('Vault is paused');

  // 2. Gather live onchain data
  const opportunities = await getYieldOpportunities();
  if (opportunities.length === 0) return noOp('No pool data available');
  const withOpps = (d: ReallocationDecision): ReallocationDecision => ({ ...d, scannedOpportunities: opportunities });

  const tokenAddresses = opportunities.map(o => o.tokenIn);
  const vaultBalances  = await getVaultBalances(tokenAddresses);

  // 3. Build analysis prompt with real data — Claude sees the full picture
  const poolSummary = opportunities
    .map(o => {
      const balance = vaultBalances.get(o.tokenIn.toLowerCase() as Address) ?? 0n;
      return (
        `Protocol: ${o.protocol}\n` +
        `Pool address: ${o.poolAddress}\n` +
        `Token: ${o.tokenIn}\n` +
        `APY: ${(o.apyBps / 100).toFixed(2)}%\n` +
        `Liquidity score: ${o.liquidityScore.toFixed(3)}\n` +
        `Vault balance of this token: ${(Number(balance) / 1e18).toFixed(6)}`
      );
    })
    .join('\n\n');

  const memorySummary = getMemorySummary();
  const recentDecisions = getRecentMemory(5)
    .map(e => `${e.timestamp}: ${e.decision.reason} → ${e.outcome.executed ? 'executed' : 'held'}`)
    .join('\n');

  const analysisPrompt =
    `${memorySummary}\n\nRecent decisions:\n${recentDecisions || 'None yet.'}\n\n` +
    `Live Mantle pool data — analyze and recommend:\n\n${poolSummary}\n\n` +
    `Risk profile: ${RISK_PROFILE}\n` +
    `Based on this data, what is your recommendation? Return analysis and a <decision> block.`;

  // 4. Ask Claude to analyze — this is genuine AI intelligence, not chat
  const response = await anthropic.messages.create({
    model: process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-6',
    max_tokens: 1000,
    system: AGENT_ANALYSIS_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: analysisPrompt }],
  });

  const text = response.content[0]?.type === 'text' ? response.content[0].text : '';

  // 5. Validate response before parsing — blocks leaking secrets
  const responseCheck = validateAgentResponse(text);
  if (!responseCheck.safe) {
    console.error(`[SECURITY] Agent response blocked: ${responseCheck.reason}`);
    return withOpps(noOp('Response failed security validation'));
  }

  // 6. Parse the <decision> block
  const decisionMatch = text.match(/<decision>([\s\S]*?)<\/decision>/);
  if (!decisionMatch) {
    console.warn('[agent] No <decision> block in Claude response — holding');
    return withOpps(noOp('No structured decision returned'));
  }

  let claudeDecision: ClaudeDecision;
  try {
    claudeDecision = JSON.parse(decisionMatch[1].trim());
  } catch {
    console.warn('[agent] Malformed <decision> JSON — holding');
    return withOpps(noOp('Could not parse decision block'));
  }

  // 7. If Claude recommends hold or alert — respect it
  if (claudeDecision.action !== 'reallocate') {
    return withOpps(noOp(claudeDecision.reason ?? 'Claude recommends holding'));
  }

  // ── From here: code enforces every safety gate ─────────────────────────────
  // Claude's recommendation only executes if ALL checks below pass.

  // 8. Target protocol must come from our hard-coded approved pool list
  const targetPool = opportunities.find(
    o => o.protocol === claudeDecision.toProtocol
  );
  if (!targetPool) {
    console.warn(`[agent] SECURITY: Claude recommended unknown protocol "${claudeDecision.toProtocol}" — blocked`);
    return withOpps(noOp(`Recommended protocol "${claudeDecision.toProtocol}" not in approved list`));
  }

  // 9. Liquidity score must meet the profile floor
  const liquidityFloor = PROFILE_FLOORS[RISK_PROFILE];
  if (targetPool.liquidityScore < liquidityFloor) {
    return withOpps(noOp(
      `Liquidity score ${targetPool.liquidityScore.toFixed(3)} below ${RISK_PROFILE} floor ${liquidityFloor}`,
      targetPool
    ));
  }

  // 10. APY improvement must meet the profile minimum threshold
  const improvementThreshold = PROFILE_THRESHOLDS[RISK_PROFILE];
  if (claudeDecision.apyImprovementBps < improvementThreshold) {
    return withOpps(noOp(
      `APY improvement ${claudeDecision.apyImprovementBps}bps below ${RISK_PROFILE} threshold ${improvementThreshold}bps`,
      targetPool
    ));
  }

  // 11. Vault must actually hold a balance of the required token
  const vaultBalance = vaultBalances.get(targetPool.tokenIn.toLowerCase() as Address) ?? 0n;
  if (vaultBalance === 0n) {
    return withOpps(noOp('Vault has no balance in the required token', targetPool));
  }

  // 12. All gates passed — return decision for execution
  const currentApyBps = targetPool.apyBps - claudeDecision.apyImprovementBps;

  return withOpps({
    shouldReallocate: true,
    opportunity:      targetPool,
    currentApyBps,
    vaultTokenIn:     targetPool.tokenIn,
    amount:           vaultBalance,
    reason:           claudeDecision.reason,
    claudeConfidence: claudeDecision.confidence,
    claudeUrgency:    claudeDecision.urgency,
  });
}
