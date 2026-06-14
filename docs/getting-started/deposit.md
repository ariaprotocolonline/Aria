# Deposit Funds

Once your vault is deployed, you can deposit WETH and USDC. Funds go directly into your personal vault contract on Mantle. ARIA begins scanning for yield opportunities on your behalf within the next agent cycle (up to 5 minutes).

---

## How to Deposit

**Step 1:** Open the dashboard and locate the **Portfolio** section.

**Step 2:** Click the **Deposit** button.

**Step 3:** Select the token you want to deposit (WETH or USDC).

**Step 4:** Enter the amount. You will see your current wallet balance displayed for reference.

**Step 5:** Confirm the transaction in your wallet. If this is your first deposit of a given token, you may need to approve the vault contract to spend it first. ARIA handles this in a single flow: approve then deposit.

**Step 6:** Once the transaction confirms on Mantle, your vault balance updates automatically on the dashboard.

---

## Minimum Deposit

There is no protocol-enforced minimum deposit. However, very small deposits may not generate meaningful yield after gas costs for reallocations. For the agent's reallocation economics to work well in your favor, a meaningful balance in your vault is recommended.

---

## Depositing Multiple Assets

You can deposit both WETH and USDC into your vault. ARIA manages each asset independently. The agent can move WETH between WETH-denominated pools and USDC between USDC-denominated pools based on your risk profile and available opportunities.

---

## After Depositing

After your deposit confirms, you will see:

* Updated vault balance in the Portfolio overview cards
* Updated allocation ring showing your WETH/USDC split
* The Active Strategy card reflecting your deposited assets
* The Live Monitoring section tracking your balances in real time (refreshes every 15 seconds)

The agent will pick up your new balance on its next scan and begin optimizing your position.

---

## Withdrawal

You can withdraw your funds at any time. Withdrawals are not subject to any lock-up period or agent approval. Even if the vault is paused, withdrawals remain available.

To withdraw, click the **Withdraw** button in the Portfolio section, select your token and amount, and confirm the transaction. Your funds return to your connected wallet address.
