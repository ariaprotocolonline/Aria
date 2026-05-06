// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IARIAVault {
    function deposit(address token, uint256 amount) external;
    function withdraw(address token, uint256 amount) external;
    function reallocate(
        address tokenIn, address tokenOut, address protocol,
        uint256 amount, uint256 expectedApyBps, uint256 newApyBps,
        bytes calldata data
    ) external;
}

/**
 * @title MaliciousReentrant
 * @notice Attempts reentrancy on ARIAVault.deposit(), withdraw(), and reallocate().
 *         All attacks should be blocked by ReentrancyGuard.
 *
 * Acts as a fake ERC20 token that calls back into the vault during transfer/transferFrom.
 */
contract MaliciousReentrant {
    IARIAVault public vault;
    address public tokenOut;
    bool public attackActive;
    uint8 public attackMode; // 1 = deposit reentry, 2 = withdraw reentry

    uint256 private _balance;
    mapping(address => uint256) private _balances;
    mapping(address => mapping(address => uint256)) private _allowances;

    // ── Minimal ERC20 surface ─────────────────────────────────────────────────

    function balanceOf(address who) external view returns (uint256) {
        return _balances[who];
    }

    function allowance(address owner, address spender) external view returns (uint256) {
        return _allowances[owner][spender];
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        _allowances[msg.sender][spender] = amount;
        return true;
    }

    function mint(address to, uint256 amount) external {
        _balances[to] += amount;
    }

    /**
     * @notice On transferFrom (used by vault.deposit), attempt to re-enter deposit().
     *         ReentrancyGuard must block the second call.
     */
    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        require(_allowances[from][msg.sender] >= amount, "MaliciousReentrant: allowance");
        _allowances[from][msg.sender] -= amount;
        _balances[from] -= amount;
        _balances[to]   += amount;

        if (attackActive && attackMode == 1) {
            // Reentrancy attempt: call deposit() while already inside deposit()
            try vault.deposit(address(this), 1) {
                // If this succeeds, ReentrancyGuard failed
            } catch {
                // Expected: ReentrancyGuard reverts the reentrant call
            }
        }

        return true;
    }

    /**
     * @notice On transfer (used by vault.withdraw), attempt to re-enter withdraw().
     *         ReentrancyGuard must block the second call.
     */
    function transfer(address to, uint256 amount) external returns (bool) {
        _balances[msg.sender] -= amount;
        _balances[to]         += amount;

        if (attackActive && attackMode == 2) {
            // Reentrancy attempt: call withdraw() while already inside withdraw()
            try vault.withdraw(address(this), 1) {
                // If this succeeds, ReentrancyGuard failed
            } catch {
                // Expected: ReentrancyGuard reverts
            }
        }

        return true;
    }

    // ── Attack entrypoints ────────────────────────────────────────────────────

    /**
     * @notice Arm the deposit reentrancy attack and trigger vault.deposit().
     */
    function attackDeposit(address _vault, uint256 amount) external {
        vault       = IARIAVault(_vault);
        attackMode  = 1;
        attackActive = true;

        // Give the vault an allowance so transferFrom can be called
        _balances[address(this)] = amount + 1;
        _allowances[address(this)][_vault] = amount + 1;

        vault.deposit(address(this), amount);
        attackActive = false;
    }

    /**
     * @notice Arm the withdraw reentrancy attack and trigger vault.withdraw().
     */
    function attackWithdraw(address _vault, uint256 amount) external {
        vault        = IARIAVault(_vault);
        attackMode   = 2;
        attackActive = true;

        // Seed vault balance for withdrawal
        _balances[_vault] = amount + 10;

        vault.withdraw(address(this), amount);
        attackActive = false;
    }

    /**
     * @notice Simulate a malicious protocol that calls back into reallocate()
     *         during the external call inside reallocate().
     *         This function is called as the "protocol" in reallocate().
     */
    function swap(
        address /*tokenIn*/,
        address /*tokenOut*/,
        uint256 /*amountIn*/,
        address /*recipient*/
    ) external {
        if (attackActive) {
            // Attempt to re-enter reallocate() while we're already inside it
            try vault.reallocate(
                address(this), address(this), address(this),
                1, 0, 100, ""
            ) {
                // If this succeeds, ReentrancyGuard failed
            } catch {
                // Expected
            }
        }
    }
}
