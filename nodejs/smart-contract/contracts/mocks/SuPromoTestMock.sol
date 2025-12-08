pragma solidity ^0.4.0;
import "../primary/SuPromo.sol";
import "./SuNFTStealableTestMock.sol";

contract SuPromoTestMock is SuPromo, SuNFTStealableTestMock {
    constructor() public SuPromo(5000) {}

    function useUpAllGrants() external {
        promoCreatedCount = promoCreationLimit;
    }
}
