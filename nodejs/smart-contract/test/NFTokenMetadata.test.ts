import { expect } from "chai";
import { ethers } from "hardhat";
import { deploySuNFTTestMock } from "./helpers/deploy";

describe("NFTokenMetadataMock", function () {
    let nftoken: Awaited<ReturnType<typeof deploySuNFTTestMock>>;

    const id2 = 2n;
    const id4 = 40000n;
    const expectedSymbol = "SU";
    const expectedName = "Su Squares";

    beforeEach(async function () {
        nftoken = await deploySuNFTTestMock();
    });

    it("correctly checks all the supported interfaces", async function () {
        const nftokenInterface = await nftoken.supportsInterface("0x80ac58cd");
        const nftokenMetadataInterface = await nftoken.supportsInterface("0x5b5e139f");
        const nftokenNonExistingInterface = await nftoken.supportsInterface("0xba5eba11");
        expect(nftokenInterface).to.equal(true);
        expect(nftokenMetadataInterface).to.equal(true);
        expect(nftokenNonExistingInterface).to.equal(false);
    });

    it("returns the correct issuer name", async function () {
        const name = await nftoken.name();
        expect(name).to.equal(expectedName);
    });

    it("returns the correct issuer symbol", async function () {
        const symbol = await nftoken.symbol();
        expect(symbol).to.equal(expectedSymbol);
    });

    it("correctly mints and checks NFT id 2 url", async function () {
        const tokenURI = await nftoken.tokenURI(id2);
        expect(tokenURI).to.equal("https://tenthousandsu.com/erc721/00002.json");
    });

    it("throws when trying to get URI of invalid NFT ID", async function () {
        await expect(nftoken.tokenURI(id4)).to.be.reverted;
    });

    /*
    SU SQUARES DOES NOT SUPPORT BURNING
    it("correctly burns a NFT", async function () {
      ...
    });
    */
});
