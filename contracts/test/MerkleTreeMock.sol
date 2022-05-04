//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import { MerkleTreeLib, TREE_DEPTH } from "../lib/MerkleTreeLib.sol";

contract MerkleTreeMock {
    using MerkleTreeLib for MerkleTreeLib.Tree;

    MerkleTreeLib.Tree public tree;

    function insert(bytes32 _leaf) external {
        tree.insert(_leaf);
    }

    function getRoot() external view returns (bytes32) {
        return tree.root();
    }

    function verifyProof(
        bytes32 _root,
        bytes32 _leaf,
        uint256 _leafIndex,
        bytes32[TREE_DEPTH] calldata _proof
    ) external pure returns (bool) {
        bytes32 calculatedRoot = MerkleTreeLib.branchRoot(_leaf, _proof, _leafIndex);
        return _root == calculatedRoot;
    }
}
