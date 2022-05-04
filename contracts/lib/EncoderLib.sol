// SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

library EncoderLib {
    function encodeMessage(
        uint256 _srcChainId,
        uint256 _dstChainId,
        address _srcAddress,
        address _dstAddress,
        uint256 _nonce,
        uint256 _fee,
        bytes memory _message
    ) internal pure returns (bytes memory _encodedMessage) {
        // TODO: Use abi.encodePacked instead since it is cheaper. If so,
        // decoding with abi.decode won't work. Thus, we'll have to take the same approach
        // as Nomad for using the TypedMemView.sol library for using pointers instead.
        // See https://github.com/nomad-xyz/nomad-monorepo/blob/main/solidity/nomad-core/libs/Message.sol
        return
            abi.encode(
                _srcChainId,
                _dstChainId,
                _srcAddress,
                _dstAddress,
                _nonce,
                _fee,
                _message
            );
    }

    function decodeMessage(bytes memory _encodedMessage)
        internal
        pure
        returns (
            uint256 _srcChainId,
            uint256 _dstChainId,
            address _srcAddress,
            address _dstAddress,
            uint256 _nonce,
            uint256 _fee,
            bytes memory _message
        )
    {
        return
            abi.decode(
                _encodedMessage,
                (uint256, uint256, address, address, uint256, uint256, bytes)
            );
    }
}
