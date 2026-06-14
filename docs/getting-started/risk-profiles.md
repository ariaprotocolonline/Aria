# Risk Profiles

ARIA offers three risk profiles that control how aggressively the agent pursues yield. Each profile sets two code-enforced thresholds that determine when a reallocation is allowed to happen.

You choose your profile during onboarding. You can change it at any time from the Settings panel on the dashboard.

---

## The Two Thresholds

### Minimum Liquidity Score

Every pool ARIA considers is assigned a liquidity quality score between 0 and 1. This score reflects the depth, stability, and quality of the pool's liquidity. A score of 1.0 indicates a highly liquid, stable pool. A score below 0.4 indicates thin liquidity with higher slippage and impermanent loss risk.

Your risk profile sets the minimum score a pool must achieve before ARIA will move funds into it. If a pool falls below your floor, the agent skips it regardless of its APY.

### APY Improvement Threshold

ARIA will not reallocate for marginal gains. Moving funds between pools has a cost in gas and fees. Your risk profile sets the minimum APY improvement (in basis points) that a new pool must offer over the current position before a reallocation is triggered.

One basis point equals 0.01% APY. A threshold of 150 bps means the new pool must offer at least 1.5% more APY than the current position before ARIA acts.

---

## Profile Comparison

| Setting | Conservative | Balanced | Aggressive |
|---------|-------------|----------|------------|
| Minimum liquidity score | 0.70 | 0.55 | 0.40 |
| APY improvement threshold | 150 bps (1.5%) | 75 bps (0.75%) | 40 bps (0.4%) |
| Target APY range | 6% to 10% | 9% to 14% | 12% to 22%+ |
| Reallocation frequency | Low | Moderate | High |
| xStocks allocation | 0% | Up to 20% | Up to 50% |

---

## Conservative

Conservative is designed for users who prioritize capital preservation above yield maximization. The agent only moves funds into pools with strong liquidity scores (0.70 or higher) and only when the APY improvement is substantial (at least 150 bps). This means fewer reallocations but higher confidence in each move.

Best suited for users who want automated yield management with minimal risk exposure and lower reallocation frequency.

---

## Balanced

Balanced offers the best risk-adjusted yield for most users. The liquidity floor is 0.55, allowing access to a wider range of pools, and the APY threshold is 75 bps. The agent moves more frequently than Conservative but still applies meaningful quality filters.

Best suited for users who want steady yield improvement with reasonable risk controls. This is the default profile.

---

## Aggressive

Aggressive maximizes yield potential by accepting a lower liquidity floor (0.40) and acting on smaller APY improvements (40 bps). The agent rebalances more frequently and can access a broader set of pools including higher-risk, higher-reward positions. When xStocks is enabled, the agent can allocate up to 50% of the portfolio into tokenized equity assets.

Best suited for experienced DeFi users who understand impermanent loss, accept higher reallocation frequency, and want to pursue maximum yield.

---

## Changing Your Profile

Open the dashboard and navigate to **Settings**. Under the Risk Profile section, select your new profile and confirm. The change takes effect on the next agent scan cycle (within 5 minutes). Your current position is not automatically moved when you change profiles. The agent will move funds the next time it finds an opportunity that meets your new thresholds.
