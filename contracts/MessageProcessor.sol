//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import { EncoderLib } from "./lib/EncoderLib.sol";
import { MerkleTreeLib } from "./lib/MerkleTreeLib.sol";
import { IReceiver } from "./interfaces/IReceiver.sol";
import { OracleClient } from "./OracleClient.sol";
import "hardhat/console.sol";

abstract contract MessageProcessor is OracleClient {
    struct RootStorage {
        uint256 blocknumber;
        mapping(bytes32 => bool) roots;
    }

    // -- Storage --

    mapping(uint256 => RootStorage) public roots;
    mapping(address => mapping(uint256 => uint256)) public relayerFees;

    // -- Events --

    event MessageReceived(bytes32 indexed _packetHash, bool indexed _success);
    event RootUpdated(uint256 indexed _chainId, uint256 indexed _blocknumber, bytes32 indexed _root);

    // -- Virtual --

    function chainId() public view virtual returns (uint256);

    // -- View --

    function getRootBlocknumber(uint256 _chainId) public view returns (uint256) {
        return roots[_chainId].blocknumber;
    }

    // -- Internal --

    function _process(
        bytes memory _packet,
        bytes32[32] memory _proof,
        uint256 _index
    ) internal {
        // Decode packet
        (
            uint256 _srcChainId,
            uint256 _dstChainId,
            address _srcAddress,
            address _dstAddress,
            uint256 _nonce,
            uint256 _fee,
            bytes memory _message
        ) = EncoderLib.decodeMessage(_packet);

        // Verify proof
        bytes32 packetHash = keccak256(_packet);
        require(_dstChainId == chainId(), "!dstChainId");
        require(_prove(packetHash, _index, _proof, _srcChainId), "!prove");

        // Pay relayer
        relayerFees[msg.sender][_srcChainId] += _fee;

        // TODO: Verify gas left

        // Send message
        try IReceiver(_dstAddress).nxReceive(_srcChainId, _srcAddress, _nonce, _message) {
            console.log("Success: True");
            emit MessageReceived(packetHash, true);
        } catch {
            console.log("Success: False");
            emit MessageReceived(packetHash, false);
        }
    }

    // -- Public --

    function _prove(
        bytes32 _leaf,
        uint256 _index,
        bytes32[32] memory _proof,
        uint256 _chainId
    ) public view returns (bool) {
        bytes32 computedRoot = MerkleTreeLib.branchRoot(_leaf, _proof, _index);
        return roots[_chainId].roots[computedRoot];
    }

    // -- Oracle --

    function updateRoot(bytes calldata _data) external onlyOracle {
        (uint256 _chainId, uint256 _blocknumber, bytes32 _root) = abi.decode(_data, (uint256, uint256, bytes32));
        roots[_chainId].roots[_root] = true;
        roots[_chainId].blocknumber = _blocknumber;
        emit RootUpdated(_chainId, _blocknumber, _root);
    }

    // -- Relayer --

    function relayerClaimFees(uint256 _chainId) external {
        // TODO
    }
}
