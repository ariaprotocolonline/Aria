// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IARIAVault
 * @notice Interface for the ARIA non-custodial RWA yield vault on Mantle.
 *
 * Access control summary:
 *   owner — deposit, withdraw, setAgent, setFeeRecipient, setPerformanceFeeBps,
 *            setManagementFeeBps, addApprovedProtocol, removeApprovedProtocol,
 *            addApprovedToken, removeApprovedToken,
 *            addApprovedSelector, removeApprovedSelector,
 *            pause, unpause
 *   agent — reallocate (funds move only to whitelisted protocols/tokens/selectors)
 *   anyone — getBalance (view)
 *
 * Pause scope: deposit + reallocate are blocked when paused.
 *              withdraw is NEVER blocked — owner can always exit.
 *
 * Fee model:
 *   Management fee: per-token, accrued on reallocate() or withdraw().
 *   Performance fee: capped APY delta * performanceFeeBps to prevent extraction attacks.
 *   Hard caps: performanceFeeBps ≤ 2000 (20%), managementFeeBps ≤ 200 (2%).
 *   Safety fallback: no fee is transferred when feeRecipient is the zero address.
 */
interface IARIAVault {

    // ─── Events ────────────────────────────────────────────────────────────────

    event Deposited(address indexed token, uint256 amount);
    event Withdrawn(address indexed token, uint256 amount);

    event Reallocated(
        address indexed tokenIn,
        address indexed tokenOut,
        address indexed protocol,
        uint256 amountIn,
        uint256 amountOut
    );

    event AgentUpdated(address indexed oldAgent, address indexed newAgent);
    event ProtocolAdded(address indexed protocol);
    event ProtocolRemoved(address indexed protocol);
    event TokenApproved(address indexed token);
    event TokenRemoved(address indexed token);
    event SelectorApproved(address indexed protocol, bytes4 indexed selector);
    event SelectorRemoved(address indexed protocol, bytes4 indexed selector);
    event ManagementFeeCharged(address indexed token, uint256 amount, address recipient);
    event PerformanceFeeCharged(address indexed token, uint256 amount, address recipient);
    event FeeRecipientUpdated(address newRecipient);
    event PerformanceFeeBpsUpdated(uint256 newBps);
    event ManagementFeeBpsUpdated(uint256 newBps);

    // ─── Owner Functions ────────────────────────────────────────────────────────

    function deposit(address token, uint256 amount) external;
    function withdraw(address token, uint256 amount) external;

    function setAgent(address newAgent) external;
    function setFeeRecipient(address _feeRecipient) external;
    function setPerformanceFeeBps(uint256 _bps) external;
    function setManagementFeeBps(uint256 _bps) external;

    function addApprovedProtocol(address protocol) external;
    function removeApprovedProtocol(address protocol) external;

    function addApprovedToken(address token) external;
    function removeApprovedToken(address token) external;

    function addApprovedSelector(address protocol, bytes4 selector) external;
    function removeApprovedSelector(address protocol, bytes4 selector) external;

    function pause() external;
    function unpause() external;

    // ─── Agent Functions ────────────────────────────────────────────────────────

    /**
     * @notice Move funds from the vault into a whitelisted protocol.
     *
     * @param tokenIn         ERC20 token leaving the vault.
     * @param tokenOut        ERC20 token expected back (must be in approvedTokens).
     * @param protocol        Whitelisted protocol address.
     * @param amount          Total amount of tokenIn being reallocated (before fees).
     * @param expectedApyBps  Current position APY in basis points.
     * @param newApyBps       New position APY. If higher, a performance fee is charged.
     * @param minAmountOut    Minimum tokenOut to receive; reverts if output is less.
     * @param data            ABI-encoded call; its selector must be in approvedSelectors.
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
    ) external;

    // ─── View ───────────────────────────────────────────────────────────────────

    function getBalance(address token) external view returns (uint256);
}
