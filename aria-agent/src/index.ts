// config.ts validates at import time — missing keys throw before the agent runs.
import { CYCLE_INTERVAL_MS, RISK_PROFILE, VAULT_ADDRESS, FACTORY_ADDRESS, publicClient } from './config';
import { runCycle } from './agent';
import { getYieldOpportunities, WETH_ADDRESS, USDC_ADDRESS } from './yield';
import { executeReallocation, type ExecutionResult } from './executor';
import { generateExplanation } from './explainer';
import { startFeedServer, addFeedItem, setLatestPools } from './feedServer';
import { addMemoryEntry } from './memory';
import { notifyAction, notifyAlert, notifyRaw, scheduleDailySummary, scheduleHourlyUpdate } from './notifier';
import { parseAbi, formatUnits, type Address } from 'viem';

const FEED_PORT = parseInt(process.env.FEED_PORT ?? '3001', 10);

const VAULT_BALANCE_ABI = parseAbi([
  'function getBalance(address token) external view returns (uint256)',
]);

const OWNER_ABI = parseAbi([
  'function owner() external view returns (address)',
]);

const FACTORY_ABI = parseAbi([
  'function totalVaults() external view returns (uint256)',
  'function allVaults(uint256 index) external view returns (address)',
]);

async function discoverVaults(): Promise<Address[]> {
  if (FACTORY_ADDRESS) {
    try {
      const total = await publicClient.readContract({
        address: FACTORY_ADDRESS,
        abi: FACTORY_ABI,
        functionName: 'totalVaults',
      });
      if (total === 0n) return [];
      const indices = Array.from({ length: Number(total) }, (_, i) => BigInt(i));
      const vaults = await Promise.all(
        indices.map(i =>
          publicClient.readContract({
            address: FACTORY_ADDRESS!,
            abi: FACTORY_ABI,
            functionName: 'allVaults',
            args: [i],
          })
        )
      );
      return vaults as Address[];
    } catch (err) {
      log(`[WARN] Factory vault discovery failed: ${err instanceof Error ? err.message : err}`);
    }
  }
  // Fallback: single vault override
  if (VAULT_ADDRESS) return [VAULT_ADDRESS];
  return [];
}

const log = (msg: string) =>
  console.log(`[${new Date().toISOString()}] ${msg}`);

function buildHourlyMessage(pools: { protocol: string; apyBps: number; liquidityScore: number }[]): string {
  const now = new Date().toLocaleTimeString('en-US', {
    hour: '2-digit', minute: '2-digit', timeZone: 'UTC', hour12: false,
  });
  const sorted = [...pools].sort((a, b) => b.apyBps - a.apyBps);
  const best   = sorted[0];
  const lines  = sorted.map(p => {
    const apy  = (p.apyBps / 100).toFixed(2);
    const qual = p.liquidityScore >= 0.75 ? '🟢' : p.liquidityScore >= 0.55 ? '🟡' : '🔴';
    return `${qual} <b>${p.protocol}</b>\n   APY <code>${apy}%</code> · Liquidity <code>${p.liquidityScore.toFixed(2)}/1.00</code>`;
  }).join('\n\n');

  return (
    `📊 <b>ARIA Market Update</b>  <i>${now} UTC</i>\n\n` +
    `<b>Live Liquidity Pools — Mantle</b>\n${lines}\n\n` +
    `<b>💡 How you benefit</b>\n` +
    `ARIA scans these pools every 5 minutes. When a better yield opportunity clears its safety gates — ` +
    `liquidity depth, APY improvement threshold, and protocol whitelist — it reallocates your WETH and USDC automatically.\n\n` +
    (best ? `Best current opportunity: <b>${best.protocol}</b> at <code>${(best.apyBps / 100).toFixed(2)}%</code> APY\n\n` : '') +
    `Your capital stays in your vault at all times. ARIA can only move funds between pre-approved protocols — it can never transfer funds to an external address.\n\n` +
    `<i>Reply /status to check your vault balance.</i>`
  );
}

let cycleCount = 0;

function formatNoActionMessage(reason: string): string {
  const r = reason.toLowerCase();
  if (r.includes('paused'))            return 'Vault paused — no reallocation performed. Monitoring for resumption.';
  if (r.includes('no vault balance'))  return 'No assets deposited yet. ARIA is ready when you deploy capital.';
  if (r.includes('no pool data'))      return 'Pool data unavailable this cycle. Monitoring will resume.';
  if (r.includes('market unchanged'))  return 'Market conditions stable. Holding current allocation.';
  if (r.includes('threshold') || r.includes('below')) return 'Yield improvement below mandate threshold — holding current position.';
  if (r.includes('liquidity'))         return 'Insufficient pool liquidity for this risk mandate — holding.';
  if (r.includes('balance'))           return 'No balance in required token — no reallocation needed.';
  return 'Monitoring market conditions. No reallocation needed this cycle.';
}

