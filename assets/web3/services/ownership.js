import { getWeb3Config } from "../config/index.js";
import { createDebugLogger } from "../config/logger.js";
import { getReadContractFn } from "./pricing.js";

const log = createDebugLogger("service-ownership");

const PRIMARY_OWNERSHIP_ABI = [
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

const ownershipCache = new Map();

function cacheKey(chainId, address) {
  return `${chainId}:${address.toLowerCase()}`;
}

/**
 * Fetch the set of owned Square IDs for a given address.
 * @param {string} address
 * @param {import("@wagmi/core").Config} wagmi
 * @returns {Promise<Set<number>>}
 */
export async function fetchOwnedSquares(address, wagmi) {
  if (!address) {
    throw new Error("Missing wallet address");
  }

  const { contracts, activeNetwork } = getWeb3Config();
  const readContract = getReadContractFn(wagmi);
  if (!readContract) {
    const available = wagmi ? Object.keys(wagmi).join(", ") : "wagmi is null/undefined";
    throw new Error(`Ownership check failed: no readContract available. wagmi keys: [${available}]`);
  }

  const key = cacheKey(activeNetwork.chainId, address);
  const cached = ownershipCache.get(key);
  if (cached) {
    return new Set(cached);
  }

  log("fetchOwnedSquares", { address, contract: contracts.primary });

  const balance = await readContract({
    address: contracts.primary,
    abi: PRIMARY_OWNERSHIP_ABI,
    functionName: "balanceOf",
    args: [address],
    chainId: activeNetwork.chainId,
  });

  const count = Number(balance);
  if (!Number.isFinite(count) || count < 0) {
    throw new Error("Ownership check failed: invalid balance result");
  }

  const ids = [];
  for (let i = 0; i < count; i += 1) {
    const tokenId = await readContract({
      address: contracts.primary,
      abi: PRIMARY_OWNERSHIP_ABI,
      functionName: "tokenOfOwnerByIndex",
      args: [address, BigInt(i)],
      chainId: activeNetwork.chainId,
    });
    ids.push(Number(tokenId));
  }

  ownershipCache.set(key, ids);
  return new Set(ids);
}

export function clearOwnedSquaresCache() {
  ownershipCache.clear();
}

export { PRIMARY_OWNERSHIP_ABI };
