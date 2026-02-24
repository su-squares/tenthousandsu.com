import { expect } from "chai";
import { ethers } from "hardhat";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { deploySuNFTTestMock } from "./helpers/deploy";

describe("NFTokenEnumerableMock", function () {
    let nftoken: Awaited<ReturnType<typeof deploySuNFTTestMock>>;
    let accounts: HardhatEthersSigner[];

    const id1 = 1n;
    const id2 = 2n;
    const id3 = 3n;

    beforeEach(async function () {
        accounts = await ethers.getSigners();
        nftoken = await deploySuNFTTestMock();
    });

    it("correctly checks all the supported interfaces", async function () {
        const nftokenInterface = await nftoken.supportsInterface("0x80ac58cd");
        const nftokenEnumerableInterface = await nftoken.supportsInterface("0x780e9d63");
        expect(nftokenInterface).to.equal(true);
        expect(nftokenEnumerableInterface).to.equal(true);
    });

    it("correctly mints a new NFT", async function () {
        const tx = await nftoken.mint(accounts[1].address, id1);
        await expect(tx).to.emit(nftoken, "Transfer");
        const owner = await nftoken.ownerOf(id1);
        expect(owner).to.equal(accounts[1].address);
    });

    it("returns the correct total supply", async function () {
        const totalSupply = await nftoken.totalSupply();
        expect(totalSupply).to.equal(10000n);
    });

    it("returns the correct token by index", async function () {
        await nftoken.mint(accounts[1].address, id1);
        await nftoken.mint(accounts[1].address, id2);
        await nftoken.mint(accounts[2].address, id3);

        let tokenId = await nftoken.tokenByIndex(0);
        expect(tokenId).to.equal(id1);

        tokenId = await nftoken.tokenByIndex(1);
        expect(tokenId).to.equal(id2);

        tokenId = await nftoken.tokenByIndex(2);
        expect(tokenId).to.equal(id3);
    });

    it("returns the correct token by index after minting two", async function () {
        await nftoken.mint(accounts[1].address, id1);
        await nftoken.mint(accounts[1].address, id2);

        let tokenId = await nftoken.tokenByIndex(0);
        expect(tokenId).to.equal(id1);

        tokenId = await nftoken.tokenByIndex(1);
        expect(tokenId).to.equal(id2);

        tokenId = await nftoken.tokenByIndex(2);
        expect(tokenId).to.equal(id3);
    });

    it("throws when trying to get token by non-existing index", async function () {
        await nftoken.mint(accounts[1].address, id1);
        await expect(nftoken.tokenByIndex(100000)).to.be.reverted;
    });

    it("returns the correct token of owner by index", async function () {
        await nftoken.mint(accounts[1].address, id1);
        await nftoken.mint(accounts[1].address, id2);
        await nftoken.mint(accounts[2].address, id3);

        const tokenId = await nftoken.tokenOfOwnerByIndex(accounts[1].address, 1);
        expect(tokenId).to.equal(id2);
    });

    it("returns the correct token of owner by index after transferring a token back to the contract", async function () {
        const bob = accounts[1];
        const jane = accounts[2];
        const nftokenAddress = await nftoken.getAddress();

        await nftoken.mint(bob.address, id2);
        await nftoken.connect(bob).approve(jane.address, id2);
        await nftoken.connect(jane).transferFrom(bob.address, nftokenAddress, id2);

        let tokenId = await nftoken.tokenOfOwnerByIndex(nftokenAddress, 1);
        expect(tokenId).to.equal(10000n);

        tokenId = await nftoken.tokenOfOwnerByIndex(nftokenAddress, 9999);
        expect(tokenId).to.equal(2n);
    });

    it("returns the correct token of owner by index after multiple transfers", async function () {
        const bob = accounts[1];
        const jane = accounts[2];
        const sara = accounts[3];

        await nftoken.mint(bob.address, id1);
        await nftoken.mint(bob.address, id2);

        await nftoken.connect(bob).approve(jane.address, id2);
        await nftoken.connect(jane).transferFrom(bob.address, sara.address, id2);

        let tokenId = await nftoken.tokenOfOwnerByIndex(bob.address, 0);
        expect(tokenId).to.equal(id1);

        await expect(nftoken.tokenOfOwnerByIndex(bob.address, 1)).to.be.reverted;

        tokenId = await nftoken.tokenOfOwnerByIndex(sara.address, 0);
        expect(tokenId).to.equal(id2);

        await nftoken.connect(sara).approve(jane.address, id2);
        await nftoken.connect(jane).transferFrom(sara.address, bob.address, id2);

        await expect(nftoken.tokenOfOwnerByIndex(sara.address, 0)).to.be.reverted;

        tokenId = await nftoken.tokenOfOwnerByIndex(bob.address, 1);
        expect(tokenId).to.equal(id2);
    });

    it("throws when trying to get token of owner by non-existing index", async function () {
        await nftoken.mint(accounts[1].address, id1);
        await nftoken.mint(accounts[2].address, id3);

        await expect(nftoken.tokenOfOwnerByIndex(accounts[1].address, 4)).to.be.reverted;
    });

    /*
    SU SQUARES DOES NOT SUPPORT BURNING
    it("correctly burns a NFT", async function () {
      ...
    });
    */
});