let tickRunning  = false;
let consecutiveErrors = 0;
let pausedUntil: number | null = null;

const WATCHDOG_MS    = 5 * 60_000;  // 5 minutes — kill a hung cycle
const MAX_ERRORS     = 5;           // pause after this many consecutive failures
const PAUSE_DURATION = 10 * 60_000; // 10-minute pause after max errors

async function tick() {
  // Pause mode — too many consecutive errors
  if (pausedUntil !== null) {
    if (Date.now() < pausedUntil) {
      log(`Paused after ${MAX_ERRORS} consecutive errors — resuming in ${Math.ceil((pausedUntil - Date.now()) / 1000)}s`);
      return;
    }
    log('Resuming after error pause');
    pausedUntil = null;
    consecutiveErrors = 0;
  }

  if (tickRunning) {
    log('Previous cycle still running — skipping this interval');
    return;
  }
  tickRunning = true;

  // Watchdog: forcibly abort if a cycle hangs for more than 5 minutes
  const watchdog = setTimeout(() => {
    log('[CRITICAL] Cycle watchdog fired — cycle took > 5 minutes, forcing reset');
    tickRunning = false;
  }, WATCHDOG_MS);

  try {
    log(`Cycle start — risk: ${RISK_PROFILE}`);

    // Fetch pool data once — reused for all vaults and the feed snapshot.
    let opportunities: Awaited<ReturnType<typeof getYieldOpportunities>> = [];
    try {
      opportunities = await getYieldOpportunities();
      if (opportunities.length > 0) {
        setLatestPools(opportunities.map(o => ({
          protocol:       o.protocol,
          poolAddress:    o.poolAddress,
          tokenIn:        o.tokenIn,
          apyBps:         o.apyBps,
          liquidityScore: o.liquidityScore,
        })));
        log(`Pools published: ${opportunities.length} pools scanned`);
        // Always publish a market snapshot to the feed so the dashboard shows activity
        const best = opportunities.reduce((a, b) => a.apyBps > b.apyBps ? a : b);
        addFeedItem({
          tag: 'OPPORTUNITY',
          message: `Scanned ${opportunities.length} pools on Mantle. Best yield: ${best.protocol} at ${(best.apyBps / 100).toFixed(2)}% APY (liquidity score ${best.liquidityScore.toFixed(2)}).`,
        });
      }
    } catch (err) {
      log(`Pool scan failed: ${err instanceof Error ? err.message : String(err)}`);
    }

    // Discover all active user vaults this cycle.
    const vaults = await discoverVaults();
    if (vaults.length === 0) {
      log('No vaults found — waiting for users to create vaults via the dashboard');
      addFeedItem({ tag: 'OPPORTUNITY', message: 'ARIA is online and scanning markets. No user vaults found yet — connect your wallet to get started.' });
      consecutiveErrors = 0;
      return;
    }
    log(`Managing ${vaults.length} vault(s): ${vaults.join(', ')}`);

    const vaultOwner = process.env.VAULT_OWNER_ADDRESS;

    // Run decision + execution for each vault independently.
    for (const vaultAddress of vaults) {
      try {
        const decision = await runCycle(vaultAddress, opportunities.length > 0 ? opportunities : undefined);
        log(`[${vaultAddress}] Decision: ${decision.reason}`);

        let result: ExecutionResult | null = null;
        let explanation: string;

        if (decision.shouldReallocate && decision.opportunity) {
          result = await executeReallocation(decision, vaultAddress);
          log(`[${vaultAddress}] Executed — tx: ${result.txHash}`);
          explanation = await generateExplanation(decision, result);
          log(`[${vaultAddress}] Activity: ${explanation}`);
          addFeedItem({ tag: 'ACTION', message: explanation });
          if (vaultOwner) {
            notifyAction(vaultOwner, explanation, result.txHash).catch(() => {});
          }
        } else {
          explanation = formatNoActionMessage(decision.reason);
          log(`[${vaultAddress}] Activity: ${explanation}`);
          const tag = decision.reason.toLowerCase().includes('alert') ? 'ALERT' : 'OPPORTUNITY';
          addFeedItem({ tag, message: explanation });
          if (vaultOwner && decision.reason.toLowerCase().includes('liquidity')) {
            notifyAlert(vaultOwner, `Liquidity warning: ${decision.reason}`).catch(() => {});
          }
        }

        // Read vault balances for memory context (best-effort).
        let vaultBalanceWeth = '0';
        let vaultBalanceUsdc = '0';
        try {
          const [wethBal, usdcBal] = await Promise.all([
            publicClient.readContract({ address: vaultAddress, abi: VAULT_BALANCE_ABI, functionName: 'getBalance', args: [WETH_ADDRESS] }),
            publicClient.readContract({ address: vaultAddress, abi: VAULT_BALANCE_ABI, functionName: 'getBalance', args: [USDC_ADDRESS] }),
          ]);
          vaultBalanceWeth = wethBal.toString();
          vaultBalanceUsdc = usdcBal.toString();
        } catch { /* non-critical */ }

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
            vaultBalanceWeth,
            vaultBalanceUsdc,
            topOpportunityApy: decision.opportunity?.apyBps ?? 0,
            poolsScanned: decision.scannedOpportunities?.length ?? 0,
          },
        });
      } catch (vaultErr) {
        log(`[${vaultAddress}] Vault cycle error: ${vaultErr instanceof Error ? vaultErr.message : String(vaultErr)}`);
        // One vault failing doesn't stop the rest.
      }
    }

    consecutiveErrors = 0; // reset on successful cycle
  } catch (err) {
    consecutiveErrors++;
    const raw = err instanceof Error ? err.message : String(err);
    log(`Error during cycle (${consecutiveErrors}/${MAX_ERRORS}): ${raw}`);
    const safeMsg = raw
      .replace(/0x[0-9a-fA-F]{40,}/g, '[addr]')
      .replace(/https?:\/\/\S+/g, '[url]')
      .slice(0, 120);
    addFeedItem({ tag: 'ALERT', message: `Agent error: ${safeMsg}` });

    if (consecutiveErrors >= MAX_ERRORS) {
      log(`[CRITICAL] ${MAX_ERRORS} consecutive cycle errors — pausing for ${PAUSE_DURATION / 60_000} minutes`);
      addFeedItem({ tag: 'ALERT', message: `ARIA paused after ${MAX_ERRORS} consecutive errors. Resuming in 10 minutes.` });
      pausedUntil = Date.now() + PAUSE_DURATION;
    }
  } finally {
    clearTimeout(watchdog);
    tickRunning = false;
  }
}

