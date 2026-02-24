import { getWeb3Config } from "../config/index.js";
import { createDebugLogger } from "../config/logger.js";
import { getReadContractFn } from "./pricing.js";

const log = createDebugLogger("service-unpersonalize");

const PRIMARY_ABI = [
    {
        constant: false,
        inputs: [
            { name: "_squareId", type: "uint256" },
            { name: "_rgbData", type: "bytes" },
            { name: "_title", type: "string" },
            { name: "_href", type: "string" },
        ],
        name: "personalizeSquare",
        outputs: [],
        payable: true,
        stateMutability: "payable",
        type: "function",
    },
    {
        constant: true,
        inputs: [{ name: "_tokenId", type: "uint256" }],
        name: "ownerOf",
        outputs: [{ name: "_owner", type: "address" }],
        payable: false,
        stateMutability: "view",
        type: "function",
    },
];

// 300 bytes of zeros (10x10 pixels × 3 bytes RGB each)
const EMPTY_RGB_DATA = "0x" + "00".repeat(300);

/**
 * Get the unpersonalization price in wei.
 * Uses the same personalizePriceEth from runtime config.
 * @returns {bigint}
 */
function getUnpersonalizePriceWei() {
    const { pricing } = getWeb3Config();
    const ethPrice = pricing?.personalizePriceEth ?? 0.001;
    // Convert ETH to wei (1 ETH = 10^18 wei)
    return BigInt(Math.floor(ethPrice * 1e18));
}

/**
 * Check the owner of a square on the primary contract.
 * @param {number} squareId - Square token id (1–10000).
 * @param {object} wagmi - Loaded wagmi client bundle.
 * @returns {Promise<string>} - Owner address
 */
export async function checkSquareOwner(squareId, wagmi) {
    const { contracts, activeNetwork } = getWeb3Config();
    log("checkSquareOwner", {
        squareId,
        address: contracts.primary,
        chainId: activeNetwork.chainId,
        rpcUrls: activeNetwork.rpcUrls,
    });

    const readContract = getReadContractFn(wagmi);
    if (!readContract) {
        const available = wagmi ? Object.keys(wagmi).join(", ") : "wagmi is null/undefined";
        const configKeys = wagmi?.config ? Object.keys(wagmi.config).join(", ") : "no config";
        throw new Error(`Ownership check failed: no readContract available. wagmi keys: [${available}], config keys: [${configKeys}]`);
    }

    log("Calling ownerOf with readContract", {
        hasReadContract: !!readContract,
        readContractType: typeof readContract,
    });

    const owner = await readContract({
        address: contracts.primary,
        abi: PRIMARY_ABI,
        functionName: "ownerOf",
        args: [BigInt(squareId)],
        chainId: activeNetwork.chainId,
    });

    log("ownerOf result", { owner });
    return owner;
}

/**
 * Unpersonalize a Square on the primary contract.
 * This clears any personalization by sending empty data.
 * @param {{ squareId: number }} args
 * @param {object} wagmi - Loaded wagmi client bundle.
 * @returns {Promise<{ hash: `0x${string}` }>}
 */
export async function unpersonalizePrimary(args, wagmi) {
    const { squareId } = args;
    const { contracts, activeNetwork } = getWeb3Config();
    log("unpersonalizePrimary", { squareId, address: contracts.primary });

    const value = getUnpersonalizePriceWei();

    return wagmi.writeContract({
        address: contracts.primary,
        abi: PRIMARY_ABI,
        functionName: "personalizeSquare",
        args: [squareId, EMPTY_RGB_DATA, "", ""],
        value,
        chainId: activeNetwork.chainId,
    });
}

/**
 * Check personalization status on the main contract.
 * @param {number} squareId - Square token id (1–10000).
 * @returns {Promise<{ isOnMain: boolean, isEmpty: boolean, hasPersonalization: boolean, wasPersonalizedOnMain: boolean, message: string }>}
 */
export async function checkMainContractStatus(squareId) {
    try {
        const { chain, assetBases } = getWeb3Config();
        const assetBase = assetBases?.[chain] || "/build";
        const baseUrl = window.location.origin + assetBase;

        log("Fetching square data from", baseUrl);

        const [extraRes, persRes] = await Promise.all([
            fetch(`${baseUrl}/squareExtra.json`),
            fetch(`${baseUrl}/squarePersonalizations.json`),
        ]);

        const [extra, personalizations] = await Promise.all([
            extraRes.json(),
            persRes.json(),
        ]);

        const idx = squareId - 1;
        const extraData = extra[idx]; // [minBlock, maxBlock, isOnMain, version] or null
        const persData = personalizations[idx]; // [title, url] or null

        // Check if isOnMain flag is true (3rd element in extra array)
        const isOnMain = extraData?.[2] === true;
        const version = Number(extraData?.[3] ?? 0);
        const wasPersonalizedOnMain = version > 0;

        const hasPersonalizationData =
            Array.isArray(persData) &&
            persData.some((value) => typeof value === "string" && value.trim().length > 0);
        // Check if personalization data is empty (unpersonalized state)
        const isEmpty =
            Array.isArray(persData) &&
            persData.length >= 2 &&
            persData[0] === "" &&
            persData[1] === "";

        let message = "";
        if (wasPersonalizedOnMain) {
            if (isOnMain && hasPersonalizationData) {
                message = "✓ Square is personalized on the main contract and can be safely unpersonalized.";
            } else if (isEmpty) {
                message = "⚠️ Square was already unpersonalized on the main contract, so it currently defaults to the underlay. No need to unpersonalize again.";
            } else {
                message = "⚠️ Square was personalized on the main contract, but no metadata currently lives there, so it already falls back to the underlay.";
            }
        } else {
            message = "⚠️ Square has never been personalized on the main contract, so there is nothing to unpersonalize.";
        }

        return {
            isOnMain,
            isEmpty,
            hasPersonalization: Boolean(isOnMain && hasPersonalizationData),
            wasPersonalizedOnMain,
            message,
        };
    } catch (error) {
        log("Failed to fetch square data", error);
        return {
            isOnMain: true,
            isEmpty: false,
            hasPersonalization: false,
            wasPersonalizedOnMain: false,
            message: "Could not verify status. Proceeding anyway."
        };
    }
}

/**
 * Check if a square is personalized on the main contract.
 * @param {number} squareId - Square token id (1–10000).
 * @returns {Promise<boolean>} - True if personalized on main contract
 */
export async function isPersonalizedOnMain(squareId) {
    const status = await checkMainContractStatus(squareId);
    return status.isOnMain;
}

export { PRIMARY_ABI };
