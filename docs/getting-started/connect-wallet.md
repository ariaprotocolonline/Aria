# Connect Your Wallet

Getting started with ARIA takes three steps: connect your wallet, complete the onboarding flow, and deposit funds. Your personal vault deploys automatically during this process.

---

## Supported Wallets

ARIA uses RainbowKit for wallet connections and supports all major Web3 wallets including:

* MetaMask
* Coinbase Wallet
* WalletConnect compatible wallets
* Rainbow
* Any injected browser wallet

---

## Step 1: Open the Dashboard

Visit [ariaprotocol.online](https://ariaprotocol.online) in your browser. If this is your first visit, you will see the ARIA landing page with an option to take a guided tour. The tour introduces the key concepts before you connect.

Click **Connect wallet** or **Launch app** to begin.

---

## Step 2: Complete the Onboarding

First-time users go through a short onboarding sequence before reaching the dashboard. This covers:

* Confirming you understand ARIA is non-custodial
* Choosing your initial risk profile
* Reviewing the security model

This takes under two minutes. You can always change your risk profile later from the Settings panel.

---

## Step 3: Your Vault Deploys

After onboarding, ARIA checks whether a vault already exists for your wallet address. If none exists, VaultGuard automatically calls `ARIAVaultFactory.createVault()` on Mantle.

You will see a **Setting up ARIA vault** banner while the transaction confirms. This requires a small amount of MNT for gas. If your wallet has insufficient MNT, a warning appears with instructions to acquire some. The warning dismisses automatically after 5 seconds.

Once the vault is deployed, you land on the full dashboard.

---

## Step 4: Sign In With Ethereum

ARIA uses Sign-In With Ethereum (SIWE) for authentication. When you open the chat or conversation features, you will be prompted to sign a message with your wallet. This proves ownership of your address without sharing any private key. The session lasts 24 hours.

---

## Network Requirements

ARIA runs on Mantle mainnet. Your wallet must be connected to the Mantle network. If you are on the wrong network, a NetworkGuard prompt will appear asking you to switch. Most wallets can add Mantle automatically through the prompt.

---

## After Connecting

Once connected and on the dashboard, you will find:

* Your vault balance (WETH and USDC)
* The active strategy panel showing your risk profile
* The live intelligence feed showing recent agent activity
* Settings to configure your preferences and link Telegram

You are ready to deposit funds and let ARIA go to work.
