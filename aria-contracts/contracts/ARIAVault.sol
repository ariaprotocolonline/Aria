// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./interfaces/IARIAVault.sol";

/**
 * @title ARIAVault
 * @notice Non-custodial per-user yield vault for ARIA autonomous RWA management on Mantle.
 *
 * Security model:
 *   - Each user deploys their own vault instance — funds are never pooled.
 *   - The agent can ONLY call reallocate(), and ONLY to whitelisted protocol addresses.
 *   - The agent has NO ability to transfer funds to arbitrary addresses.
 *   - The owner can withdraw at any time, including when paused.
 *   - All approved protocol addresses are controlled exclusively by the owner.
 *
 * Fee model:
 *   - Management fee: annual % of vault balance, accrued on reallocate() and withdraw().
 *     Minimum accrual interval is 1 hour to prevent dust-level transactions.
 *   - Performance fee: charged when the agent moves to a higher-APY position.
 *     Deducted from tokenIn before the protocol call; the protocol receives netAmount.
 *   - Hard caps: performanceFeeBps ≤ 2000 (20%), managementFeeBps ≤ 200 (2%).
 *   - If feeRecipient is the zero address, all fee transfers are skipped.
 *
 * Supported assets (initially): USDY and mETH on Mantle.
 */
contract ARIAVault is IARIAVault, Ownable, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ─── Constants ──────────────────────────────────────────────────────────────

    uint256 public constant MAX_PERFORMANCE_FEE_BPS = 2000; // 20%
    uint256 public constant MAX_MANAGEMENT_FEE_BPS  = 200;  // 2%

    /// @dev Minimum time between management fee accruals. Prevents dust-level fees
    ///      in tests and high-frequency interactions.
    uint256 private constant MIN_FEE_INTERVAL = 1 hours;

    // ─── State ──────────────────────────────────────────────────────────────────

    /// @notice ARIA backend wallet authorized to call reallocate().
    address public agent;

    /// @notice Wallet that receives management and performance fees.
    ///         Zero address disables all fee collection.
    address public feeRecipient;

    /// @notice Performance fee rate in basis points (default 1000 = 10%).
    uint256 public performanceFeeBps;

    /// @notice Annual management fee rate in basis points (default 50 = 0.5%).
    uint256 public managementFeeBps;

    /// @notice Timestamp of the last management fee accrual.
    uint256 public lastFeeTimestamp;

    /// @notice Protocols the agent is permitted to send funds to.
    mapping(address => bool) public approvedProtocols;

    /**
     * @notice Internal deposit accounting per token.
     * @dev Tracks the net amount deposited by the owner. May diverge from the
     *      actual ERC20 balance if the protocol returns unexpected amounts.
     *      Use getBalance() for the ground-truth on-chain balance.
     */
    mapping(address => uint256) public balances;

    // ─── Modifiers ──────────────────────────────────────────────────────────────

    modifier onlyAgent() {
        require(msg.sender == agent, "ARIAVault: not agent");
        _;
    }

    // ─── Constructor ────────────────────────────────────────────────────────────

    /**
     * @param initialOwner   Wallet that owns the vault (the user).
     * @param initialAgent   ARIA backend wallet granted reallocation rights.
     * @param _feeRecipient  Treasury wallet for management and performance fees.
     *                       Pass address(0) to deploy with fees disabled.
     */
    constructor(address initialOwner, address initialAgent, address _feeRecipient)
        Ownable(initialOwner)
    {
        require(initialAgent != address(0), "ARIAVault: zero agent");
        agent             = initialAgent;
        feeRecipient      = _feeRecipient;
        performanceFeeBps = 1000; // 10%
        managementFeeBps  = 50;   // 0.5% annually
        lastFeeTimestamp  = block.timestamp;

        emit AgentUpdated(address(0), initialAgent);
        emit FeeRecipientUpdated(_feeRecipient);
    }

    // ─── Owner: Capital Management ───────────────────────────────────────────────

    /**
     * @notice Deposit `amount` of ERC20 `token` into the vault.
     * @dev Blocked when paused. Token must be pre-approved for this contract.
     */
    function deposit(address token, uint256 amount)
        external
        onlyOwner
        whenNotPaused
        nonReentrant
    {
        require(token != address(0), "ARIAVault: zero token");
        require(amount > 0, "ARIAVault: zero amount");

        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        balances[token] += amount;

        emit Deposited(token, amount);
    }

    /**
     * @notice Withdraw `amount` of `token` back to the owner.
     * @dev Intentionally NOT blocked by pause — the owner can always exit.
     *      Management fee is accrued before the withdrawal. If more than
     *      MIN_FEE_INTERVAL has elapsed, the fee is deducted from the vault
     *      balance, so the vault must hold more than `amount` to succeed.
     */
    function withdraw(address token, uint256 amount)
        external
        onlyOwner
        nonReentrant
    {
        require(token != address(0), "ARIAVault: zero token");
        require(amount > 0, "ARIAVault: zero amount");

        _accrueManagementFee(token);

        require(
            IERC20(token).balanceOf(address(this)) >= amount,
            "ARIAVault: insufficient balance"
        );

        if (balances[token] >= amount) {
            balances[token] -= amount;
        } else {
            balances[token] = 0;
        }

        IERC20(token).safeTransfer(msg.sender, amount);

        emit Withdrawn(token, amount);
    }

    // ─── Owner: Configuration ────────────────────────────────────────────────────

    /// @notice Replace the ARIA agent address.
    function setAgent(address newAgent) external onlyOwner {
        require(newAgent != address(0), "ARIAVault: zero agent");
        address old = agent;
        agent = newAgent;
        emit AgentUpdated(old, newAgent);
    }

    /// @notice Update the fee recipient. Zero address disables fee collection.
    function setFeeRecipient(address _feeRecipient) external onlyOwner {
        feeRecipient = _feeRecipient;
        emit FeeRecipientUpdated(_feeRecipient);
    }

    /// @notice Update the performance fee rate. Hard cap: 2000 bps (20%).
    function setPerformanceFeeBps(uint256 _bps) external onlyOwner {
        require(_bps <= MAX_PERFORMANCE_FEE_BPS, "ARIAVault: performance fee exceeds cap");
        performanceFeeBps = _bps;
        emit PerformanceFeeBpsUpdated(_bps);
    }

    /// @notice Update the annual management fee rate. Hard cap: 200 bps (2%).
    function setManagementFeeBps(uint256 _bps) external onlyOwner {
        require(_bps <= MAX_MANAGEMENT_FEE_BPS, "ARIAVault: management fee exceeds cap");
        managementFeeBps = _bps;
        emit ManagementFeeBpsUpdated(_bps);
    }

    /// @notice Add `protocol` to the agent whitelist.
    function addApprovedProtocol(address protocol) external onlyOwner {
        require(protocol != address(0), "ARIAVault: zero protocol");
        require(!approvedProtocols[protocol], "ARIAVault: already approved");
        approvedProtocols[protocol] = true;
        emit ProtocolAdded(protocol);
    }

    /// @notice Remove `protocol` from the agent whitelist.
    function removeApprovedProtocol(address protocol) external onlyOwner {
        require(approvedProtocols[protocol], "ARIAVault: not approved");
        approvedProtocols[protocol] = false;
        emit ProtocolRemoved(protocol);
    }

    /// @notice Pause deposits and agent reallocation.
    function pause() external onlyOwner {
        _pause();
    }

    /// @notice Resume deposits and agent reallocation.
    function unpause() external onlyOwner {
        _unpause();
    }

    // ─── Agent: Reallocation ─────────────────────────────────────────────────────

    /**
     * @notice Move `amount` of `tokenIn` to a whitelisted protocol.
     *
     * Execution flow:
     *   1. Validate inputs and whitelist.
     *   2. Accrue management fee on tokenIn.
     *   3. Validate vault balance is sufficient after fee.
     *   4. Calculate and transfer performance fee to feeRecipient (if applicable).
     *   5. Approve protocol for netAmount (= amount - performanceFee).
     *   6. Execute the protocol call with `data`.
     *   7. ALWAYS revoke approval, even on failure.
     *   8. Revert if the call was unsuccessful.
     *   9. Update internal accounting.
     *
     * @param tokenIn        Token leaving the vault.
     * @param tokenOut       Token expected back from the protocol.
     * @param protocol       Whitelisted protocol address.
     * @param amount         Total amount of tokenIn being reallocated.
     * @param expectedApyBps Current position APY in basis points.
     * @param newApyBps      New position APY. If > expectedApyBps, perf fee is charged.
     * @param data           Encoded call for the protocol (must reference netAmount).
     */
    function reallocate(
        address tokenIn,
        address tokenOut,
        address protocol,
        uint256 amount,
        uint256 expectedApyBps,
        uint256 newApyBps,
        bytes calldata data
    ) external onlyAgent whenNotPaused nonReentrant {
        require(tokenIn  != address(0), "ARIAVault: zero tokenIn");
        require(tokenOut != address(0), "ARIAVault: zero tokenOut");
        require(approvedProtocols[protocol], "ARIAVault: not approved protocol");
        require(amount > 0, "ARIAVault: zero amount");

        _accrueManagementFee(tokenIn);

        require(
            IERC20(tokenIn).balanceOf(address(this)) >= amount,
            "ARIAVault: insufficient tokenIn"
        );

        // Performance fee: taken from tokenIn before the protocol call.
        uint256 perfFee = _calcPerformanceFee(amount, expectedApyBps, newApyBps);
        if (perfFee > 0) {
            if (balances[tokenIn] >= perfFee) {
                balances[tokenIn] -= perfFee;
            } else {
                balances[tokenIn] = 0;
            }
            IERC20(tokenIn).safeTransfer(feeRecipient, perfFee);
            emit PerformanceFeeCharged(tokenIn, perfFee, feeRecipient);
        }

        uint256 netAmount = amount - perfFee;
        require(netAmount > 0, "ARIAVault: net amount is zero");

        uint256 tokenOutBefore = IERC20(tokenOut).balanceOf(address(this));

        // Approve → call → always revoke
        IERC20(tokenIn).forceApprove(protocol, netAmount);
        (bool success, ) = protocol.call(data);
        IERC20(tokenIn).forceApprove(protocol, 0);

        require(success, "ARIAVault: protocol call failed");

        uint256 received = IERC20(tokenOut).balanceOf(address(this)) - tokenOutBefore;

        // Update internal accounting
        if (balances[tokenIn] >= netAmount) {
            balances[tokenIn] -= netAmount;
        } else {
            balances[tokenIn] = 0;
        }
        balances[tokenOut] += received;

        emit Reallocated(tokenIn, tokenOut, protocol, netAmount, received);
    }

    // ─── View ────────────────────────────────────────────────────────────────────

    /// @notice Returns the vault's live ERC20 balance for `token`.
    function getBalance(address token) external view returns (uint256) {
        return IERC20(token).balanceOf(address(this));
    }

    // ─── Internal ────────────────────────────────────────────────────────────────

    /**
     * @dev Accrues the annual management fee on `token` and transfers it to
     *      feeRecipient. No-ops if:
     *        - feeRecipient is address(0)
     *        - managementFeeBps is 0
     *        - less than MIN_FEE_INTERVAL has elapsed since the last accrual
     *        - the vault holds no balance of the token
     *        - the computed fee rounds to zero
     *
     *      Calling this in the same transaction as a deposit (or within 1 hour)
     *      will never charge a fee, preventing dust-level accruals.
     */
    function _accrueManagementFee(address token) internal {
        uint256 elapsed = block.timestamp - lastFeeTimestamp;

        // Enforce minimum interval to prevent dust and ensure meaningful accruals.
        if (elapsed < MIN_FEE_INTERVAL) return;

        lastFeeTimestamp = block.timestamp;

        if (feeRecipient == address(0) || managementFeeBps == 0) return;

        uint256 balance = IERC20(token).balanceOf(address(this));
        if (balance == 0) return;

        uint256 fee = (balance * managementFeeBps * elapsed) / (10_000 * 365 days);
        if (fee == 0) return;
        if (fee > balance) fee = balance;

        if (balances[token] >= fee) {
            balances[token] -= fee;
        } else {
            balances[token] = 0;
        }

        IERC20(token).safeTransfer(feeRecipient, fee);
        emit ManagementFeeCharged(token, fee, feeRecipient);
    }

    /**
     * @dev Returns the performance fee for a given reallocation.
     *      Zero when: feeRecipient is zero, newApyBps <= expectedApyBps,
     *      or performanceFeeBps is zero.
     *
     * Fee = (amount × apyDelta / 10000) × performanceFeeBps / 10000
     *     = amount × apyDelta × performanceFeeBps / 10^8
     */
    function _calcPerformanceFee(
        uint256 amount,
        uint256 expectedApyBps,
        uint256 newApyBps
    ) internal view returns (uint256) {
        if (
            feeRecipient == address(0) ||
            newApyBps <= expectedApyBps ||
            performanceFeeBps == 0
        ) return 0;

        uint256 yieldDelta = amount * (newApyBps - expectedApyBps) / 10_000;
        uint256 fee = yieldDelta * performanceFeeBps / 10_000;
        // Cap at the full amount — can never exceed principal
        return fee > amount ? amount : fee;
    }

    // Prevent the owner from renouncing ownership — the vault would become permanently
    // unmanageable with no way to update the agent or recover in an emergency.
    function renounceOwnership() public override onlyOwner {
        revert("ARIAVault: ownership cannot be renounced");
    }
}
