# Frequently Asked Questions

---

## General

**What is ARIA?**

ARIA is a non-custodial autonomous yield management protocol on Mantle. An AI agent powered by Claude scans DeFi liquidity pools every 5 minutes and automatically moves your WETH and USDC to whichever pool offers the best risk-adjusted yield for your chosen profile.

**Is ARIA custodial?**

No. ARIA is fully non-custodial. When you connect your wallet, a smart contract vault is deployed that is owned exclusively by your wallet address. ARIA cannot transfer your funds to any external address, cannot withdraw funds on your behalf, and cannot prevent you from withdrawing at any time.

**Is ARIA live on mainnet?**

Yes. ARIA is deployed on Mantle mainnet and the agent runs 24 hours a day, 7 days a week.

**Do I need to do anything after depositing?**

No. Once you deposit and choose a risk profile, the agent handles everything. You will receive Telegram notifications when it acts (if you have connected Telegram), and you can monitor your position on the dashboard at any time.

---

## Vaults

**What is a vault?**

A vault is a personal smart contract deployed on Mantle, owned by your wallet address. It holds your deposited tokens and is the only contract the ARIA agent is authorized to call. Every user who connects their wallet gets their own vault.

**How is my vault different from a pooled yield protocol?**

Your vault is isolated. Your funds are never mixed with other users. Your risk profile, fee settings, and position are completely independent. The agent manages each vault separately.

**Can the agent steal my funds?**

No. The agent address is authorized to call only `reallocate()` on your vault. That function can only move funds between addresses in the contract's approved whitelist using pre-approved function selectors. It cannot transfer funds to arbitrary addresses, cannot withdraw to the owner, and cannot do anything outside of this narrow permission set. These constraints are enforced in EVM bytecode.

**What happens if I lose access to my wallet?**

Your vault is owned by your wallet's private key. If you lose access to your wallet, you lose access to your vault. ARIA cannot recover funds for you. Use a secure wallet backup method.

---

## Yield and Performance

**What APY can I expect?**

Target ranges are 6 to 10% for Conservative, 9 to 14% for Balanced, and 12 to 22%+ for Aggressive. These are estimates based on historical pool performance on Mantle. DeFi yields are variable and depend on market conditions, protocol liquidity, and trading volume. Past performance does not guarantee future returns.

**How does ARIA decide when to move funds?**

Claude evaluates the pool data and returns a reallocation decision. That decision then passes through code-enforced safety gates: the target protocol must be whitelisted, the pool's liquidity score must meet your profile's floor, and the APY improvement must exceed your profile's threshold. If any check fails, the agent holds.

**What is a liquidity score?**

The liquidity score is a quality rating from 0 to 1 assigned to each pool. It reflects the depth, stability, and quality of the pool's liquidity. Higher scores indicate deeper, more stable liquidity with lower slippage risk. Your risk profile sets the minimum score ARIA will accept.

**Why didn't ARIA move my funds even though a pool has a higher APY?**

Several conditions must be met before a reallocation happens: the liquidity score must meet your floor, the APY improvement must exceed your threshold, the protocol must be whitelisted, and your vault must hold the required token. If the improvement is real but below your threshold, or if the pool has thin liquidity, the agent correctly holds.

---

## Fees

**What fees does ARIA charge?**

ARIA charges two fees. A management fee of 0.5% per year (charged on each reallocation on the input token). A performance fee of 10% of any APY gain realized by the reallocation (only charged when APY improves).

**Are the fee rates fixed?**

The default rates are 0.5% management and 10% performance. The vault owner can adjust these within hard caps enforced by the contract: maximum 2% per year for management, maximum 20% of APY gain for performance.

**Where do fees go?**

To the `feeRecipient` address configured on your vault. By default this is the ARIA protocol's cold-storage fee wallet. The agent wallet never receives fees.

**Is there a withdrawal fee?**

No. Withdrawals are free. Any pending management fee that has accrued since the last reallocation is collected on the next reallocation, not on withdrawal.

---

## Telegram

**Do I need to connect Telegram?**

No. Telegram notifications are optional. Your vault operates the same whether or not Telegram is connected. Connecting Telegram simply adds real-time notifications and the ability to chat with ARIA from within Telegram.

**What if my link code expires?**

Link codes are valid for 24 hours. If yours expires, go to Settings on the dashboard and click Connect Telegram to generate a new one.

**Can I chat with ARIA on Telegram?**

Yes. Any message you send to @AriaRWAbot that is not a command is forwarded to Claude with your live vault context. You can ask about your positions, fees, recent moves, or anything else about the protocol.

---

## Technical

**What happens if the ARIA agent goes offline?**

Your funds remain in your vault. The agent going offline does not affect your ability to deposit or withdraw. When the agent comes back online it resumes scanning from the next cycle. No transactions can be submitted while the agent is offline.

**Can I add my own pools?**

Yes. Go to Settings on the dashboard and use the Custom Pools section to add any pool on Mantle. Provide the protocol name, token details, pool address, router address, and fee tier. The agent includes your custom pools in the next scan cycle.

**What is SIWE?**

Sign-In With Ethereum is a standard that lets you authenticate with a web application using your Ethereum wallet signature instead of a username and password. ARIA uses SIWE for the chat and conversation features. You sign a message with your wallet to prove ownership of your address. No private key is shared.

**How does slippage protection work?**

Before every swap, the executor fetches the current token price from the DefiLlama oracle and calculates the minimum acceptable output amount based on your risk profile's slippage tolerance (0.3% for Conservative, 0.5% for Balanced, 1.0% for Aggressive). This minimum is passed to the vault contract's `reallocate()` call. If the swap would produce less than the minimum, the transaction reverts. The agent never executes a swap without confirmed price protection.
