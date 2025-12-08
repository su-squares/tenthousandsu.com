import { expect } from "chai";
import { ethers } from "hardhat";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { deploySuOperationTestMock } from "./helpers/deploy";

describe("SuOperation", function () {
    let subject: Awaited<ReturnType<typeof deploySuOperationTestMock>>;
    let owner: HardhatEthersSigner;
    let addr1: HardhatEthersSigner;

    const SQUARE_ID = 721n;
    // 10x10 grid = 100 pixels * 3 bytes (RGB) = 300 bytes
    const RGB_DATA = "0x" + "070201".repeat(100);
    const TITLE = "Su Squares: Cute squares you own and personalize";
    const ANOTHER_TITLE = "Su Squares: Cute squares you own and personalizeXX";
    const HREF = "https://tenthousandsu.com";

    // Invalid RGB data (301 bytes - too much)
    const RGB_DATA_TOO_MUCH = "0x" + "070201".repeat(100) + "99";
    // Invalid RGB data (299 bytes - too little)
    const RGB_DATA_TOO_LITTLE = "0x" + "070201".repeat(99) + "0702";
    // Invalid title (65 chars - too much)
    const TITLE_TOO_LONG = "Su Squares: Cute squares you own and personalizexxxxxxxxxxxxxxxxx";
    // Invalid href (100 chars - too much)
    const HREF_TOO_LONG = "https://tenthousandsu.comxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx";

    beforeEach(async function () {
        [owner, addr1] = await ethers.getSigners();
        subject = await deploySuOperationTestMock();
    });

    describe("Personalize and get back data", function () {
        it("should personalize a square and store data correctly", async function () {
            await subject.stealSquare(SQUARE_ID);
            await subject.personalizeSquare(SQUARE_ID, RGB_DATA, TITLE, HREF);

            const result = await subject.suSquares(SQUARE_ID);
            expect(result.title).to.equal(TITLE);
            expect(result.href).to.equal(HREF);
            // Compare RGB data by hash
            expect(ethers.keccak256(result.rgbData)).to.equal(ethers.keccak256(RGB_DATA));
        });
    });

    describe("Version increments", function () {
        it("should increment version on each personalization", async function () {
            await subject.stealSquare(SQUARE_ID);

            // Initial version should be 0
            let result = await subject.suSquares(SQUARE_ID);
            expect(result.version).to.equal(0n);

            // First personalization
            await subject.personalizeSquare(SQUARE_ID, RGB_DATA, TITLE, HREF);
            result = await subject.suSquares(SQUARE_ID);
            expect(result.version).to.equal(1n);

            // Second personalization
            await subject.personalizeSquare(SQUARE_ID, RGB_DATA, ANOTHER_TITLE, HREF);
            result = await subject.suSquares(SQUARE_ID);
            expect(result.version).to.equal(2n);
        });
    });

    describe("Personalization call cost", function () {
        it("first three personalizations should be free", async function () {
            await subject.stealSquare(SQUARE_ID);

            await subject.personalizeSquare(SQUARE_ID, RGB_DATA, TITLE, HREF);
            await subject.personalizeSquare(SQUARE_ID, RGB_DATA, ANOTHER_TITLE, HREF);
            await subject.personalizeSquare(SQUARE_ID, RGB_DATA, TITLE, HREF);
            // All three should succeed without payment
        });

        it("fourth personalization should work with payment", async function () {
            await subject.stealSquare(SQUARE_ID);

            await subject.personalizeSquare(SQUARE_ID, RGB_DATA, TITLE, HREF);
            await subject.personalizeSquare(SQUARE_ID, RGB_DATA, TITLE, HREF);
            await subject.personalizeSquare(SQUARE_ID, RGB_DATA, TITLE, HREF);
            // Fourth personalization requires payment
            await subject.personalizeSquare(SQUARE_ID, RGB_DATA, TITLE, HREF, {
                value: ethers.parseEther("0.01")
            });
        });

        it("fourth personalization should fail without payment", async function () {
            await subject.stealSquare(SQUARE_ID);

            await subject.personalizeSquare(SQUARE_ID, RGB_DATA, TITLE, HREF);
            await subject.personalizeSquare(SQUARE_ID, RGB_DATA, TITLE, HREF);
            await subject.personalizeSquare(SQUARE_ID, RGB_DATA, TITLE, HREF);
            // Fourth without payment should fail
            await expect(
                subject.personalizeSquare(SQUARE_ID, RGB_DATA, TITLE, HREF)
            ).to.be.reverted;
        });
    });

    describe("Invalid personalizations", function () {
        it("should not personalize without authorization", async function () {
            // Not stealing first - we don't own it
            await expect(
                subject.connect(addr1).personalizeSquare(SQUARE_ID, RGB_DATA, TITLE, HREF)
            ).to.be.reverted;
        });

        it("should not personalize with too much RGB data", async function () {
            await subject.stealSquare(SQUARE_ID);
            await expect(
                subject.personalizeSquare(SQUARE_ID, RGB_DATA_TOO_MUCH, TITLE, HREF)
            ).to.be.reverted;
        });

        it("should not personalize with too little RGB data", async function () {
            await subject.stealSquare(SQUARE_ID);
            await expect(
                subject.personalizeSquare(SQUARE_ID, RGB_DATA_TOO_LITTLE, TITLE, HREF)
            ).to.be.reverted;
        });

        it("should not personalize with too long title", async function () {
            await subject.stealSquare(SQUARE_ID);
            await expect(
                subject.personalizeSquare(SQUARE_ID, RGB_DATA, TITLE_TOO_LONG, HREF)
            ).to.be.reverted;
        });

        it("should not personalize with too long href", async function () {
            await subject.stealSquare(SQUARE_ID);
            await expect(
                subject.personalizeSquare(SQUARE_ID, RGB_DATA, TITLE, HREF_TOO_LONG)
            ).to.be.reverted;
        });
    });
});
