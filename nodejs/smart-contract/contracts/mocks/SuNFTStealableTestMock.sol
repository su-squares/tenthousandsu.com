pragma solidity ^0.4.24;
import "../primary/SuNFT.sol";

contract SuNFTStealableTestMock is SuNFT {
    constructor() public SuNFT("https://tenthousandsu.com/erc721/") {}

    function stealSquare(uint256 nftId) external {
        _transfer(nftId, msg.sender);
    }
}
