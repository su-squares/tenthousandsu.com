// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

/// @title Mock SuSquares contract for testing ownership checks
contract SuSquaresOwnerMock {
    mapping(uint256 => address) private _owners;

    function setOwner(uint256 id, address owner) external {
        _owners[id] = owner;
    }

    function ownerOf(uint256 id) external view returns (address) {
        return _owners[id];
    }
}
