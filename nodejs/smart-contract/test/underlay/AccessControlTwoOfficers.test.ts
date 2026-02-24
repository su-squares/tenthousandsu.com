import { expect } from "chai";
import { ethers } from "hardhat";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("AccessControlTwoOfficers", function () {
    let contract: any;
    let deployer: HardhatEthersSigner;
    let newExec: HardhatEthersSigner;
    let cfo: HardhatEthersSigner;
    let other: HardhatEthersSigner;

    beforeEach(async function () {
        [deployer, newExec, cfo, other] = await ethers.getSigners();
        const Factory = await ethers.getContractFactory("AccessControlTwoOfficersMock");
        contract = await Factory.deploy();
        await contract.waitForDeployment();
    });

    describe("Deployment", function () {
        it("sets deployer as executiveOfficer", async function () {
            expect(await contract.executiveOfficer()).to.equal(deployer.address);
        });

        it("financialOfficer starts as zero address", async function () {
            expect(await contract.financialOfficer()).to.equal(ethers.ZeroAddress);
        });
    });

    describe("setExecutiveOfficer", function () {
        it("allows executive to set new executive", async function () {
            await contract.setExecutiveOfficer(newExec.address);
            expect(await contract.executiveOfficer()).to.equal(newExec.address);
        });

        it("reverts when non-executive calls", async function () {
            await expect(
                contract.connect(other).setExecutiveOfficer(newExec.address)
            ).to.be.reverted;
        });

        it("reverts when setting to zero address", async function () {
            await expect(
                contract.setExecutiveOfficer(ethers.ZeroAddress)
            ).to.be.reverted;
        });

        it("old executive cannot call after transfer", async function () {
            await contract.setExecutiveOfficer(newExec.address);
            await expect(
                contract.connect(deployer).setExecutiveOfficer(other.address)
            ).to.be.reverted;
        });

        it("new executive can make further changes", async function () {
            await contract.setExecutiveOfficer(newExec.address);
            await contract.connect(newExec).setExecutiveOfficer(other.address);
            expect(await contract.executiveOfficer()).to.equal(other.address);
        });
    });

    describe("setFinancialOfficer", function () {
        it("allows executive to set financial officer", async function () {
            await contract.setFinancialOfficer(cfo.address);
            expect(await contract.financialOfficer()).to.equal(cfo.address);
        });

        it("reverts when non-executive calls", async function () {
            await expect(
                contract.connect(other).setFinancialOfficer(cfo.address)
            ).to.be.reverted;
        });

        it("reverts when setting to zero address", async function () {
            await expect(
                contract.setFinancialOfficer(ethers.ZeroAddress)
            ).to.be.reverted;
        });
    });

    describe("withdrawBalance", function () {
        const fundAmount = ethers.parseEther("1.0");

        beforeEach(async function () {
            // Set CFO first
            await contract.setFinancialOfficer(cfo.address);
            // Fund the contract
            await deployer.sendTransaction({
                to: await contract.getAddress(),
                value: fundAmount,
            });
        });

        it("allows financial officer to withdraw full balance", async function () {
            const contractAddr = await contract.getAddress();
            const cfoBefore = await ethers.provider.getBalance(cfo.address);
            const contractBefore = await ethers.provider.getBalance(contractAddr);

            expect(contractBefore).to.equal(fundAmount);

            const tx = await contract.connect(cfo).withdrawBalance();
            const receipt = await tx.wait();
            const gasCost = receipt.gasUsed * BigInt(tx.gasPrice!);

            const cfoAfter = await ethers.provider.getBalance(cfo.address);
            const contractAfter = await ethers.provider.getBalance(contractAddr);

            expect(contractAfter).to.equal(0n);
            expect(cfoAfter).to.equal(cfoBefore + fundAmount - gasCost);
        });

        it("reverts when non-financial officer calls", async function () {
            await expect(
                contract.connect(other).withdrawBalance()
            ).to.be.reverted;
        });

        it("reverts when executive (non-CFO) calls", async function () {
            await expect(
                contract.connect(deployer).withdrawBalance()
            ).to.be.reverted;
        });
    });

    describe("withdrawBalance before CFO set", function () {
        it("reverts when financial officer is zero address", async function () {
            // Fund the contract without setting CFO
            await deployer.sendTransaction({
                to: await contract.getAddress(),
                value: ethers.parseEther("1.0"),
            });

            // Nobody can withdraw because msg.sender can never equal address(0)
            await expect(
                contract.connect(deployer).withdrawBalance()
            ).to.be.reverted;

            await expect(
                contract.connect(other).withdrawBalance()
            ).to.be.reverted;
        });
    });
});
