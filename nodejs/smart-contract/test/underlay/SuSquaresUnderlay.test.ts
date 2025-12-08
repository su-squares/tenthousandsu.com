import { expect } from "chai";
import { ethers } from "hardhat";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("SuSquaresUnderlay", function () {
    let underlay: any;
    let squaresMock: any;
    let deployer: HardhatEthersSigner;
    let user: HardhatEthersSigner;
    let cfo: HardhatEthersSigner;
    let other: HardhatEthersSigner;

    const PRICE = ethers.parseEther("0.01");
    const SQUARE_ID = 1n;
    const VALID_RGB = "0x" + "010203".repeat(100); // 300 bytes
    const VALID_TITLE = "My Square";
    const VALID_HREF = "https://example.com";

    beforeEach(async function () {
        [deployer, user, cfo, other] = await ethers.getSigners();

        // Deploy mock SuSquares
        const MockFactory = await ethers.getContractFactory("SuSquaresOwnerMock");
        squaresMock = await MockFactory.deploy();
        await squaresMock.waitForDeployment();

        // Deploy underlay
        const UnderlayFactory = await ethers.getContractFactory("SuSquaresUnderlay");
        underlay = await UnderlayFactory.deploy(await squaresMock.getAddress(), PRICE);
        await underlay.waitForDeployment();
    });

    describe("Constructor", function () {
        it("stores suSquares address correctly", async function () {
            expect(await underlay.suSquares()).to.equal(await squaresMock.getAddress());
        });

        it("stores pricePerSquare correctly", async function () {
            expect(await underlay.pricePerSquare()).to.equal(PRICE);
        });

        it("reverts when suSquares address is zero", async function () {
            const Factory = await ethers.getContractFactory("SuSquaresUnderlay");
            await expect(
                Factory.deploy(ethers.ZeroAddress, PRICE)
            ).to.be.revertedWith("SuSquares address required");
        });

        it("sets deployer as executiveOfficer", async function () {
            expect(await underlay.executiveOfficer()).to.equal(deployer.address);
        });
    });

    describe("personalizeSquareUnderlay", function () {
        beforeEach(async function () {
            await squaresMock.setOwner(SQUARE_ID, user.address);
        });

        it("succeeds with correct payment and ownership", async function () {
            await expect(
                underlay.connect(user).personalizeSquareUnderlay(
                    SQUARE_ID, VALID_RGB, VALID_TITLE, VALID_HREF,
                    { value: PRICE }
                )
            ).to.emit(underlay, "PersonalizedUnderlay")
                .withArgs(SQUARE_ID, VALID_RGB, VALID_TITLE, VALID_HREF);
        });

        it("reverts when payment is incorrect (too low)", async function () {
            await expect(
                underlay.connect(user).personalizeSquareUnderlay(
                    SQUARE_ID, VALID_RGB, VALID_TITLE, VALID_HREF,
                    { value: PRICE - 1n }
                )
            ).to.be.reverted;
        });

        it("reverts when payment is incorrect (too high)", async function () {
            await expect(
                underlay.connect(user).personalizeSquareUnderlay(
                    SQUARE_ID, VALID_RGB, VALID_TITLE, VALID_HREF,
                    { value: PRICE + 1n }
                )
            ).to.be.reverted;
        });

        it("reverts when payment is zero", async function () {
            await expect(
                underlay.connect(user).personalizeSquareUnderlay(
                    SQUARE_ID, VALID_RGB, VALID_TITLE, VALID_HREF,
                    { value: 0n }
                )
            ).to.be.reverted;
        });

        it("reverts when caller is not owner", async function () {
            await expect(
                underlay.connect(other).personalizeSquareUnderlay(
                    SQUARE_ID, VALID_RGB, VALID_TITLE, VALID_HREF,
                    { value: PRICE }
                )
            ).to.be.revertedWith("Only the Su Square owner may personalize underlay");
        });

        it("reverts when rgbData is too short", async function () {
            const shortRgb = "0x" + "010203".repeat(99); // 297 bytes
            await expect(
                underlay.connect(user).personalizeSquareUnderlay(
                    SQUARE_ID, shortRgb, VALID_TITLE, VALID_HREF,
                    { value: PRICE }
                )
            ).to.be.revertedWith("Pixel data must be 300 bytes: 3 colors (RGB) x 10 columns x 10 rows");
        });

        it("reverts when rgbData is too long", async function () {
            const longRgb = "0x" + "010203".repeat(101); // 303 bytes
            await expect(
                underlay.connect(user).personalizeSquareUnderlay(
                    SQUARE_ID, longRgb, VALID_TITLE, VALID_HREF,
                    { value: PRICE }
                )
            ).to.be.revertedWith("Pixel data must be 300 bytes: 3 colors (RGB) x 10 columns x 10 rows");
        });

        it("reverts when title exceeds 64 bytes", async function () {
            const longTitle = "A".repeat(65);
            await expect(
                underlay.connect(user).personalizeSquareUnderlay(
                    SQUARE_ID, VALID_RGB, longTitle, VALID_HREF,
                    { value: PRICE }
                )
            ).to.be.revertedWith("Title max 64 bytes");
        });

        it("reverts when href exceeds 96 bytes", async function () {
            const longHref = "https://example.com/" + "A".repeat(80);
            await expect(
                underlay.connect(user).personalizeSquareUnderlay(
                    SQUARE_ID, VALID_RGB, VALID_TITLE, longHref,
                    { value: PRICE }
                )
            ).to.be.revertedWith("HREF max 96 bytes");
        });

        it("accepts title at exactly 64 bytes", async function () {
            const maxTitle = "A".repeat(64);
            await expect(
                underlay.connect(user).personalizeSquareUnderlay(
                    SQUARE_ID, VALID_RGB, maxTitle, VALID_HREF,
                    { value: PRICE }
                )
            ).to.emit(underlay, "PersonalizedUnderlay");
        });

        it("accepts href at exactly 96 bytes", async function () {
            const maxHref = "A".repeat(96);
            await expect(
                underlay.connect(user).personalizeSquareUnderlay(
                    SQUARE_ID, VALID_RGB, VALID_TITLE, maxHref,
                    { value: PRICE }
                )
            ).to.emit(underlay, "PersonalizedUnderlay");
        });

        it("accepts empty title and href", async function () {
            await expect(
                underlay.connect(user).personalizeSquareUnderlay(
                    SQUARE_ID, VALID_RGB, "", "",
                    { value: PRICE }
                )
            ).to.emit(underlay, "PersonalizedUnderlay")
                .withArgs(SQUARE_ID, VALID_RGB, "", "");
        });
    });

    describe("personalizeSquareUnderlayBatch", function () {
        const SQUARE_ID_2 = 2n;
        const SQUARE_ID_3 = 3n;

        beforeEach(async function () {
            await squaresMock.setOwner(SQUARE_ID, user.address);
            await squaresMock.setOwner(SQUARE_ID_2, user.address);
            await squaresMock.setOwner(SQUARE_ID_3, user.address);
        });

        it("succeeds with single personalization", async function () {
            const personalizations = [{
                squareId: SQUARE_ID,
                rgbData: VALID_RGB,
                title: VALID_TITLE,
                href: VALID_HREF,
            }];

            await expect(
                underlay.connect(user).personalizeSquareUnderlayBatch(
                    personalizations,
                    { value: PRICE }
                )
            ).to.emit(underlay, "PersonalizedUnderlay")
                .withArgs(SQUARE_ID, VALID_RGB, VALID_TITLE, VALID_HREF);
        });

        it("succeeds with multiple personalizations", async function () {
            const personalizations = [
                { squareId: SQUARE_ID, rgbData: VALID_RGB, title: "Title 1", href: "https://one.com" },
                { squareId: SQUARE_ID_2, rgbData: VALID_RGB, title: "Title 2", href: "https://two.com" },
                { squareId: SQUARE_ID_3, rgbData: VALID_RGB, title: "Title 3", href: "https://three.com" },
            ];

            const tx = await underlay.connect(user).personalizeSquareUnderlayBatch(
                personalizations,
                { value: PRICE * 3n }
            );

            await expect(tx).to.emit(underlay, "PersonalizedUnderlay")
                .withArgs(SQUARE_ID, VALID_RGB, "Title 1", "https://one.com");
            await expect(tx).to.emit(underlay, "PersonalizedUnderlay")
                .withArgs(SQUARE_ID_2, VALID_RGB, "Title 2", "https://two.com");
            await expect(tx).to.emit(underlay, "PersonalizedUnderlay")
                .withArgs(SQUARE_ID_3, VALID_RGB, "Title 3", "https://three.com");
        });

        it("reverts with empty personalizations array", async function () {
            await expect(
                underlay.connect(user).personalizeSquareUnderlayBatch(
                    [],
                    { value: 0n }
                )
            ).to.be.revertedWith("Missing personalizations");
        });

        it("reverts when total payment is incorrect", async function () {
            const personalizations = [
                { squareId: SQUARE_ID, rgbData: VALID_RGB, title: VALID_TITLE, href: VALID_HREF },
                { squareId: SQUARE_ID_2, rgbData: VALID_RGB, title: VALID_TITLE, href: VALID_HREF },
            ];

            // Too little
            await expect(
                underlay.connect(user).personalizeSquareUnderlayBatch(
                    personalizations,
                    { value: PRICE }
                )
            ).to.be.reverted;

            // Too much
            await expect(
                underlay.connect(user).personalizeSquareUnderlayBatch(
                    personalizations,
                    { value: PRICE * 3n }
                )
            ).to.be.reverted;
        });

        it("reverts and rolls back if any item fails owner check", async function () {
            // Third square owned by someone else
            await squaresMock.setOwner(SQUARE_ID_3, other.address);

            const personalizations = [
                { squareId: SQUARE_ID, rgbData: VALID_RGB, title: VALID_TITLE, href: VALID_HREF },
                { squareId: SQUARE_ID_2, rgbData: VALID_RGB, title: VALID_TITLE, href: VALID_HREF },
                { squareId: SQUARE_ID_3, rgbData: VALID_RGB, title: VALID_TITLE, href: VALID_HREF },
            ];

            await expect(
                underlay.connect(user).personalizeSquareUnderlayBatch(
                    personalizations,
                    { value: PRICE * 3n }
                )
            ).to.be.revertedWith("Only the Su Square owner may personalize underlay");
        });

        it("reverts if any item has invalid rgbData", async function () {
            const badRgb = "0x" + "010203".repeat(99);
            const personalizations = [
                { squareId: SQUARE_ID, rgbData: VALID_RGB, title: VALID_TITLE, href: VALID_HREF },
                { squareId: SQUARE_ID_2, rgbData: badRgb, title: VALID_TITLE, href: VALID_HREF },
            ];

            await expect(
                underlay.connect(user).personalizeSquareUnderlayBatch(
                    personalizations,
                    { value: PRICE * 2n }
                )
            ).to.be.revertedWith("Pixel data must be 300 bytes: 3 colors (RGB) x 10 columns x 10 rows");
        });
    });

    describe("Inherited access control", function () {
        it("only executive can set executive officer", async function () {
            await expect(
                underlay.connect(other).setExecutiveOfficer(other.address)
            ).to.be.reverted;

            await underlay.setExecutiveOfficer(other.address);
            expect(await underlay.executiveOfficer()).to.equal(other.address);
        });

        it("only executive can set financial officer", async function () {
            await expect(
                underlay.connect(other).setFinancialOfficer(cfo.address)
            ).to.be.reverted;

            await underlay.setFinancialOfficer(cfo.address);
            expect(await underlay.financialOfficer()).to.equal(cfo.address);
        });

        it("financial officer can withdraw accumulated funds", async function () {
            // Set CFO
            await underlay.setFinancialOfficer(cfo.address);

            // User personalizes a square (sends funds to contract)
            await squaresMock.setOwner(SQUARE_ID, user.address);
            await underlay.connect(user).personalizeSquareUnderlay(
                SQUARE_ID, VALID_RGB, VALID_TITLE, VALID_HREF,
                { value: PRICE }
            );

            const contractBalance = await ethers.provider.getBalance(await underlay.getAddress());
            expect(contractBalance).to.equal(PRICE);

            // CFO withdraws
            const cfoBefore = await ethers.provider.getBalance(cfo.address);
            const tx = await underlay.connect(cfo).withdrawBalance();
            const receipt = await tx.wait();
            const gasCost = receipt.gasUsed * BigInt(tx.gasPrice!);
            const cfoAfter = await ethers.provider.getBalance(cfo.address);

            expect(await ethers.provider.getBalance(await underlay.getAddress())).to.equal(0n);
            expect(cfoAfter).to.equal(cfoBefore + PRICE - gasCost);
        });
    });

    describe("Happy path scenarios", function () {
        it("owner can personalize same square multiple times", async function () {
            await squaresMock.setOwner(SQUARE_ID, user.address);

            // First personalization
            await expect(
                underlay.connect(user).personalizeSquareUnderlay(
                    SQUARE_ID, VALID_RGB, "First Title", "https://first.com",
                    { value: PRICE }
                )
            ).to.emit(underlay, "PersonalizedUnderlay")
                .withArgs(SQUARE_ID, VALID_RGB, "First Title", "https://first.com");

            // Second personalization with different data
            const newRgb = "0x" + "ffffff".repeat(100);
            await expect(
                underlay.connect(user).personalizeSquareUnderlay(
                    SQUARE_ID, newRgb, "Second Title", "https://second.com",
                    { value: PRICE }
                )
            ).to.emit(underlay, "PersonalizedUnderlay")
                .withArgs(SQUARE_ID, newRgb, "Second Title", "https://second.com");
        });
    });
});
