// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @notice Simulates a DeFi protocol for ARIAVault tests.
 *         Performs a 1:1 token swap — pulls tokenIn from the caller (vault),
 *         sends tokenOut to the recipient (vault).
 *
 *         The vault must approve this contract before calling swap().
 */
contract MockProtocol {
    using SafeERC20 for IERC20;

    /**
     * @param tokenIn   Token to pull from msg.sender (the vault).
     * @param tokenOut  Token to send to `recipient`.
     * @param amountIn  Amount to pull and swap (1:1 rate).
     * @param recipient Address to receive tokenOut (should be the vault).
     */
    function swap(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        address recipient
    ) external {
        IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), amountIn);
        IERC20(tokenOut).safeTransfer(recipient, amountIn);
    }
}
