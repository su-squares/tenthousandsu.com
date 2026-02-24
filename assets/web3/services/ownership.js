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

const ownershipCache = new Map();
const ownershipCountCache = new Map();

function cacheKey(chainId, address) {
  return `${chainId}:${address.toLowerCase()}`;
}

/**
 * Fetch the set of owned Square IDs for a given address.
 * @param {string} address
 * @param {import("@wagmi/core").Config} wagmi
 * @param {Object} [options]
 * @param {(payload: { total: number, completed: number }) => void} [options.onProgress]
 * @param {boolean} [options.forceRefresh]
 * @returns {Promise<Set<number>>}
 */
export async function fetchOwnedSquares(address, wagmi, options = {}) {
  if (!address) {
    throw new Error("Missing wallet address");
  }

  const { onProgress, forceRefresh = false } = options;
  const { contracts, activeNetwork } = getWeb3Config();
  const readContract = getReadContractFn(wagmi);
  if (!readContract) {
    const available = wagmi ? Object.keys(wagmi).join(", ") : "wagmi is null/undefined";
    throw new Error(`Ownership check failed: no readContract available. wagmi keys: [${available}]`);
  }

  const key = cacheKey(activeNetwork.chainId, address);
  const cached = ownershipCache.get(key);
  const cachedCount = ownershipCountCache.get(key);
  if (cached && !forceRefresh) {
    const shouldCheckBalance = cachedCount !== undefined;
    if (shouldCheckBalance) {
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
      if (count === cachedCount) {
        if (typeof onProgress === "function") {
          onProgress({ total: count, completed: count });
        }
        return new Set(cached);
      }
    } else {
      if (typeof onProgress === "function") {
        const count = cached.length;
        onProgress({ total: count, completed: count });
      }
      return new Set(cached);
    }
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

  if (typeof onProgress === "function") {
    onProgress({ total: count, completed: 0 });
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
    if (typeof onProgress === "function") {
      onProgress({ total: count, completed: i + 1 });
    }
  }

  ownershipCache.set(key, ids);
  ownershipCountCache.set(key, ids.length);
  return new Set(ids);
}

/**
 * Fetch ownership for a specific list of square ids (no full enumeration).
 * @param {string} address
 * @param {number[]} squareIds
 * @param {import("@wagmi/core").Config} wagmi
 * @param {Object} [options]
 * @param {(payload: { total: number, completed: number }) => void} [options.onProgress]
 * @returns {Promise<Set<number>>}
 */
export async function fetchOwnedSquaresForIds(address, squareIds, wagmi, options = {}) {
  if (!address) {
    throw new Error("Missing wallet address");
  }

  const { onProgress } = options;
  const { contracts, activeNetwork } = getWeb3Config();
  const readContract = getReadContractFn(wagmi);
  if (!readContract) {
    const available = wagmi ? Object.keys(wagmi).join(", ") : "wagmi is null/undefined";
    throw new Error(`Ownership check failed: no readContract available. wagmi keys: [${available}]`);
  }

  const normalized = Array.from(new Set(squareIds || []))
    .map((value) => Number(value))
    .filter((value) => Number.isInteger(value) && value >= 1 && value <= 10000);

  if (typeof onProgress === "function") {
    onProgress({ total: normalized.length, completed: 0 });
  }

  const owned = new Set();
  for (let i = 0; i < normalized.length; i += 1) {
    const squareId = normalized[i];
    try {
      const owner = await readContract({
        address: contracts.primary,
        abi: PRIMARY_OWNERSHIP_ABI,
        functionName: "ownerOf",
        args: [BigInt(squareId)],
        chainId: activeNetwork.chainId,
      });
      if (typeof owner === "string" && owner.toLowerCase() === address.toLowerCase()) {
        owned.add(squareId);
      }
    } catch (_error) {
      // Ignore missing/unminted tokens or read errors for this id.
    }

    if (typeof onProgress === "function") {
      onProgress({ total: normalized.length, completed: i + 1 });
    }
  }

  return owned;
}

export function clearOwnedSquaresCache() {
  ownershipCache.clear();
  ownershipCountCache.clear();
}

export { PRIMARY_OWNERSHIP_ABI };
