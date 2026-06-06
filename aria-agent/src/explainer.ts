import { DEEPSEEK_API_KEY, DEEPSEEK_MODEL } from './config';
import { type ReallocationDecision } from './agent';
import { type ExecutionResult } from './executor';
import { sanitizeUserInput, validateAgentResponse } from './security';
import { USDC_ADDRESS } from './yield';

const SYSTEM_PROMPT = `You are ARIA, an autonomous RWA agent. You write activity feed entries.

Rules:
- Maximum 2 sentences, no exceptions
- No dashes, no emojis, no technical terms
- State what happened and why in plain English
- Example good response: "Moved your WETH to Agni Finance for a higher yield. Liquidity in the previous pool was thinning."
- Example bad response: "ARIA has successfully executed a reallocation transaction --- moving funds from pool 0x123... to optimize yield based on APY differential analysis"
- Never mention contract addresses, transaction hashes, gas, or any infrastructure detail`;

const FALLBACK_EXPLANATION = 'ARIA completed a reallocation. Details unavailable.';

// USDC uses 6 decimals; WETH and all other supported tokens use 18.
function formatTokenAmount(amount: bigint, tokenAddress: string): string {
  const isUsdc = tokenAddress.toLowerCase() === USDC_ADDRESS.toLowerCase();
  const divisor = isUsdc ? 1e6 : 1e18;
  return (Number(amount) / divisor).toFixed(isUsdc ? 2 : 4);
}

export async function generateExplanation(
  decision: ReallocationDecision,
  result: ExecutionResult
): Promise<string> {
  const { opportunity, currentApyBps, amount } = decision;
  const amountFormatted = formatTokenAmount(amount, opportunity?.tokenIn ?? '');

  // Sanitize all agent-generated fields before sending to Claude
  const sanitizedReason   = sanitizeUserInput(decision.reason);
  const sanitizedProtocol = sanitizeUserInput(opportunity?.protocol ?? 'unknown');

  const userPrompt =
    `Explain this reallocation:\n` +
    `Protocol: ${sanitizedProtocol}\n` +
    `Amount: ${amountFormatted} tokens\n` +
    `Previous APY: ${(currentApyBps / 100).toFixed(2)}%\n` +
    `New APY: ${((opportunity?.apyBps ?? 0) / 100).toFixed(2)}%\n` +
    `Reason: ${sanitizedReason}`;

  async function callDeepSeekExplainer(): Promise<string> {
    const res = await fetch('https://api.deepseek.com/chat/completions', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${DEEPSEEK_API_KEY}` },
      body: JSON.stringify({
        model:      DEEPSEEK_MODEL,
        max_tokens: 150,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user',   content: userPrompt },
        ],
      }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) throw new Error(`DeepSeek ${res.status}`);
    const data = await res.json() as { choices: { message: { content: string } }[] };
    return data.choices[0]?.message?.content ?? '';
  }

  try {
    let text = '';
    try {
      text = await callDeepSeekExplainer();
    } catch (err) {
      console.warn(`[explainer] DeepSeek failed — retrying once: ${err instanceof Error ? err.message : err}`);
      await new Promise(r => setTimeout(r, 2_000));
      text = await callDeepSeekExplainer();
    }

    const check = validateAgentResponse(text);
    if (!check.safe) {
      console.error(`[SECURITY] Blocked agent explanation: ${check.reason}`);
      return FALLBACK_EXPLANATION;
    }

    void result;

    // Enforce 300-character cap — truncate to nearest sentence boundary.
    let safe = text || FALLBACK_EXPLANATION;
    if (safe.length > 300) {
      const truncated = safe.slice(0, 300);
      const lastPeriod = truncated.lastIndexOf('.');
      safe = lastPeriod > 50 ? truncated.slice(0, lastPeriod + 1) : truncated.trimEnd() + '.';
    }
    return safe;
  } catch (err) {
    console.error('[explainer] generateExplanation error:', err);
    return FALLBACK_EXPLANATION;
  }
}

