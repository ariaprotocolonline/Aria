import Anthropic from '@anthropic-ai/sdk';
import { ANTHROPIC_API_KEY } from './config';
import { type ReallocationDecision } from './agent';
import { type ExecutionResult } from './executor';
import { sanitizeUserInput, validateAgentResponse } from './security';

const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `You are ARIA, an autonomous RWA agent. You write activity feed entries.

Rules:
- Maximum 2 sentences, no exceptions
- No dashes, no emojis, no technical terms
- State what happened and why in plain English
- Example good response: "Moved your WETH to Agni Finance for a higher yield. Liquidity in the previous pool was thinning."
- Example bad response: "ARIA has successfully executed a reallocation transaction --- moving funds from pool 0x123... to optimize yield based on APY differential analysis"
- Never mention contract addresses, transaction hashes, gas, or any infrastructure detail`;

const FALLBACK_EXPLANATION = 'ARIA completed a reallocation. Details unavailable.';
const FALLBACK_NO_ACTION   = 'No reallocation was triggered this cycle.';

export async function generateExplanation(
  decision: ReallocationDecision,
  result: ExecutionResult
): Promise<string> {
  const { opportunity, currentApyBps, amount } = decision;
  const amountFormatted = (Number(amount) / 1e18).toFixed(4);

  // Sanitize all agent-generated fields before sending to Claude
  const sanitizedReason   = sanitizeUserInput(decision.reason);
  const sanitizedProtocol = sanitizeUserInput(opportunity?.protocol ?? 'unknown');

  try {
    const message = await anthropic.messages.create({
      model: process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-6',
      max_tokens: 150,
      system: [
        {
          type: 'text',
          text: SYSTEM_PROMPT,
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Explain this reallocation:
Protocol: ${sanitizedProtocol}
Amount: ${amountFormatted} tokens
Previous APY: ${(currentApyBps / 100).toFixed(2)}%
New APY: ${((opportunity?.apyBps ?? 0) / 100).toFixed(2)}%
Tx hash: ${result.txHash}
Reason: ${sanitizedReason}`,
            },
          ],
        },
      ],
    });

    const block = message.content[0];
    const text  = block.type === 'text' ? block.text : '';

    const check = validateAgentResponse(text);
    if (!check.safe) {
      console.error(`[SECURITY] Blocked agent explanation: ${check.reason}`);
      return FALLBACK_EXPLANATION;
    }

    return text || FALLBACK_EXPLANATION;
  } catch (err) {
    console.error('[explainer] generateExplanation error:', err);
    return FALLBACK_EXPLANATION;
  }
}

export async function generateNoActionExplanation(decision: ReallocationDecision): Promise<string> {
  const sanitizedReason = sanitizeUserInput(decision.reason);

  try {
    const message = await anthropic.messages.create({
      model: process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-6',
      max_tokens: 100,
      system: [
        {
          type: 'text',
          text: SYSTEM_PROMPT,
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [
        {
          role: 'user',
          content: `No reallocation was made this cycle. Reason: ${sanitizedReason}. Write one sentence about what ARIA is monitoring. Example: "Your position looks healthy — no better opportunities detected right now." Never say "no structured decision was returned" or mention pipeline, cycle, or system errors.`,
        },
      ],
    });

    const block = message.content[0];
    const text  = block.type === 'text' ? block.text : '';

    const check = validateAgentResponse(text);
    if (!check.safe) {
      console.error(`[SECURITY] Blocked no-action explanation: ${check.reason}`);
      return FALLBACK_NO_ACTION;
    }

    return text || FALLBACK_NO_ACTION;
  } catch (err) {
    console.error('[explainer] generateNoActionExplanation error:', err);
    return FALLBACK_NO_ACTION;
  }
}
