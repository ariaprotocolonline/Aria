# Vault Architecture

ARIA's smart contract system consists of two contracts: `ARIAVaultFactory` and `ARIAVault`. Together they implement a per-user, non-custodial vault model where every wallet gets its own isolated smart contract.

---

## ARIAVaultFactory

The factory is a single contract deployed once on Mantle. Its role is to create and track individual vaults.

**Key properties:**
* Deploys one `ARIAVault` per user wallet (one-per-address enforced in code)
* Stores the mapping from wallet address to vault address
* Maintains a public array of all deployed vaults for agent discovery
* Takes the default agent address and fee recipient address at construction (both immutable)

**Key functions:**
* `createVault()` deploys a new vault for the caller's address, reverts if one already exists
* `getVault(address owner)` returns the vault address for a given owner, or zero address if none
* `allVaults(uint index)` public array accessor for vault enumeration
* `totalVaults()` returns the count of deployed vaults

The ARIA agent reads `allVaults[]` at startup to discover every user vault and runs an independent yield cycle for each one.

---

## ARIAVault

Each user gets their own instance of `ARIAVault`. The vault is owned by the user's wallet address and operates as the sole interface between the user's funds and DeFi protocols.

---

### Ownership Model

ARIAVault uses OpenZeppelin's `Ownable2Step`. This requires two transactions to transfer ownership: a request and an acceptance. This prevents accidental ownership transfers to wrong addresses.

`renounceOwnership()` is blocked. The vault always has an identifiable owner who can withdraw funds and manage settings.

---

### What the Agent Can Do

The agent address (a separate hot wallet controlled by the ARIA protocol) is granted a specific and limited role. It can call one function: `reallocate()`.

That is the complete extent of the agent's power. The agent cannot:
* Transfer funds to any external wallet
* Withdraw funds to the vault owner
* Change the protocol whitelist
* Change the token whitelist
* Change fee settings
* Pause or unpause the vault
* Transfer or renounce ownership

---

### The Whitelist System

`reallocate()` can only execute a call if three conditions are met simultaneously:

1. The target protocol address is in `approvedProtocols`
2. The specific function selector being called is in `approvedSelectors[protocol][selector]`
3. The output token of the swap is in `approvedTokens`

All three whitelists are owner-controlled. The vault owner adds and removes entries. The agent cannot modify any whitelist.

---

### The Reallocation Flow

When `reallocate()` is called, the contract executes the following sequence:

1. Validates that the caller is the agent address
2. Validates that the target protocol is approved
3. Validates that the function selector is approved for that protocol
4. Validates that the output token is approved
5. Accrues pending management fee on the input token
6. Verifies the vault holds sufficient balance of the input token
7. Caps the reported APY delta at 5000 basis points (prevents fee extraction via inflated APY claims)
8. Calculates and transfers the performance fee to the fee recipient
9. Approves the net amount to the protocol router
10. Executes the external call to the protocol
11. Revokes the approval regardless of whether the call succeeded or failed
12. Reverts if the external call failed
13. Verifies that the output balance increased by at least `minAmountOut`
14. Updates internal balance accounting for both tokens

---

### Balance Tracking

The vault maintains an internal `balances[token]` mapping that tracks deposited amounts. The actual ERC20 balance (`getBalance(token)`) reflects the real on-chain balance including any yield earned inside the protocol. Both values are accessible from the dashboard.

---

### Reentrancy Protection

`deposit()`, `withdraw()`, and `reallocate()` are all protected by OpenZeppelin's `ReentrancyGuard`. Flash loan attacks and reentrancy exploits are blocked at the contract level.

---

### Events

Every significant state change emits an on-chain event:

| Event | Trigger |
|-------|---------|
| Deposited | User deposits a token |
| Withdrawn | User withdraws a token |
| Reallocated | Agent executes a reallocation |
| PerformanceFeeCharged | Performance fee collected |
| ManagementFeeCharged | Management fee collected |
| AgentUpdated | Agent address changed |
| FeeRecipientUpdated | Fee recipient address changed |
| ProtocolAdded / ProtocolRemoved | Whitelist updated |
| TokenApproved / TokenRemoved | Token whitelist updated |
| SelectorApproved / SelectorRemoved | Selector whitelist updated |

All events are indexed on the Mantle explorer and form a complete audit trail of every action taken on the vault.
