//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "hardhat/console.sol";

import { EncoderLib } from "./lib/EncoderLib.sol";
import { MerkleTreeLib } from "./lib/MerkleTreeLib.sol";
import { INexusOracle } from "./interfaces/INexusOracle.sol";
import { OracleClient } from "./OracleClient.sol";

abstract contract MessageSender is OracleClient {
    // -- Libraries --

    using MerkleTreeLib for MerkleTreeLib.Tree;

    // -- Storage --

    uint256 public nonce;
    MerkleTreeLib.Tree public tree;

    // -- Events --

    event MessageSent(
        uint256 dstChainId,
        address srcAddress,
        address dstAddress,
        uint256 nonce,
        uint256 fee,
        bytes message,
        bytes32 packetHash
    );

    // -- Virtual --

    function chainId() public view virtual returns (uint256);

    // -- View --

    function treeRoot() public view returns (bytes32 root) {
        return tree.root();
    }

    function treeCount() public view returns (uint256 count) {
        return tree.count;
    }

    // -- Internal --

    function _send(
        uint256 _dstChainId,
        address _dstAddress,
        uint256 _fee,
        bytes calldata _message
    ) internal {
        // Pay the oracle
        INexusOracle(oracle).addFunds{ value: _fee / 100 }();
        // Pay the relayer
        // TODO
        // Pay the protocol
        // TODO
        // Send packet
        bytes memory packet = EncoderLib.encodeMessage({
            _srcChainId: chainId(),
            _dstChainId: _dstChainId,
            _srcAddress: msg.sender,
            _dstAddress: _dstAddress,
            _nonce: nonce,
            _fee: _fee,
            _message: _message
        });

        bytes32 packetHash = keccak256(packet);
        tree.insert(packetHash);

        emit MessageSent(_dstChainId, msg.sender, _dstAddress, nonce, _fee, _message, packetHash);

        nonce += 1;
    }
}
