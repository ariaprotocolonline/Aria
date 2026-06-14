# Fee Structure

ARIA charges two types of fees: a management fee and a performance fee. Both are collected automatically during reallocation and sent directly to a designated fee recipient address. The agent wallet never receives fees.

---

## Management Fee

The management fee is an annual charge on the assets held in your vault. It is accrued proportionally over time and collected during each reallocation.

**Default rate:** 0.5% per year (50 basis points)

**Maximum rate:** 2% per year (200 basis points) enforced as a hard cap in the contract. The vault owner cannot set a rate above this limit.

**Accrual formula:**

```
fee = (balance × feeBps × timeElapsed) / (10000 × 365 days)
```

**Minimum interval:** The management fee accrues at most once per hour per token. This prevents dust-level fee charges from accumulating on very small time differences.

The management fee is charged on `tokenIn` at the start of each reallocation. It is deducted before the swap, so the amount that enters the protocol is the net amount after the fee.

---

## Performance Fee

The performance fee rewards ARIA for generating yield improvement. It is only charged when the agent moves funds to a pool with a higher APY than the current position.

**Default rate:** 10% of the APY gain (1000 basis points)

**Maximum rate:** 20% (2000 basis points) enforced as a hard cap in the contract.

**APY delta cap:** 5000 basis points the maximum APY improvement that can be used as the basis for fee calculation. This cap prevents fee extraction attacks where an agent could claim an exaggerated APY improvement to inflate the performance fee.

**Calculation:**

```
apyDelta = min(newApyBps - currentApyBps, 5000)
fee = (amount × apyDelta / 10000) × performanceFeeBps / 10000
```

The performance fee is only charged when `newApyBps > currentApyBps`. If the reallocation does not improve APY (for example, a defensive move to a safer pool), no performance fee is charged.

---

## Fee Recipient

All fees go to a `feeRecipient` address configured on each vault. By default this is set to the protocol's designated cold-storage fee wallet during vault creation.

The fee recipient is completely separate from the agent address. The agent wallet that submits transactions never receives fee payments. This separation is enforced in the contract and verified by the deployment scripts.

Users can update their vault's fee recipient address from the Settings panel. Setting the fee recipient to the zero address disables all fees.

---

## Fee Configuration

You can view and configure your fee settings in the Settings panel on the dashboard:

* **Performance fee** displayed in basis points (default: 1000 bps = 10%)
* **Management fee** displayed in basis points (default: 50 bps = 0.5% per year)

Changes to fee settings require an on-chain transaction and take effect on the next reallocation.

---

## Fee Summary Table

| Fee Type | Default | Maximum | Trigger |
|----------|---------|---------|---------|
| Management fee | 0.5% / year | 2% / year | Every reallocation, on tokenIn |
| Performance fee | 10% of APY gain | 20% of APY gain | Only when newAPY > currentAPY |

---

## No Fee on Withdrawals

ARIA does not charge a withdrawal fee. You can withdraw your full balance at any time. Any pending management fee that has accrued since the last reallocation will be collected on the next reallocation, not on withdrawal.
