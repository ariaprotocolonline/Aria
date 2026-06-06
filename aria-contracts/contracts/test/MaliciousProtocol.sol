// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IVault {
    function reallocate(
        address tokenIn, address tokenOut, address protocol,
        uint256 amount, uint256 expectedApyBps, uint256 newApyBps,
        uint256 minAmountOut, bytes calldata data
    ) external;
}

/**
 * @title MaliciousProtocol
 * @notice Tests four attack vectors against ARIAVault.reallocate().
 *         All attacks must be blocked.
 */
contract MaliciousProtocol {
    enum AttackMode { None, Reenter, StealApproval, ReturnFalse, DrainTokenOut }

    AttackMode public mode;
    address public vault;
    address public tokenIn;
    address public tokenOut;

    function setMode(AttackMode _mode) external {
        mode = _mode;
    }

    /**
     * @notice Called by vault.reallocate() as the whitelisted protocol.
     *         Executes the configured attack based on `mode`.
     */
    function swap(
        address _tokenIn,
        address _tokenOut,
        uint256 amountIn,
        address recipient
    ) external {
        vault    = recipient; // recipient is the vault
        tokenIn  = _tokenIn;
        tokenOut = _tokenOut;

        if (mode == AttackMode.Reenter) {
            // Attack 1: attempt reentrancy into reallocate()
            try IVault(vault).reallocate(
                _tokenIn, _tokenOut, address(this),
                1, 0, 100, 0, abi.encodeWithSelector(
                    this.swap.selector, _tokenIn, _tokenOut, 1, recipient
                )
            ) {} catch {}

        } else if (mode == AttackMode.StealApproval) {
            // Attack 2: pull the full approval the vault granted (netAmount)
            // Then try to pull MORE than approved to steal extra
            IERC20(_tokenIn).transferFrom(vault, address(this), amountIn);
            // try to steal 1 more token (approval should be exactly amountIn)
            try IERC20(_tokenIn).transferFrom(vault, address(this), 1) {
                // If this succeeds, approval was not revoked
            } catch {}

        } else if (mode == AttackMode.ReturnFalse) {
            // Attack 3: do nothing — let the call succeed but return no tokenOut
            // The vault's (bool success, ) = protocol.call(data) will be true
            // because this function doesn't revert. But tokenOut balance won't increase.
            // This is legal behavior — vault just records received = 0.

        } else if (mode == AttackMode.DrainTokenOut) {
            // Attack 4: try to transfer tokenOut out of vault
            // The vault only approved tokenIn, not tokenOut, so this must fail
            try IERC20(_tokenOut).transferFrom(vault, address(this), 1) {
                // If this succeeds, vault improperly approved tokenOut
            } catch {}
        }
    }

    /**
     * @notice Needed so this contract can be used as a "bad" ERC20 for steal tests.
     */
    function transferFrom(address, address, uint256) external pure returns (bool) {
        return true;
    }
    function transfer(address, uint256) external pure returns (bool) { return true; }
    function balanceOf(address) external pure returns (uint256) { return 0; }
    function allowance(address, address) external pure returns (uint256) { return 0; }
    function approve(address, uint256) external pure returns (bool) { return true; }
}
