//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

abstract contract OracleClient {
    address public oracle;

    modifier onlyOracle() {
        require(msg.sender == oracle, "!oracle");
        _;
    }
}