async function main() {
  log('ARIA agent starting…');
  log(`Factory: ${FACTORY_ADDRESS ?? '(not set)'}`);
  log(`Profile:  ${RISK_PROFILE}`);
  log(`Interval: ${CYCLE_INTERVAL_MS}ms`);

  // Startup health check — discover vaults and confirm RPC is reachable.
  try {
    log('Running startup vault discovery…');
    const vaults = await discoverVaults();
    if (vaults.length > 0) {
      log(`Found ${vaults.length} vault(s): ${vaults.join(', ')}`);
    } else {
      log('No vaults found yet — agent will check each cycle');
    }
  } catch (err) {
    log(`[WARN] Startup discovery failed: ${err instanceof Error ? err.message : err}`);
    log('Continuing anyway — will retry on first cycle');
  }

  startFeedServer(FEED_PORT);

  // Schedule daily Telegram summary at midnight UTC
  const vaultOwner = process.env.VAULT_OWNER_ADDRESS;
  if (vaultOwner) {
    scheduleDailySummary(async () => {
      try {
        const BALANCE_ABI = parseAbi(['function getBalance(address) external view returns (uint256)']);
        const vaults = await discoverVaults();
        let totalWeth = 0n, totalUsdc = 0n;
        for (const v of vaults) {
          const [w, u] = await Promise.all([
            publicClient.readContract({ address: v, abi: BALANCE_ABI, functionName: 'getBalance', args: [WETH_ADDRESS] }),
            publicClient.readContract({ address: v, abi: BALANCE_ABI, functionName: 'getBalance', args: [USDC_ADDRESS] }),
          ]);
          totalWeth += w; totalUsdc += u;
        }
        await notifyAction(vaultOwner,
          `Daily summary — ${vaults.length} vault(s) · WETH: ${formatUnits(totalWeth, 18)} · USDC: ${formatUnits(totalUsdc, 6)} · ARIA monitoring 24/7.`
        );
      } catch { /* non-critical */ }
    });
  }

  // Schedule hourly pool intelligence updates to all linked Telegram users
  scheduleHourlyUpdate(async () => {
    try {
      const pools = await getYieldOpportunities();
      if (pools.length === 0) return;
      const msg    = buildHourlyMessage(pools);
      const vaults = await discoverVaults();
      const ownersSeen = new Set<string>();
      for (const v of vaults) {
        try {
          const owner = await publicClient.readContract({ address: v, abi: OWNER_ABI, functionName: 'owner' }) as string;
          if (owner && !ownersSeen.has(owner.toLowerCase())) {
            ownersSeen.add(owner.toLowerCase());
            notifyRaw(owner, msg).catch(() => {});
          }
        } catch { /* vault may be paused or not yet active */ }
      }
      // Also notify single-vault owner if set and not already covered
      const envOwner = process.env.VAULT_OWNER_ADDRESS;
      if (envOwner && !ownersSeen.has(envOwner.toLowerCase())) {
        notifyRaw(envOwner, msg).catch(() => {});
      }
      log(`[Hourly] Sent pool update to ${ownersSeen.size} vault owner(s)`);
    } catch (err) {
      log(`[Hourly] Update failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  });

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
