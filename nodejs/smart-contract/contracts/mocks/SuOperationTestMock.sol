pragma solidity ^0.4.24;
import "../primary/SuOperation.sol";
import "./SuNFTStealableTestMock.sol";

contract SuOperationTestMock is SuOperation, SuNFTStealableTestMock {
    constructor() public SuOperation(10000000000000000) {}
}
