# The Agent Loop

The ARIA agent is a Node.js process that runs continuously on the ARIA server. Every 5 minutes it wakes up, scans the market, consults Claude, validates the decision, and either executes a reallocation or records a hold with the reason. It runs this cycle independently for every user vault.

---

## Cycle Overview

```
tick()
  discoverVaults()          find all user vaults from factory
  for each vault:
    runCycle(vaultAddress)
      getYieldOpportunities()   fetch pool data
      getElfaSignals()          optional social signals
      getNansenPoolIntel()      optional smart money data
      callAI(prompt)            ask Claude for decision
      validateDecision()        safety gate checks
      if passes:
        executeReallocation()   submit transaction
      else:
        log hold with reason
```

---

## Vault Discovery

The agent reads `ARIAVaultFactory.allVaults[]` to get the list of every deployed vault across all users. It runs a separate yield cycle for each vault, applying that vault owner's risk profile to the decision. If the factory address is not configured, it falls back to a single vault address.

---

## Pool Data Collection

For each cycle, the agent fetches live data from all active pools. Each pool entry includes:

* Protocol name and router address
* Token pair (tokenIn and tokenOut)
* Pool address and fee tier
* Current APY (fetched via RPC or fallback estimate)
* Liquidity score (a 0 to 1 quality rating)

Custom pools added by the user through the dashboard Settings panel are included in the scan.

---

## Intelligence Enrichment

Two optional data sources run in parallel with pool data collection:

**Elfa AI signals** provide social and on-chain momentum data that Claude can factor into its decision. If the Elfa API key is not configured, this step is skipped silently.

**Nansen pool intelligence** provides smart money flow data and pool scoring. If the Nansen API key is not configured, this step is skipped silently.

Both are enrichments. The agent runs correctly without them.

---

## The Hold Cache

Before sending any prompt to Claude, the agent checks a per-vault hold cache. The cache key is built from the current pool APYs, liquidity scores, and vault balances. If the market state is identical to the last cycle that resulted in a hold decision, the agent skips the Claude API call entirely.

This eliminates token costs on stable markets and prevents Claude from being called repeatedly when there is nothing new to evaluate.

---

## Claude Integration

The agent sends a structured prompt to Claude containing:

* Full pool data with APYs and liquidity scores
* Elfa and Nansen signals (if available)
* Current vault balances (WETH and USDC)
* Active risk profile and its thresholds
* The last known APY from the previous reallocation
* xStocks context (if enabled)

Claude returns a response containing a `<decision>` JSON block. The agent extracts this block using a regex pattern and parses it into a structured decision object.

**Decision fields:**
* `action` reallocate or hold
* `protocol` target protocol name
* `tokenIn` source token
* `tokenOut` destination token
* `amount` amount to move (in token units)
* `confidence` Claude's confidence level (0 to 1)
* `urgency` low, medium, or high
* `newApyBps` projected APY in basis points
* `liquidityScore` reported pool quality
* `reasoning` plain-language explanation

---

## Safety Gate Validation

After parsing Claude's decision, the agent runs every check in code before proceeding:

**Protocol check.** The target protocol must exist in the known protocol list. Unknown protocol names are rejected.

**Liquidity floor check.** The reported liquidity score must meet the user's profile minimum (0.70 / 0.55 / 0.40). A score below the floor results in a hold.

**APY improvement check.** The new APY must exceed the stored APY from the last executed reallocation by the user's profile threshold (150 / 75 / 40 bps). Claude cannot self-report a higher baseline to justify unnecessary moves; the agent tracks the baseline independently.

**Balance check.** The vault must hold a non-zero balance of the required input token.

If any gate fails, the cycle records a hold with the specific reason and exits cleanly.

---

## Execution

When all safety gates pass, the agent calls `executeReallocation()` with the validated decision and the vault address.

The executor:

1. Fetches the current token price from DefiLlama to calculate the minimum acceptable output (`minAmountOut`)
2. Verifies the agent's MNT balance is above the minimum threshold (0.01 MNT)
3. Estimates gas using EIP-1559 parameters
4. Checks that the estimated gas price is below the 200 gwei ceiling
5. Adds a 20% gas buffer to the estimate
6. Constructs Uniswap V3 `exactInputSingle` calldata
7. Submits the `reallocate()` call on the user's vault
8. Waits for 2 block confirmations
9. Stores the confirmed APY as the new baseline for future cycles
10. Publishes an ACTION feed item and sends a Telegram notification

---

## Fault Tolerance

**Watchdog timer.** If a cycle takes longer than 5 minutes, a watchdog timer force-resets the running state so the next cycle can start. No single hung vault can block all others.

**Consecutive error limit.** If 5 consecutive cycle errors occur across any vault, the agent enters a 10-minute pause before resuming. This prevents a broken state from spamming failed transactions.

**Pending transaction deduplication.** A per-vault record of pending transactions prevents the agent from submitting duplicate transactions for the same vault. Pending transactions expire from tracking after 5 minutes.

**Oracle unavailability.** If DefiLlama is unreachable when calculating slippage, the executor aborts the cycle rather than proceeding without price protection. Swaps never execute without a confirmed minimum output.

---

## Feed Server

The agent also runs a lightweight HTTP server on port 3001 that publishes a live event feed. The dashboard polls this feed every 15 seconds to show recent activity, pool data, and agent status. The feed is public and read-only. It includes:

* Pool snapshots from the last scan
* ACTION events for completed reallocations
* ALERT events for pool quality warnings
* SUMMARY events for daily reports
* Hold reasons for cycles that did not result in a reallocation
