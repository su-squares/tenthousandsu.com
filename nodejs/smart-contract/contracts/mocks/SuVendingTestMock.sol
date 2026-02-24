pragma solidity ^0.4.24;
import "../primary/SuVending.sol";
import "./SuNFTStealableTestMock.sol";

contract SuVendingTestMock is SuVending, SuNFTStealableTestMock {
    constructor() public SuVending(500000000000000000) {}

    function getSalePrice() external view returns (uint256) {
        return salePrice;
    }
}
