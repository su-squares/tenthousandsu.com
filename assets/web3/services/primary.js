import { getWeb3Config } from "../config/index.js";
import { createDebugLogger } from "../config/logger.js";

const log = createDebugLogger("service-primary");

const PRIMARY_ABI = [
  {
    constant: false,
    inputs: [
      { name: "_tokenId", type: "uint256" },
      { name: "_newOwner", type: "address" },
    ],
    name: "grantToken",
    outputs: [],
    payable: false,
    stateMutability: "nonpayable",
    type: "function",
  },
  { anonymous: false, inputs: [{ indexed: false, name: "_nftId", type: "uint256" }], name: "Personalized", type: "event" },
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
    anonymous: false,
    inputs: [
      { indexed: true, name: "_from", type: "address" },
      { indexed: true, name: "_to", type: "address" },
      { indexed: true, name: "_tokenId", type: "uint256" },
    ],
    name: "Transfer",
    type: "event",
  },
  {
    constant: false,
    inputs: [{ name: "_nftId", type: "uint256" }],
    name: "purchase",
    outputs: [],
    payable: true,
    stateMutability: "payable",
    type: "function",
  },
  {
    constant: true,
    inputs: [{ name: "_owner", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "", type: "uint256" }],
    payable: false,
    stateMutability: "view",
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
  {
    constant: true,
    inputs: [
      { name: "_owner", type: "address" },
      { name: "_index", type: "uint256" },
    ],
    name: "tokenOfOwnerByIndex",
    outputs: [{ name: "_tokenId", type: "uint256" }],
    payable: false,
    stateMutability: "view",
    type: "function",
  },
];

const PURCHASE_PRICE_WEI = 500000000000000000n; // 0.5 ETH

/**
 * Purchase a Square on the primary contract.
 * @param {number} squareId - Square token id (1–10000).
 * @param {import("@wagmi/core").Config} wagmi - Loaded wagmi client bundle.
 * @returns {Promise<{ hash: `0x${string}` }>}
 */
export async function purchaseSquare(squareId, wagmi) {
  const { contracts } = getWeb3Config();
  log("purchaseSquare", { squareId, address: contracts.primary });
  return wagmi.writeContract({
    address: contracts.primary,
    abi: PRIMARY_ABI,
    functionName: "purchase",
    args: [squareId],
    value: PURCHASE_PRICE_WEI,
  });
}

export { PRIMARY_ABI };
