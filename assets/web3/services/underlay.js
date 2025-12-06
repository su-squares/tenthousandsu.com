import { getWeb3Config } from "../config/index.js";
import { createDebugLogger } from "../config/logger.js";
import { getPersonalizePriceWei } from "./pricing.js";

const log = createDebugLogger("service-underlay");

const UNDERLAY_ABI = [
  {
    inputs: [
      { internalType: "uint256", name: "squareId", type: "uint256" },
      { internalType: "bytes", name: "rgbData", type: "bytes" },
      { internalType: "string", name: "title", type: "string" },
      { internalType: "string", name: "href", type: "string" },
    ],
    name: "personalizeSquareUnderlay",
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
 * Personalize a single Square on the underlay contract.
 * @param {{ squareId: number, imagePixelsHex: `0x${string}`, title: string, url: string }} args
 * @param {import("@wagmi/core").Config} wagmi - Loaded wagmi client bundle.
 * @returns {Promise<{ hash: `0x${string}` }>}
 */
export async function personalizeUnderlay(args, wagmi) {
  const { squareId, imagePixelsHex, title, url } = args;
  const { contracts } = getWeb3Config();
  log("personalizeUnderlay", { squareId, address: contracts.underlay });
  const value = await getPersonalizePriceWei(wagmi);
  return wagmi.writeContract({
    address: contracts.underlay,
    abi: UNDERLAY_ABI,
    functionName: "personalizeSquareUnderlay",
    args: [squareId, imagePixelsHex, title, url],
    value,
  });
}

export { UNDERLAY_ABI };
