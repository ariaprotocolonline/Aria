// config.ts calls requireEnv() at import time — missing AGENT_PRIVATE_KEY,
// VAULT_ADDRESS, or ANTHROPIC_API_KEY will throw before the agent runs.
import { CYCLE_INTERVAL_MS, RISK_PROFILE, VAULT_ADDRESS } from './config';
import { runCycle } from './agent';
import { getYieldOpportunities } from './yield';
import { executeReallocation, type ExecutionResult } from './executor';
import { generateExplanation, generateNoActionExplanation } from './explainer';
import { startFeedServer, addFeedItem, setLatestPools } from './feedServer';
import { addMemoryEntry } from './memory';

const FEED_PORT = parseInt(process.env.FEED_PORT ?? '3001', 10);

const log = (msg: string) =>
  console.log(`[${new Date().toISOString()}] ${msg}`);

let cycleCount = 0;

async function tick() {
  log(`Cycle start — risk: ${RISK_PROFILE}, vault: ${VAULT_ADDRESS}`);

  // Always publish real on-chain pool data first — independent of Claude availability
  try {
    const opportunities = await getYieldOpportunities();
    if (opportunities.length > 0) {
      setLatestPools(opportunities.map(o => ({
        protocol:       o.protocol,
        poolAddress:    o.poolAddress,
        tokenIn:        o.tokenIn,
        apyBps:         o.apyBps,
        liquidityScore: o.liquidityScore,
      })));
      log(`Pools published: ${opportunities.length} pools scanned`);
    }
  } catch (err) {
    log(`Pool scan failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  try {
    const decision = await runCycle();
    log(`Decision: ${decision.reason}`);

    let result: ExecutionResult | null = null;
    let explanation: string;

    if (decision.shouldReallocate && decision.opportunity) {
      result = await executeReallocation(decision);
      log(`Executed — tx: ${result.txHash}`);
      explanation = await generateExplanation(decision, result);
      log(`Activity: ${explanation}`);
      addFeedItem({ tag: 'ACTION', message: explanation });
    } else {
      explanation = await generateNoActionExplanation(decision);
      log(`Activity: ${explanation}`);
      const tag = decision.reason.toLowerCase().includes('alert') ? 'ALERT' : 'OPPORTUNITY';
      addFeedItem({ tag, message: explanation });
    }

    addMemoryEntry({
      cycleNumber: cycleCount++,
      timestamp: new Date().toISOString(),
      decision: {
        shouldReallocate: decision.shouldReallocate,
        fromProtocol: null,
        toProtocol: decision.opportunity?.protocol ?? null,
        reason: decision.reason,
        apyImprovementBps: decision.opportunity?.apyBps ?? 0,
        liquidityScore: decision.opportunity?.liquidityScore ?? 0,
        confidence: decision.claudeConfidence ?? 0,
      },
      outcome: {
        executed: !!result,
        txHash: result?.txHash,
        explanation,
      },
      marketContext: {
        riskProfile: RISK_PROFILE,
        vaultBalanceUsdy: '0',
        vaultBalanceMeth: '0',
        topOpportunityApy: decision.opportunity?.apyBps ?? 0,
        poolsScanned: 2,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log(`Error during cycle: ${msg}`);
    addFeedItem({ tag: 'ALERT', message: `Agent cycle error: ${msg}` });
  }
}

async function main() {
  log('ARIA agent starting…');
  log(`Vault:    ${VAULT_ADDRESS}`);
  log(`Profile:  ${RISK_PROFILE}`);
  log(`Interval: ${CYCLE_INTERVAL_MS}ms`);

  startFeedServer(FEED_PORT);

  // Run immediately, then on interval
  await tick();

  const timer = setInterval(tick, CYCLE_INTERVAL_MS);

  process.on('SIGINT', () => {
    log('Shutting down gracefully…');
    clearInterval(timer);
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    log('Shutting down gracefully…');
    clearInterval(timer);
    process.exit(0);
  });
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
