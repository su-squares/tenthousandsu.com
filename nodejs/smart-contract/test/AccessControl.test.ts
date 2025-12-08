import { expect } from "chai";
import { ethers } from "hardhat";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { deployAccessControlTestMock } from "./helpers/deploy";

describe("AccessControl", function () {
    let subject: Awaited<ReturnType<typeof deployAccessControlTestMock>>;
    let owner: HardhatEthersSigner;
    let addr1: HardhatEthersSigner;
    let addr2: HardhatEthersSigner;
    const someAddress = "0x0000000000000000000000000000000000001234";

    beforeEach(async function () {
        [owner, addr1, addr2] = await ethers.getSigners();
        subject = await deployAccessControlTestMock();
    });

    describe("CEO role tests", function () {
        it("should initialize CEO to contract deployer", async function () {
            const ceo = await subject.executiveOfficerAddress();
            expect(ceo).to.equal(owner.address);
        });

        it("should not set CEO to zero address", async function () {
            await expect(
                subject.setExecutiveOfficer(ethers.ZeroAddress)
            ).to.be.reverted;
        });

        it("should set CEO to a new value", async function () {
            await subject.setExecutiveOfficer(someAddress);
            const ceo = await subject.executiveOfficerAddress();
            expect(ceo).to.equal(someAddress);
        });

        it("CEO can run executive tasks", async function () {
            await subject.anExecutiveTask();
            // If we get here without reverting, the test passes
        });

        it("CEO can set all officers", async function () {
            await subject.setOperatingOfficer(someAddress);
            await subject.setFinancialOfficer(someAddress);
            // We lose permissions after setting a new CEO
            await subject.setExecutiveOfficer(someAddress);
        });

        it("non-CEO cannot run executive tasks", async function () {
            await subject.setExecutiveOfficer(someAddress);
            // owner is no longer CEO
            await expect(subject.anExecutiveTask()).to.be.reverted;
        });

        it("non-CEO cannot assign new CEO", async function () {
            await subject.setExecutiveOfficer(someAddress);
            await expect(subject.setExecutiveOfficer(addr1.address)).to.be.reverted;
        });

        it("non-CEO cannot assign new COO", async function () {
            await subject.setExecutiveOfficer(someAddress);
            await expect(subject.setOperatingOfficer(addr1.address)).to.be.reverted;
        });

        it("non-CEO cannot assign new CFO", async function () {
            await subject.setExecutiveOfficer(someAddress);
            await expect(subject.setFinancialOfficer(addr1.address)).to.be.reverted;
        });
    });

    describe("COO role tests", function () {
        it("should not set COO to zero address", async function () {
            await expect(
                subject.setOperatingOfficer(ethers.ZeroAddress)
            ).to.be.reverted;
        });

        it("should set COO to a new value", async function () {
            await subject.setOperatingOfficer(someAddress);
            const coo = await subject.operatingOfficerAddress();
            expect(coo).to.equal(someAddress);
        });

        it("COO can run operating tasks", async function () {
            await subject.setOperatingOfficer(owner.address);
            await subject.setExecutiveOfficer(someAddress);
            // We have now renounced CEO privileges, but we are COO
            await subject.anOperatingTask();
        });

        it("non-COO cannot run operating tasks", async function () {
            await subject.setExecutiveOfficer(someAddress);
            // owner is not COO
            await expect(subject.anOperatingTask()).to.be.reverted;
        });
    });

    describe("CFO role tests", function () {
        it("should not set CFO to zero address", async function () {
            await expect(
                subject.setFinancialOfficer(ethers.ZeroAddress)
            ).to.be.reverted;
        });

        it("should set CFO to a new value", async function () {
            await subject.setFinancialOfficer(someAddress);
            const cfo = await subject.financialOfficerAddress();
            expect(cfo).to.equal(someAddress);
        });

        it("CFO can run financial tasks", async function () {
            await subject.setFinancialOfficer(owner.address);
            await subject.setExecutiveOfficer(someAddress);
            // We have now renounced CEO privileges, but we are CFO
            await subject.aFinancialTask();
        });

        it("CFO can withdraw balance", async function () {
            await subject.setFinancialOfficer(owner.address);
            await subject.setExecutiveOfficer(someAddress);
            await subject.withdrawBalance();
        });

        it("non-CFO cannot run financial tasks", async function () {
            await subject.setFinancialOfficer(someAddress);
            // owner is not CFO
            await expect(subject.aFinancialTask()).to.be.reverted;
        });

        it("non-CFO cannot withdraw balance", async function () {
            await subject.setFinancialOfficer(someAddress);
            await expect(subject.withdrawBalance()).to.be.reverted;
        });
    });
});
