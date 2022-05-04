//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "hardhat/console.sol";

import { MessageSender } from "./MessageSender.sol";
import { MessageProcessor } from "./MessageProcessor.sol";

contract Endpoint is MessageSender, MessageProcessor {
    // -- Storage --

    uint256 public immutable localChainId;

    // -- Constructor --

    constructor(uint256 _chainId, address _oracle) {
        localChainId = _chainId;
        oracle = _oracle;
    }

    // -- External --

    function send(
        uint256 _dstChainId,
        address _dstAddress,
        bytes calldata _message
    ) external payable {
        _send(_dstChainId, _dstAddress, msg.value, _message);
    }

    function process(
        bytes calldata _packet,
        bytes32[32] calldata _proof,
        uint256 _index
    ) external {
        _process(_packet, _proof, _index);
    }

    // -- Public --

    function chainId() public view override(MessageSender, MessageProcessor) returns (uint256) {
        return localChainId;
    }
}
