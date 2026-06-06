// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable2Step.sol";
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
 *   - The agent can ONLY call whitelisted function selectors on each protocol.
 *   - The agent has NO ability to transfer funds to arbitrary addresses.
 *   - The owner can withdraw at any time, including when paused.
 *   - All approved protocol addresses and selectors are controlled exclusively by the owner.
 *   - Two-step ownership transfer (Ownable2Step) prevents accidental ownership loss.
 *
 * Fee model:
 *   - Management fee: annual % of vault balance, accrued on reallocate() and withdraw().
 *     Minimum accrual interval is 1 hour to prevent dust-level transactions.
 *     Each token has its own independent fee timestamp.
 *   - Performance fee: charged when the agent moves to a higher-APY position.
 *     The APY delta is capped at 5000bps to prevent fee extraction attacks.
 *     Deducted from tokenIn before the protocol call; the protocol receives netAmount.
 *   - Hard caps: performanceFeeBps ≤ 2000 (20%), managementFeeBps ≤ 200 (2%).
 *   - If feeRecipient is the zero address, all fee transfers are skipped.
 *
 * Supported assets (initially): WETH and USDC on Mantle.
 */
contract ARIAVault is IARIAVault, Ownable2Step, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ─── Constants ──────────────────────────────────────────────────────────────

    uint256 public constant MAX_PERFORMANCE_FEE_BPS = 2000; // 20%
    uint256 public constant MAX_MANAGEMENT_FEE_BPS  = 200;  // 2%

    /// @dev Maximum APY delta used for performance fee calculation.
    ///      Prevents a manipulated newApyBps from extracting excess fees.
    uint256 private constant MAX_APY_DELTA_BPS = 5000; // 50%

    /// @dev Minimum time between management fee accruals per token.
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

    /// @notice Last management fee accrual timestamp per token.
    mapping(address => uint256) public lastFeeTimestamp;

    /// @notice Protocols the agent is permitted to send funds to.
    mapping(address => bool) public approvedProtocols;

    /// @notice Tokens the agent is permitted to receive from protocols.
    mapping(address => bool) public approvedTokens;

    /// @notice Per-protocol function selector whitelist.
    ///         approvedSelectors[protocol][selector] = true if the agent may call it.
    mapping(address => mapping(bytes4 => bool)) public approvedSelectors;

    /// @notice Internal deposit accounting per token.
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
        require(_feeRecipient != address(this), "ARIAVault: fee recipient cannot be vault");
        agent             = initialAgent;
        feeRecipient      = _feeRecipient;
        performanceFeeBps = 1000; // 10%
        managementFeeBps  = 50;   // 0.5% annually

        emit AgentUpdated(address(0), initialAgent);
        emit FeeRecipientUpdated(_feeRecipient);
    }

    // ─── Owner: Capital Management ───────────────────────────────────────────────

    /**
     * @notice Deposit `amount` of ERC20 `token` into the vault.
     * @dev Blocked when paused. Token must be pre-approved for this contract.
     *      Initializes per-token fee timestamp on first deposit.
     */
    function deposit(address token, uint256 amount)
        external
        onlyOwner
        whenNotPaused
        nonReentrant
    {
        require(token != address(0), "ARIAVault: zero token");
        require(amount > 0, "ARIAVault: zero amount");
        // Fee math uses uint128 internally — cap deposit to prevent overflow.
        require(amount <= type(uint128).max, "ARIAVault: amount exceeds uint128 max");

        if (lastFeeTimestamp[token] == 0) {
            lastFeeTimestamp[token] = block.timestamp;
        }

        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        balances[token] += amount;

        emit Deposited(token, amount);
    }

    /**
     * @notice Withdraw `amount` of `token` back to the owner.
     * @dev Intentionally NOT blocked by pause — the owner can always exit.
     *      Management fee is accrued before the withdrawal.
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
        require(_feeRecipient != address(this), "ARIAVault: fee recipient cannot be vault");
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

    /// @notice Add `token` to the approved output token whitelist.
    function addApprovedToken(address token) external onlyOwner {
        require(token != address(0), "ARIAVault: zero token");
        require(!approvedTokens[token], "ARIAVault: token already approved");
        approvedTokens[token] = true;
        emit TokenApproved(token);
    }

    /// @notice Remove `token` from the approved output token whitelist.
    function removeApprovedToken(address token) external onlyOwner {
        require(approvedTokens[token], "ARIAVault: token not approved");
        approvedTokens[token] = false;
        emit TokenRemoved(token);
    }

    /// @notice Approve a function `selector` on `protocol` for agent calls.
    function addApprovedSelector(address protocol, bytes4 selector) external onlyOwner {
        require(approvedProtocols[protocol], "ARIAVault: protocol not approved");
        approvedSelectors[protocol][selector] = true;
        emit SelectorApproved(protocol, selector);
    }

    /// @notice Revoke a function `selector` on `protocol`.
    function removeApprovedSelector(address protocol, bytes4 selector) external onlyOwner {
        require(approvedSelectors[protocol][selector], "ARIAVault: selector not approved");
        approvedSelectors[protocol][selector] = false;
        emit SelectorRemoved(protocol, selector);
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
     *   1. Validate inputs, whitelist, and calldata selector.
     *   2. Accrue management fee on tokenIn.
     *   3. Validate vault balance is sufficient after fee.
     *   4. Cap APY delta to prevent fee extraction (C1).
     *   5. Calculate and transfer performance fee to feeRecipient (if applicable).
     *   6. Approve protocol for netAmount (= amount - performanceFee).
     *   7. Execute the protocol call with `data`.
     *   8. ALWAYS revoke approval, even on failure.
     *   9. Revert if the call was unsuccessful.
     *  10. Enforce minimum output (slippage protection).
     *  11. Update internal accounting.
     *
     * @param tokenIn        Token leaving the vault.
     * @param tokenOut       Token expected back from the protocol (must be whitelisted).
     * @param protocol       Whitelisted protocol address.
     * @param amount         Total amount of tokenIn being reallocated.
     * @param expectedApyBps Current position APY in basis points.
     * @param newApyBps      New position APY. If > expectedApyBps, perf fee is charged.
     * @param minAmountOut   Minimum tokenOut to receive. Reverts if output is less.
     * @param data           Encoded call for the protocol (must reference netAmount).
     */
    function reallocate(
        address tokenIn,
        address tokenOut,
        address protocol,
        uint256 amount,
        uint256 expectedApyBps,
        uint256 newApyBps,
        uint256 minAmountOut,
        bytes calldata data
    ) external onlyAgent whenNotPaused nonReentrant {
        require(tokenIn  != address(0), "ARIAVault: zero tokenIn");
        require(tokenOut != address(0), "ARIAVault: zero tokenOut");
        require(approvedProtocols[protocol], "ARIAVault: not approved protocol");
        require(approvedTokens[tokenIn],  "ARIAVault: tokenIn not approved");
        require(approvedTokens[tokenOut], "ARIAVault: tokenOut not approved");
        require(amount > 0, "ARIAVault: zero amount");
        require(minAmountOut > 0, "ARIAVault: minAmountOut must be > 0");

        require(data.length >= 4, "ARIAVault: calldata too short");
        bytes4 selector = bytes4(data[:4]);
        require(approvedSelectors[protocol][selector], "ARIAVault: selector not approved");

        _accrueManagementFee(tokenIn);

        require(
            IERC20(tokenIn).balanceOf(address(this)) >= amount,
            "ARIAVault: insufficient tokenIn"
        );

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

        // Capture tokenOut balance AFTER fee transfers so that same-token
        // reallocation (tokenIn == tokenOut) does not produce a negative delta.
        uint256 tokenOutBefore = IERC20(tokenOut).balanceOf(address(this));

        IERC20(tokenIn).forceApprove(protocol, netAmount);
        (bool success, ) = protocol.call(data);
        IERC20(tokenIn).forceApprove(protocol, 0);

        require(success, "ARIAVault: protocol call failed");

        uint256 received = IERC20(tokenOut).balanceOf(address(this)) - tokenOutBefore;
        require(received >= minAmountOut, "ARIAVault: insufficient output");

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
     *        - less than MIN_FEE_INTERVAL has elapsed since the last per-token accrual
     *        - the vault holds no balance of the token
     *        - the computed fee rounds to zero
     *        - lastFeeTimestamp[token] is 0 (token not yet deposited)
     */
    function _accrueManagementFee(address token) internal {
        uint256 lastTs = lastFeeTimestamp[token];
        if (lastTs == 0) return;

        uint256 elapsed = block.timestamp - lastTs;
        if (elapsed < MIN_FEE_INTERVAL) return;

        lastFeeTimestamp[token] = block.timestamp;

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
     *      The APY delta is capped at MAX_APY_DELTA_BPS (5000) to prevent
     *      a manipulated newApyBps from extracting excess fees (C1).
     *
     * Fee = (amount × cappedApyDelta / 10000) × performanceFeeBps / 10000
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

        uint256 rawDelta = newApyBps - expectedApyBps;
        uint256 cappedDelta = rawDelta > MAX_APY_DELTA_BPS ? MAX_APY_DELTA_BPS : rawDelta;

        uint256 yieldDelta = amount * cappedDelta / 10_000;
        uint256 fee = yieldDelta * performanceFeeBps / 10_000;
        return fee > amount ? amount : fee;
    }

    // Prevent the owner from renouncing ownership — the vault would become permanently
    // unmanageable with no way to update the agent or recover in an emergency.
    function renounceOwnership() public view override onlyOwner {
        revert("ARIAVault: ownership cannot be renounced");
    }
}
