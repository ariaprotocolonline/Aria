// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./ARIAVault.sol";

contract ARIAVaultFactory {
    address public immutable defaultAgent;
    address public immutable feeRecipient;

    mapping(address => address) public vaults;
    address[] public allVaults;

    event VaultCreated(address indexed owner, address indexed vault);

    constructor(address _defaultAgent, address _feeRecipient) {
        defaultAgent = _defaultAgent;
        feeRecipient = _feeRecipient;
    }

    function createVault() external returns (address) {
        require(vaults[msg.sender] == address(0), "Vault already exists");

        ARIAVault vault = new ARIAVault(
            msg.sender,
            defaultAgent,
            feeRecipient
        );

        vaults[msg.sender] = address(vault);
        allVaults.push(address(vault));

        emit VaultCreated(msg.sender, address(vault));
        return address(vault);
    }

    function getVault(address owner) external view returns (address) {
        return vaults[owner];
    }

    function hasVault(address owner) external view returns (bool) {
        return vaults[owner] != address(0);
    }

    function totalVaults() external view returns (uint256) {
        return allVaults.length;
    }
}
