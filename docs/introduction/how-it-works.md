# How It Works

ARIA operates as a four-layer system: smart contracts on Mantle, an autonomous AI agent, an API server, and a frontend dashboard. Each layer has a distinct role and communicates with the others through well-defined interfaces.

---

## Step 1: Your Vault Deploys

When you connect your wallet for the first time, ARIA's dashboard detects that no vault exists for your address and automatically calls the `ARIAVaultFactory` contract to deploy one. This vault is a standalone smart contract on Mantle, owned exclusively by your wallet address. No one else shares it.

The deployment costs a small amount of MNT for gas. After that, your vault is live and ready to receive funds.

---

## Step 2: You Deposit Funds

Once your vault is deployed, you can deposit WETH, USDC, or both. Deposits go directly into your vault contract. The agent is given permission to reallocate funds between approved protocols, but it cannot withdraw funds to any external address.

---

## Step 3: You Choose a Risk Profile

ARIA offers three risk profiles: Conservative, Balanced, and Aggressive. Your choice sets two key parameters that govern when the agent is allowed to act:

* **Minimum liquidity score.** The lowest acceptable liquidity quality score for a pool the agent is allowed to move into.
* **APY improvement threshold.** The minimum improvement in annual yield required before a reallocation is triggered.

You can change your risk profile at any time from the Settings panel.

---

## Step 4: The Agent Scans Every 5 Minutes

The ARIA agent runs a continuous loop. Every 5 minutes it:

1. Fetches live data from all active pools on Agni Finance and FusionX
2. Scores each pool for APY and liquidity quality
3. Optionally enriches the data with Elfa AI social signals and Nansen smart money intelligence
4. Sends the full market picture to Claude (claude-sonnet-4-6) for a yield decision
5. Validates Claude's response against code-enforced safety gates
6. Executes the reallocation if all checks pass, or holds if they do not

---

## Step 5: Claude Makes the Decision

Claude receives a structured prompt containing live pool data, your current vault balances, your risk profile parameters, and market intelligence signals. It returns a structured JSON decision block specifying which protocol to move to, which token to use, the confidence level, and the reasoning behind the choice.

Claude never has access to your private key. It never submits transactions. It only returns a decision that the agent code then validates and executes.

---

## Step 6: Safety Gates Run Before Execution

Before any transaction is submitted, the agent runs a series of deterministic checks in code:

* The target protocol must be in the approved whitelist
* The liquidity score must meet your profile's minimum floor
* The APY improvement must exceed your profile's threshold
* The vault must hold a sufficient balance of the required token
* The agent wallet must have enough MNT for gas
* A price oracle call to DefiLlama confirms the minimum output amount

If any check fails, the cycle ends with no action. The agent logs the reason and waits for the next cycle.

---

## Step 7: The Transaction Executes

If all safety gates pass, the agent constructs a `reallocate()` call on your vault contract. The contract:

1. Accrues any pending management fee
2. Calculates and charges the performance fee (if APY improved)
3. Approves the net amount to the target protocol router
4. Executes the swap via Uniswap V3 exactInputSingle
5. Revokes the approval regardless of outcome
6. Verifies the minimum output was received
7. Updates the vault's internal balance accounting

The transaction is confirmed with 2 block confirmations before the cycle is marked complete.

---

## Step 8: You Get Notified

If you have linked your Telegram account, you receive a real-time notification the moment ARIA executes a reallocation. The message includes the transaction hash, a link to the Mantle explorer, and a plain-language explanation of what moved and why. Daily summaries arrive each morning with your vault balance and a count of reallocations.

---

## The Whole Picture

```
Your wallet
    connects
        vault deploys (ARIAVaultFactory)
            you deposit WETH / USDC

ARIA agent (every 5 min)
    scans pools (Agni Finance, FusionX)
    enriches with Elfa + Nansen data
    sends to Claude for decision
    validates against safety gates
    executes reallocate() on your vault

Your vault contract
    charges fees (management + performance)
    swaps via Uniswap V3 exactInputSingle
    confirms 2 blocks
    logs event on-chain

You
    receive Telegram notification
    see activity in dashboard
    keep full withdrawal rights at all times
```
