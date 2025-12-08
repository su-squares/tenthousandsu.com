import { expect } from "chai";
import { ethers } from "hardhat";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { deploySuPromoTestMock } from "./helpers/deploy";

describe("SuPromo", function () {
    let subject: Awaited<ReturnType<typeof deploySuPromoTestMock>>;
    let owner: HardhatEthersSigner;
    let recipient: HardhatEthersSigner;

    const SQUARE_ID = 721n;
    const someAddress = "0x0000000000000000000000000000000000001234";

    beforeEach(async function () {
        [owner, recipient] = await ethers.getSigners();
        subject = await deploySuPromoTestMock();
    });

    describe("Grant should work", function () {
        it("should grant one token", async function () {
            await subject.setOperatingOfficer(owner.address);

            // Should start with no promos granted
            expect(await subject.promoCreatedCount()).to.equal(0n);

            await subject.grantToken(SQUARE_ID, someAddress);

            // Should increment if one granted
            expect(await subject.promoCreatedCount()).to.equal(1n);

            // Should grant to correct owner
            const tokenOwner = await subject.ownerOf(SQUARE_ID);
            expect(tokenOwner).to.equal(someAddress);
        });
    });

    describe("Grant should be disallowed sometimes", function () {
        it("should fail to regrant already granted token", async function () {
            await subject.setOperatingOfficer(owner.address);
            await subject.grantToken(SQUARE_ID, someAddress);

            // Try to grant again
            await expect(
                subject.grantToken(SQUARE_ID, recipient.address)
            ).to.be.reverted;
        });

        it("should fail to grant already owned token", async function () {
            await subject.stealSquare(SQUARE_ID);
            await subject.setOperatingOfficer(owner.address);

            await expect(
                subject.grantToken(SQUARE_ID, someAddress)
            ).to.be.reverted;
        });

        it("should fail to grant bogus square 0", async function () {
            await subject.setOperatingOfficer(owner.address);

            await expect(
                subject.grantToken(0n, someAddress)
            ).to.be.reverted;
        });

        it("should fail to grant bogus square 10001", async function () {
            await subject.setOperatingOfficer(owner.address);

            await expect(
                subject.grantToken(10001n, someAddress)
            ).to.be.reverted;
        });

        it("should fail to grant when promo limit reached", async function () {
            await subject.setOperatingOfficer(owner.address);
            await subject.useUpAllGrants();

            await expect(
                subject.grantToken(SQUARE_ID, someAddress)
            ).to.be.reverted;
        });
    });
});
