//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

interface IReceiver {
    function nxReceive(
        uint256 _srcChainId,
        address _srcAddress,
        uint256 _nonce,
        bytes calldata _message
    ) external;
}
