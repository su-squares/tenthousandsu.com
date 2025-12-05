pragma solidity ^0.4.24;

import "./AccessControl.sol";
import "./SuNFT.sol";
import "./SuOperation.sol";
import "./SuPromo.sol";
import "./SuVending.sol";

/// @title The features that deed owners can use
/// @author William Entriken (https://phor.net)
contract SuMain is AccessControl, SuNFT, SuOperation, SuVending, SuPromo {
    constructor(
        string _tokenUriBase,
        uint256 _salePrice,
        uint256 _promoCreationLimit,
        uint256 _personalizationPrice
    )
        public
        SuNFT(_tokenUriBase)
        SuOperation(_personalizationPrice)
        SuVending(_salePrice)
        SuPromo(_promoCreationLimit)
    {
    }
}
