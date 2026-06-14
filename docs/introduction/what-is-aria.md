# What is ARIA?

ARIA stands for **Autonomous Real World Asset Intelligence**. It is a DeFi yield management protocol built on Mantle that uses an AI agent to automatically move your WETH and USDC between liquidity pools in search of the best risk-adjusted returns.

Unlike traditional yield aggregators that pool user funds together, ARIA gives every user a dedicated, non-custodial smart contract vault. Your funds stay under your control at all times.

---

## The Problem ARIA Solves

DeFi liquidity pools on Mantle offer attractive yields, but capturing those yields consistently requires constant attention. Pool APYs shift throughout the day. Liquidity conditions change. A pool paying 14% today may drop to 8% by tomorrow while another protocol quietly climbs to 16%.

Most users cannot monitor these shifts in real time or execute the multi-step rebalancing process efficiently. The result is that capital sits in suboptimal positions for days or weeks, earning less than it could.

ARIA solves this by running a fully autonomous agent that watches the market on your behalf every 5 minutes and acts the moment a better opportunity appears.

---

## What ARIA Is Not

ARIA is not a custodial fund. ARIA does not hold your money. The protocol cannot transfer your funds to any external wallet. The agent wallet that submits transactions on your behalf has no ability to withdraw funds, change the whitelist of approved protocols, or perform any action outside of reallocation between a pre-approved set of pools.

ARIA is not a promise. The security constraints are enforced in the smart contract bytecode, not in a terms of service document.

---

## Supported Assets

| Asset | Description |
|-------|-------------|
| WETH | Wrapped Ether on Mantle |
| USDC | USD Coin on Mantle |

Tokenized equity assets (TSLAx, NVDAx, AAPLx, and others via Fluxion DEX) are available for Aggressive profile users when enabled.

---

## Supported Protocols

| Protocol | Type | Status |
|----------|------|--------|
| Agni Finance | Uniswap V3 fork | Active |
| FusionX | Uniswap V3 fork | Active |
| Fluxion DEX | xStocks liquidity | Optional |

Users can also add custom pools through the dashboard Settings panel. The agent picks up custom pools on the next scan cycle.

---

## Target Returns

Returns depend on the selected risk profile and live market conditions.

| Profile | Target APY Range |
|---------|-----------------|
| Conservative | 6% to 10% |
| Balanced | 9% to 14% |
| Aggressive | 12% to 22%+ |

These are targets based on historical pool performance, not guaranteed returns. DeFi yields are variable and depend on market liquidity, trading volume, and protocol conditions.
