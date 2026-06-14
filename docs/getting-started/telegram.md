# Link Telegram Notifications

ARIA can send real-time notifications directly to your Telegram account every time the agent makes a move on your portfolio. You can also chat with ARIA directly from Telegram to check your vault balance, ask questions about your positions, or get a full protocol explanation.

---

## What You Receive

**Reallocation alerts** arrive the moment ARIA moves your funds. Each alert includes:
* Which pool the funds moved from and to
* The amount reallocated
* The reason Claude gave for the decision
* A transaction hash with a direct link to the Mantle explorer

**Risk alerts** are sent if a pool's liquidity quality drops below your profile's minimum floor, putting your current position at risk.

**Daily summaries** arrive each morning with your current vault balance in WETH and USDC, the number of reallocations in the past 24 hours, and the current monitoring status.

**Hourly market updates** are sent when the top pool APYs shift significantly (more than 50 basis points since the last update), keeping you informed without spamming you during stable markets.

---

## How to Connect

**Step 1:** Open the ARIA dashboard and go to **Settings**.

**Step 2:** Scroll to the **Telegram notifications** section and click **Connect Telegram**.

**Step 3:** ARIA generates a one-time link code and shows you a button to open @AriaRWAbot. Click it. Telegram opens the bot chat.

**Step 4:** Telegram automatically sends `/start` with your code to the bot. Within seconds, your wallet is linked and you will receive a welcome message confirming the connection.

The link code is valid for 24 hours. If it expires, return to Settings and generate a new one.

---

## Available Bot Commands

| Command | Description |
|---------|-------------|
| `/status` | Shows your current vault balance fetched live from Mantle |
| `/about` | Full explanation of how ARIA works |
| `/help` | Lists all available commands |
| `/disconnect` | Unlinks your wallet from this Telegram chat |

Any message you send to @AriaRWAbot that is not a command is forwarded to Claude, which responds with full context about your vault, current positions, and recent agent activity. You can ask questions like "What pools am I in?" or "Explain my fees this week" directly in the Telegram chat.

---

## Vault Balance Lookups

When you request your balance via `/status` or ask a balance-related question, the bot fetches live data directly from the Mantle blockchain via RPC call. It reads your vault's WETH and USDC balances and formats them in the reply. Results are cached for 2 minutes so repeated queries within the same window are instant.

---

## Disconnecting

To disconnect Telegram, either:
* Send `/disconnect` to @AriaRWAbot
* Go to Settings on the dashboard and click **Disconnect** in the Telegram section

Disconnecting stops all notifications. Your vault continues operating normally. You can reconnect at any time by repeating the link process.
