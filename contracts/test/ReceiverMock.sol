//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import { IReceiver } from "../interfaces/IReceiver.sol";
import "hardhat/console.sol";

contract ReceiverMock is IReceiver {
    struct Message {
        uint256 srcChainId;
        address srcAddress;
        uint256 nonce;
        string message;
    }

    Message[] public messages;
    address public immutable endpoint;

    event MessageReceived(string message);

    constructor(address _endpoint) {
        endpoint = _endpoint;
    }

    function nxReceive(
        uint256 _srcChainId,
        address _srcAddress,
        uint256 _nonce,
        bytes calldata _message
    ) external override {
        require(msg.sender == endpoint, "!endpoint");
        string memory messageStr = abi.decode(_message, (string));
        messages.push(Message(_srcChainId, _srcAddress, _nonce, messageStr));
        console.log("Message received: %s", messageStr);
        emit MessageReceived(messageStr);
    }

    // -- Public --
    function numMessages() public view returns (uint256) {
        return messages.length;
    }
}
