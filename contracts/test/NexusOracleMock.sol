//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import { INexusOracle } from "../interfaces/INexusOracle.sol";

import "hardhat/console.sol";

contract NexusOracleMock is INexusOracle {
    mapping(address => uint256) public funds;

    event ExecutionCompleted(address _address, bytes _calldata, bool _success);

    function addFunds() external payable override {
        funds[msg.sender] += msg.value;
    }

    function execute(address _address, bytes calldata _calldata) external {
        // TODO: verify oracle signature
        // solhint-disable-next-line avoid-low-level-calls
        (bool success, ) = _address.call(_calldata);
        emit ExecutionCompleted(_address, _calldata, success);
    }
}
