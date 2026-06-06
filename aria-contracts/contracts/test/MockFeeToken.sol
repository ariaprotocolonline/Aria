// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @notice ERC20 that silently burns 1% on every transfer (fee-on-transfer).
contract MockFeeToken is ERC20 {
    uint256 public constant FEE_BPS = 100; // 1%

    constructor() ERC20("FeeToken", "FEE") {
        _mint(msg.sender, 1_000_000 ether);
    }

    function _update(address from, address to, uint256 value) internal override {
        if (from != address(0) && to != address(0)) {
            uint256 fee = (value * FEE_BPS) / 10_000;
            super._update(from, address(0), fee);   // burn the fee
            super._update(from, to, value - fee);   // deliver remainder
        } else {
            super._update(from, to, value);
        }
    }
}

/// @notice ERC20 that returns false on transfer/transferFrom instead of reverting.
contract MockReturnFalseToken is ERC20 {
    bool public shouldReturnFalse;

    constructor() ERC20("ReturnFalse", "RFT") {
        _mint(msg.sender, 1_000_000 ether);
    }

    function setReturnFalse(bool _val) external { shouldReturnFalse = _val; }

    function transfer(address to, uint256 amount) public override returns (bool) {
        if (shouldReturnFalse) return false;
        return super.transfer(to, amount);
    }

    function transferFrom(address from, address to, uint256 amount) public override returns (bool) {
        if (shouldReturnFalse) return false;
        return super.transferFrom(from, to, amount);
    }
}
