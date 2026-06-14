# Smart Contracts

ARIA is deployed on Mantle mainnet. The contract system consists of two contracts: `ARIAVaultFactory` and `ARIAVault`.

---

## Deployed Addresses

| Contract | Network | Address |
|----------|---------|---------|
| ARIAVaultFactory | Mantle mainnet | See dashboard or .env |
| ARIAVault (per user) | Mantle mainnet | Unique per wallet |

Individual vault addresses are shown on your dashboard under the Portfolio section and in the Active Strategy card.

---

## ARIAVaultFactory

### Read Functions

**`getVault(address owner) → address`**
Returns the vault address for a given owner. Returns the zero address if no vault has been deployed for that owner.

**`allVaults(uint256 index) → address`**
Returns the vault address at the given index in the full vault list.

**`totalVaults() → uint256`**
Returns the total number of vaults deployed through this factory.

### Write Functions

**`createVault() → address`**
Deploys a new `ARIAVault` owned by the caller. Reverts if the caller already has a vault. Returns the address of the newly deployed vault.

---

## ARIAVault

### Read Functions

**`getBalance(address token) → uint256`**
Returns the current ERC20 balance of the specified token held by the vault (live on-chain balance).

**`balances(address token) → uint256`**
Returns the internally tracked balance for the specified token (accounting balance used for fee calculations).

**`owner() → address`**
Returns the vault owner's address.

**`agent() → address`**
Returns the currently configured agent address.

**`feeRecipient() → address`**
Returns the address that receives fee payments.

**`performanceFeeBps() → uint256`**
Returns the current performance fee rate in basis points.

**`managementFeeBps() → uint256`**
Returns the current management fee rate in basis points.

**`paused() → bool`**
Returns whether the vault is currently paused.

**`approvedProtocols(address) → bool`**
Returns whether a protocol address is whitelisted.

**`approvedTokens(address) → bool`**
Returns whether a token address is whitelisted as an output token.

**`approvedSelectors(address protocol, bytes4 selector) → bool`**
Returns whether a function selector is whitelisted for a given protocol.

### Write Functions (Owner Only)

**`setAgent(address newAgent)`**
Updates the agent address. Only the owner can call this.

**`setFeeRecipient(address recipient)`**
Updates the fee recipient address. Set to zero address to disable fees.

**`setPerformanceFeeBps(uint256 bps)`**
Sets the performance fee rate. Maximum 2000 bps (20%).

**`setManagementFeeBps(uint256 bps)`**
Sets the management fee rate. Maximum 200 bps (2% per year).

**`addProtocol(address protocol)`**
Adds a protocol address to the approved whitelist.

**`removeProtocol(address protocol)`**
Removes a protocol address from the approved whitelist.

**`approveToken(address token)`**
Adds a token to the approved output tokens list.

**`removeToken(address token)`**
Removes a token from the approved output tokens list.

**`approveSelector(address protocol, bytes4 selector)`**
Whitelists a function selector for a specific protocol.

**`removeSelector(address protocol, bytes4 selector)`**
Removes a function selector from the whitelist.

**`pause()`**
Pauses the vault. Deposits and reallocations are blocked while paused. Withdrawals remain available.

**`unpause()`**
Resumes normal vault operation.

**`deposit(address token, uint256 amount)`**
Deposits tokens into the vault. Token must be approved to the vault contract first.

**`withdraw(address token, uint256 amount)`**
Withdraws tokens from the vault to the owner's address. Always available, even when paused.

### Write Functions (Agent Only)

**`reallocate(address tokenIn, address tokenOut, uint256 amount, address protocol, bytes calldata callData, uint256 newApyBps, uint256 minAmountOut)`**
Executes a reallocation from one token position to another via the specified protocol. Enforces all whitelist checks, accrues fees, executes the swap, verifies minimum output, and updates balances.

---

## Token Addresses on Mantle Mainnet

| Token | Address |
|-------|---------|
| WETH | 0xdeaddeaddeaddeaddeaddeaddeaddead1111 |
| USDC | 0x09bc4e0d864854c6afb6eb9a9cdf58ac190d0df9 |
| WMNT | 0x78c1b0c915c4faa5fffa6cabf0219da63d7f4cb8 |

---

## Protocol Router Addresses on Mantle Mainnet

| Protocol | Router Address |
|----------|---------------|
| Agni Finance | 0x319B69888b0d11cEC22caA5034e25FfFBDc88421 |
| FusionX | 0x5C6EC6E7F81120A2E7e15e61bE4F4fCcA05de596 |

Both routers implement the Uniswap V3 `exactInputSingle` interface.

---

## Source Code

Smart contract source code is available in the `aria-contracts/contracts/` directory of the ARIA repository on GitHub: [github.com/ariaprotocolonline/Aria](https://github.com/ariaprotocolonline/Aria)
