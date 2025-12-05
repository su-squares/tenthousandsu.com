pragma solidity ^0.4.24;

import "./AccessControl.sol";
import "./SuNFT.sol";

/// @title A token vending machine
/// @author William Entriken (https://phor.net)
contract SuVending is SuNFT {
    uint256 public salePrice;

    constructor(uint256 _salePrice) internal {
        require(_salePrice > 0);
        salePrice = _salePrice;
    }

    /// @notice The price is set at deployment, and you can buy any available square
    ///  Be sure you are calling this from a regular account (not a smart contract)
    ///  or if you are calling from a smart contract, make sure it can use
    ///  ERC-721 non-fungible tokens
    function purchase(uint256 _nftId)
        external
        payable
        mustBeValidToken(_nftId)
        mustBeOwnedByThisContract(_nftId)
    {
        require(msg.value == salePrice);
        _transfer(_nftId, msg.sender);
    }
}
