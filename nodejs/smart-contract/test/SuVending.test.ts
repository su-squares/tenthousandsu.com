import { expect } from "chai";
import { ethers } from "hardhat";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { deploySuVendingTestMock } from "./helpers/deploy";

describe("SuVending", function () {
    let subject: Awaited<ReturnType<typeof deploySuVendingTestMock>>;
    let owner: HardhatEthersSigner;
    let buyer: HardhatEthersSigner;

    const SQUARE_ID = 721n;
    const SALE_PRICE = ethers.parseEther("0.5");

    beforeEach(async function () {
        [owner, buyer] = await ethers.getSigners();
        subject = await deploySuVendingTestMock();
    });

    describe("Vending price", function () {
        it("should have 0.5 Ether sale price", async function () {
            const salePrice = await subject.getSalePrice();
            expect(salePrice).to.equal(SALE_PRICE);
        });
    });

    describe("Vending should work", function () {
        it("should vend one square", async function () {
            await subject.purchase(SQUARE_ID, { value: SALE_PRICE });
            const owner_ = await subject.ownerOf(SQUARE_ID);
            expect(owner_).to.equal(owner.address);
        });

        it("should vend one square to buyer", async function () {
            await subject.connect(buyer).purchase(SQUARE_ID, { value: SALE_PRICE });
            const owner_ = await subject.ownerOf(SQUARE_ID);
            expect(owner_).to.equal(buyer.address);
        });
    });

    describe("Vending should be disallowed sometimes", function () {
        it("should fail to revend already purchased square", async function () {
            await subject.purchase(SQUARE_ID, { value: SALE_PRICE });
            await expect(
                subject.connect(buyer).purchase(SQUARE_ID, { value: SALE_PRICE })
            ).to.be.reverted;
        });

        it("should fail to vend already owned square", async function () {
            await subject.stealSquare(SQUARE_ID);
            await expect(
                subject.connect(buyer).purchase(SQUARE_ID, { value: SALE_PRICE })
            ).to.be.reverted;
        });

        it("should fail to vend bogus square 0", async function () {
            await expect(
                subject.purchase(0n, { value: SALE_PRICE })
            ).to.be.reverted;
        });

        it("should fail to vend bogus square 10001", async function () {
            await expect(
                subject.purchase(10001n, { value: SALE_PRICE })
            ).to.be.reverted;
        });

        it("should fail to vend without paying fee", async function () {
            await expect(
                subject.purchase(SQUARE_ID)
            ).to.be.reverted;
        });
    });
});
