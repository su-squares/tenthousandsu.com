import { ethers } from "hardhat";

/**
 * Deploy test helper functions for Hardhat tests
 */

/** Default test values for contract deployment */
export const TEST_DEFAULTS = {
    tokenUriBase: "https://tenthousandsu.com/erc721/",
    salePrice: ethers.parseEther("0.5"),
    promoCreationLimit: 5000n,
    personalizationPrice: ethers.parseEther("0.01"),
};

/**
 * Deploy the SuNFTTestMock contract for NFT testing
 */
export const deploySuNFTTestMock = async (): Promise<any> => {
    const SuNFTTestMock = await ethers.getContractFactory("SuNFTTestMock");
    const contract = await SuNFTTestMock.deploy();
    await contract.waitForDeployment();
    return contract;
};

/**
 * Deploy the ERC721ReceiverTestMock for safe transfer testing
 */
export const deployERC721ReceiverMock = async (): Promise<any> => {
    const ERC721ReceiverTestMock = await ethers.getContractFactory("ERC721ReceiverTestMock");
    const contract = await ERC721ReceiverTestMock.deploy();
    await contract.waitForDeployment();
    return contract;
};

/**
 * Deploy the AccessControlTestMock for role-based access testing
 */
export const deployAccessControlTestMock = async (): Promise<any> => {
    const AccessControlTestMock = await ethers.getContractFactory("AccessControlTestMock");
    const contract = await AccessControlTestMock.deploy();
    await contract.waitForDeployment();
    return contract;
};

/**
 * Deploy the SuOperationTestMock for personalization testing
 */
export const deploySuOperationTestMock = async (): Promise<any> => {
    const SuOperationTestMock = await ethers.getContractFactory("SuOperationTestMock");
    const contract = await SuOperationTestMock.deploy();
    await contract.waitForDeployment();
    return contract;
};

/**
 * Deploy the SuVendingTestMock for purchase/vending testing
 */
export const deploySuVendingTestMock = async (): Promise<any> => {
    const SuVendingTestMock = await ethers.getContractFactory("SuVendingTestMock");
    const contract = await SuVendingTestMock.deploy();
    await contract.waitForDeployment();
    return contract;
};

/**
 * Deploy the SuPromoTestMock for promotional square testing
 */
export const deploySuPromoTestMock = async (): Promise<any> => {
    const SuPromoTestMock = await ethers.getContractFactory("SuPromoTestMock");
    const contract = await SuPromoTestMock.deploy();
    await contract.waitForDeployment();
    return contract;
};

/**
 * Deploy the SupportsInterfaceTestMock for ERC-165 testing
 */
export const deploySupportsInterfaceTestMock = async (): Promise<any> => {
    const SupportsInterfaceTestMock = await ethers.getContractFactory("SupportsInterfaceTestMock");
    const contract = await SupportsInterfaceTestMock.deploy();
    await contract.waitForDeployment();
    return contract;
};

interface SuMainDeployArgs {
    tokenUriBase?: string;
    salePrice?: bigint;
    promoCreationLimit?: bigint;
    personalizationPrice?: bigint;
}

/**
 * Deploy the full SuMain contract with test defaults
 */
export const deploySuMain = async (args: SuMainDeployArgs = {}): Promise<any> => {
    const {
        tokenUriBase = TEST_DEFAULTS.tokenUriBase,
        salePrice = TEST_DEFAULTS.salePrice,
        promoCreationLimit = TEST_DEFAULTS.promoCreationLimit,
        personalizationPrice = TEST_DEFAULTS.personalizationPrice,
    } = args;

    const SuMain = await ethers.getContractFactory("SuMain");
    const contract = await SuMain.deploy(
        tokenUriBase,
        salePrice,
        promoCreationLimit,
        personalizationPrice
    );
    await contract.waitForDeployment();
    return contract;
};
