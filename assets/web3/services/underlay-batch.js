import { getWeb3Config } from "../config/index.js";
import { createDebugLogger } from "../config/logger.js";
import { getPersonalizePriceWei } from "./pricing.js";

const log = createDebugLogger("service-underlay-batch");

const UNDERLAY_BATCH_ABI = [
  {
    inputs: [
      {
        components: [
          { internalType: "uint256", name: "squareId", type: "uint256" },
          { internalType: "bytes", name: "rgbData", type: "bytes" },
          { internalType: "string", name: "title", type: "string" },
          { internalType: "string", name: "href", type: "string" },
        ],
        internalType: "struct SuSquaresUnderlay.Personalization[]",
        name: "personalizations",
        type: "tuple[]",
      },
    ],
    name: "personalizeSquareUnderlayBatch",
    outputs: [],
    stateMutability: "payable",
    type: "function",
  },
  {
    inputs: [],
    name: "pricePerSquare",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
];

/**
 * Batch personalize Squares on the underlay contract.
 * @param {Array<{ squareId: number, rgbData: `0x${string}`, title: string, href: string }>} personalizations
 * @param {import("@wagmi/core").Config} wagmi - Loaded wagmi client bundle.
 * @returns {Promise<{ hash: `0x${string}` }>}
 */
export async function personalizeUnderlayBatch(personalizations, wagmi) {
  const { contracts } = getWeb3Config();
  log("personalizeUnderlayBatch", { count: personalizations?.length || 0, address: contracts.underlay });
  const pricePerSquare = await getPersonalizePriceWei(wagmi);
  const value = BigInt(personalizations.length) * pricePerSquare;
  return wagmi.writeContract({
    address: contracts.underlay,
    abi: UNDERLAY_BATCH_ABI,
    functionName: "personalizeSquareUnderlayBatch",
    args: [personalizations],
    value,
  });
}

export { UNDERLAY_BATCH_ABI };
