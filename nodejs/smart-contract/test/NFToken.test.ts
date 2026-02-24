import { expect } from "chai";
import { ethers } from "hardhat";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { deploySuNFTTestMock, deployERC721ReceiverMock } from "./helpers/deploy";

describe("NFTokenMock", function () {
    let nftoken: Awaited<ReturnType<typeof deploySuNFTTestMock>>;
    let tokenReceiverMock: Awaited<ReturnType<typeof deployERC721ReceiverMock>>;
    let accounts: HardhatEthersSigner[];

    const id1 = 1n;
    const id2 = 2n;
    const id3 = 3n;
    const id4 = 40000n;

    beforeEach(async function () {
        accounts = await ethers.getSigners();
        nftoken = await deploySuNFTTestMock();
    });

    it("correctly checks all the supported interfaces", async function () {
        const nftokenInterface = await nftoken.supportsInterface("0x80ac58cd");
        const nftokenNonExistingInterface = await nftoken.supportsInterface("0xba5eba11");
        expect(nftokenInterface).to.equal(true);
        expect(nftokenNonExistingInterface).to.equal(false);
    });

    it("returns correct balanceOf after mint", async function () {
        await nftoken.mint(accounts[0].address, id1);
        const count = await nftoken.balanceOf(accounts[0].address);
        expect(count).to.equal(1n);
    });

    it("throws when trying to mint 2 NFTs with the same claim", async function () {
        await nftoken.mint(accounts[0].address, id2);
        await expect(nftoken.mint(accounts[0].address, id2)).to.be.reverted;
    });

    it("throws trying to mint NFT with empty claim", async function () {
        // In this contract, empty claim means tokenId 0 which is invalid
        await expect(nftoken.mint(accounts[0].address, 0n)).to.be.reverted;
    });

    it("throws when trying to mint NFT to 0x0 address", async function () {
        await expect(nftoken.mint(ethers.ZeroAddress, id3)).to.be.reverted;
    });

    it("finds the correct amount of NFTs owned by account", async function () {
        await nftoken.mint(accounts[1].address, id2);
        await nftoken.mint(accounts[1].address, id3);
        const count = await nftoken.balanceOf(accounts[1].address);
        expect(count).to.equal(2n);
    });

    it("throws when trying to get count of NFTs owned by 0x0 address", async function () {
        await expect(nftoken.balanceOf(ethers.ZeroAddress)).to.be.reverted;
    });

    it("finds the correct owner of NFToken id", async function () {
        await nftoken.mint(accounts[1].address, id2);
        const address = await nftoken.ownerOf(id2);
        expect(address).to.equal(accounts[1].address);
    });

    it("throws when trying to find owner of non-existing NFT id", async function () {
        await expect(nftoken.ownerOf(id4)).to.be.reverted;
    });

    it("correctly approves account", async function () {
        await nftoken.mint(accounts[0].address, id2);
        const tx = await nftoken.approve(accounts[1].address, id2);
        await expect(tx).to.emit(nftoken, "Approval");

        const address = await nftoken.getApproved(id2);
        expect(address).to.equal(accounts[1].address);
    });

    it("correctly cancels approval of account[1]", async function () {
        await nftoken.mint(accounts[0].address, id2);
        await nftoken.approve(accounts[1].address, id2);
        await nftoken.approve(ethers.ZeroAddress, id2);
        const address = await nftoken.getApproved(id2);
        expect(address).to.equal(ethers.ZeroAddress);
    });

    it("throws when trying to get approval of non-existing NFT id", async function () {
        await expect(nftoken.getApproved(id4)).to.be.reverted;
    });

    it("throws when trying to approve NFT ID which it does not own", async function () {
        await nftoken.mint(accounts[1].address, id2);
        await expect(
            nftoken.connect(accounts[2]).approve(accounts[2].address, id2)
        ).to.be.reverted;
        const address = await nftoken.getApproved(id2);
        expect(address).to.equal(ethers.ZeroAddress);
    });

    it("throws when trying to approve NFT ID which it already owns", async function () {
        await nftoken.mint(accounts[1].address, id2);
        await expect(nftoken.approve(accounts[1].address, id2)).to.be.reverted;
        const address = await nftoken.getApproved(id2);
        expect(address).to.equal(ethers.ZeroAddress);
    });

    it("correctly sets an operator", async function () {
        await nftoken.mint(accounts[0].address, id2);
        const tx = await nftoken.setApprovalForAll(accounts[6].address, true);
        await expect(tx).to.emit(nftoken, "ApprovalForAll");
        const isApprovedForAll = await nftoken.isApprovedForAll(accounts[0].address, accounts[6].address);
        expect(isApprovedForAll).to.equal(true);
    });

    it("correctly sets then cancels an operator", async function () {
        await nftoken.mint(accounts[0].address, id2);
        await nftoken.setApprovalForAll(accounts[6].address, true);
        await nftoken.setApprovalForAll(accounts[6].address, false);

        const isApprovedForAll = await nftoken.isApprovedForAll(accounts[0].address, accounts[6].address);
        expect(isApprovedForAll).to.equal(false);
    });

    it("correctly transfers NFT from owner", async function () {
        const sender = accounts[1];
        const recipient = accounts[2];

        await nftoken.mint(sender.address, id2);
        const tx = await nftoken.connect(sender).transferFrom(sender.address, recipient.address, id2);
        await expect(tx).to.emit(nftoken, "Transfer");

        const senderBalance = await nftoken.balanceOf(sender.address);
        const recipientBalance = await nftoken.balanceOf(recipient.address);
        const ownerOfId2 = await nftoken.ownerOf(id2);

        expect(senderBalance).to.equal(0n);
        expect(recipientBalance).to.equal(1n);
        expect(ownerOfId2).to.equal(recipient.address);
    });

    it("correctly transfers NFT from approved address", async function () {
        const sender = accounts[1];
        const recipient = accounts[2];
        const owner = accounts[3];

        await nftoken.mint(owner.address, id2);
        const approveTx = await nftoken.connect(owner).approve(sender.address, id2);
        await expect(approveTx).to.emit(nftoken, "Approval");

        const transferTx = await nftoken.connect(sender).transferFrom(owner.address, recipient.address, id2);
        await expect(transferTx).to.emit(nftoken, "Transfer");

        const ownerBalance = await nftoken.balanceOf(owner.address);
        const recipientBalance = await nftoken.balanceOf(recipient.address);
        const ownerOfId2 = await nftoken.ownerOf(id2);

        expect(ownerBalance).to.equal(0n);
        expect(recipientBalance).to.equal(1n);
        expect(ownerOfId2).to.equal(recipient.address);
    });

    it("correctly transfers NFT as operator", async function () {
        const sender = accounts[1];
        const recipient = accounts[2];
        const owner = accounts[3];

        await nftoken.mint(owner.address, id2);
        await nftoken.connect(owner).setApprovalForAll(sender.address, true);
        const tx = await nftoken.connect(sender).transferFrom(owner.address, recipient.address, id2);
        await expect(tx).to.emit(nftoken, "Transfer");

        const ownerBalance = await nftoken.balanceOf(owner.address);
        const recipientBalance = await nftoken.balanceOf(recipient.address);
        const ownerOfId2 = await nftoken.ownerOf(id2);

        expect(ownerBalance).to.equal(0n);
        expect(recipientBalance).to.equal(1n);
        expect(ownerOfId2).to.equal(recipient.address);
    });

    it("throws when trying to transfer NFT as an address that is not owner, approved or operator", async function () {
        const sender = accounts[1];
        const recipient = accounts[2];
        const owner = accounts[3];

        await nftoken.mint(owner.address, id2);
        await expect(
            nftoken.connect(sender).transferFrom(owner.address, recipient.address, id2)
        ).to.be.reverted;
    });

    it("throws when trying to transfer NFT to a zero address", async function () {
        const owner = accounts[3];

        await nftoken.mint(owner.address, id2);
        await expect(
            nftoken.connect(owner).transferFrom(owner.address, ethers.ZeroAddress, id2)
        ).to.be.reverted;
    });

    it("throws when trying to transfer an invalid NFT", async function () {
        const owner = accounts[3];
        const recipient = accounts[2];

        await nftoken.mint(owner.address, id2);
        await expect(
            nftoken.connect(owner).transferFrom(owner.address, recipient.address, id3)
        ).to.be.reverted;
    });

    it("correctly safe transfers NFT from owner", async function () {
        const sender = accounts[1];
        const recipient = accounts[2];

        await nftoken.mint(sender.address, id2);
        const tx = await nftoken.connect(sender)["safeTransferFrom(address,address,uint256)"](
            sender.address, recipient.address, id2
        );
        await expect(tx).to.emit(nftoken, "Transfer");

        const senderBalance = await nftoken.balanceOf(sender.address);
        const recipientBalance = await nftoken.balanceOf(recipient.address);
        const ownerOfId2 = await nftoken.ownerOf(id2);

        expect(senderBalance).to.equal(0n);
        expect(recipientBalance).to.equal(1n);
        expect(ownerOfId2).to.equal(recipient.address);
    });

    it("throws when trying to safe transfer NFT from owner to a smart contract", async function () {
        const sender = accounts[1];
        const nftokenAddress = await nftoken.getAddress();

        await nftoken.mint(sender.address, id2);
        await expect(
            nftoken.connect(sender)["safeTransferFrom(address,address,uint256)"](
                sender.address, nftokenAddress, id2
            )
        ).to.be.reverted;
    });

    it("correctly safe transfers NFT from owner to smart contract that can receive NFTs", async function () {
        const sender = accounts[1];
        tokenReceiverMock = await deployERC721ReceiverMock();
        const recipient = await tokenReceiverMock.getAddress();

        await nftoken.mint(sender.address, id2);
        const tx = await nftoken.connect(sender)["safeTransferFrom(address,address,uint256)"](
            sender.address, recipient, id2
        );
        await expect(tx).to.emit(nftoken, "Transfer");

        const senderBalance = await nftoken.balanceOf(sender.address);
        const recipientBalance = await nftoken.balanceOf(recipient);
        const ownerOfId2 = await nftoken.ownerOf(id2);

        expect(senderBalance).to.equal(0n);
        expect(recipientBalance).to.equal(1n);
        expect(ownerOfId2).to.equal(recipient);
    });

    /*
    SU SQUARES DOES NOT SUPPORT BURNING
    it("correctly burns a NFT", async function () {
      ...
    });
    */
});
