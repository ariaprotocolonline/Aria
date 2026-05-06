// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IARIAVault
 * @notice Interface for the ARIA non-custodial RWA yield vault on Mantle.
 *
 * Access control summary:
 *   owner — deposit, withdraw, setAgent, setFeeRecipient, setPerformanceFeeBps,
 *            setManagementFeeBps, addApprovedProtocol, removeApprovedProtocol,
 *            pause, unpause
 *   agent — reallocate (funds move only to whitelisted protocols)
 *   anyone — getBalance (view)
 *
 * Pause scope: deposit + reallocate are blocked when paused.
 *              withdraw is NEVER blocked — owner can always exit.
 *
 * Fee model:
 *   Management fee: charged on the vault balance at the moment of reallocate() or
 *                   withdraw(), proportional to time elapsed since last accrual.
 *   Performance fee: charged when the agent moves funds to a protocol with a higher
 *                    expected APY, calculated on the projected annualised yield delta.
 *   Hard caps: performanceFeeBps ≤ 2000 (20%), managementFeeBps ≤ 200 (2%).
 *   Safety fallback: no fee is transferred when feeRecipient is the zero address.
 */
interface IARIAVault {

    // ─── Events ────────────────────────────────────────────────────────────────

    /// @notice Emitted when the owner deposits an ERC20 token.
    event Deposited(address indexed token, uint256 amount);

    /// @notice Emitted when the owner withdraws an ERC20 token.
    event Withdrawn(address indexed token, uint256 amount);

    /**
     * @notice Emitted when the agent executes a reallocation.
     * @param amountIn  Net amount of tokenIn sent to the protocol (after performance fee).
     * @param amountOut Amount of tokenOut received by the vault.
     */
    event Reallocated(
        address indexed tokenIn,
        address indexed tokenOut,
        address indexed protocol,
        uint256 amountIn,
        uint256 amountOut
    );

    /// @notice Emitted when the agent address is updated.
    event AgentUpdated(address indexed oldAgent, address indexed newAgent);

    /// @notice Emitted when a protocol is added to the whitelist.
    event ProtocolAdded(address indexed protocol);

    /// @notice Emitted when a protocol is removed from the whitelist.
    event ProtocolRemoved(address indexed protocol);

    /// @notice Emitted when a management fee is transferred to the fee recipient.
    event ManagementFeeCharged(address indexed token, uint256 amount, address recipient);

    /// @notice Emitted when a performance fee is transferred to the fee recipient.
    event PerformanceFeeCharged(address indexed token, uint256 amount, address recipient);

    /// @notice Emitted when the fee recipient address is updated.
    event FeeRecipientUpdated(address newRecipient);

    /// @notice Emitted when the performance fee rate is updated.
    event PerformanceFeeBpsUpdated(uint256 newBps);

    /// @notice Emitted when the management fee rate is updated.
    event ManagementFeeBpsUpdated(uint256 newBps);

    // Note: Paused(address) and Unpaused(address) are emitted by OZ Pausable.

    // ─── Owner Functions ────────────────────────────────────────────────────────

    /// @notice Deposit `amount` of `token` from the owner's wallet into the vault.
    function deposit(address token, uint256 amount) external;

    /// @notice Withdraw `amount` of `token` to the owner's wallet — never blocked.
    function withdraw(address token, uint256 amount) external;

    /// @notice Replace the ARIA agent with `newAgent`.
    function setAgent(address newAgent) external;

    /// @notice Update the fee recipient address (zero address disables fee collection).
    function setFeeRecipient(address _feeRecipient) external;

    /// @notice Update the performance fee rate (hard cap: 2000 bps = 20%).
    function setPerformanceFeeBps(uint256 _bps) external;

    /// @notice Update the annual management fee rate (hard cap: 200 bps = 2%).
    function setManagementFeeBps(uint256 _bps) external;

    /// @notice Add `protocol` to the agent's reallocation whitelist.
    function addApprovedProtocol(address protocol) external;

    /// @notice Remove `protocol` from the agent's reallocation whitelist.
    function removeApprovedProtocol(address protocol) external;

    /// @notice Pause deposits and agent reallocation.
    function pause() external;

    /// @notice Resume deposits and agent reallocation.
    function unpause() external;

    // ─── Agent Functions ────────────────────────────────────────────────────────

    /**
     * @notice Move funds from the vault into a whitelisted protocol.
     *
     * @param tokenIn         ERC20 token leaving the vault.
     * @param tokenOut        ERC20 token expected back from the protocol.
     * @param protocol        Whitelisted protocol address that receives the call.
     * @param amount          Total amount of tokenIn being reallocated (before fees).
     * @param expectedApyBps  Current position APY in basis points.
     * @param newApyBps       New position APY in basis points.
     *                        If newApyBps > expectedApyBps, a performance fee is charged.
     * @param data            ABI-encoded call to execute on the protocol.
     */
    function reallocate(
        address tokenIn,
        address tokenOut,
        address protocol,
        uint256 amount,
        uint256 expectedApyBps,
        uint256 newApyBps,
        bytes calldata data
    ) external;

    // ─── View ───────────────────────────────────────────────────────────────────

    /// @notice Returns the vault's current ERC20 balance for `token`.
    function getBalance(address token) external view returns (uint256);
}
