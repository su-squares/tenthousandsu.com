pragma solidity ^0.4.24;
import "../primary/SuNFT.sol";

contract SuNFTTestMock is SuNFT {
    constructor() public SuNFT("https://tenthousandsu.com/erc721/") {}

    function stealSquare(uint256 nftId) external mustBeValidToken(nftId) {
        _transfer(nftId, msg.sender);
    }

    function mint(
        address to,
        uint256 nftId
    ) external mustBeValidToken(nftId) mustBeOwnedByThisContract(nftId) {
        _transfer(nftId, to);
    }
}
