import { getWeb3Config } from "../config/index.js";
import { createDebugLogger } from "../config/logger.js";

const log = createDebugLogger("pricing");

const PRIMARY_PRICE_ABI = [
  {
    inputs: [],
    name: "salePrice",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
];

const UNDERLAY_PRICE_ABI = [
  {
    inputs: [],
    name: "pricePerSquare",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
];

const priceCache = new Map(); // key: `${chainId}:${address}` -> bigint

function cacheKey(chainId, address) {
  return `${chainId ?? "unknown"}:${address}`;
}

/**
 * Get a working readContract function from the wagmi client.
 * Falls back to using the publicClient if wagmi.readContract is unavailable.
 */
function getReadContractFn(wagmi) {
  // Try direct readContract first
  if (typeof wagmi?.readContract === "function") {
    return wagmi.readContract;
  }

  // Fall back to using the publicClient from config
  const publicClient = wagmi?.config?.publicClient;
  if (publicClient?.readContract) {
    return (args) => publicClient.readContract(args);
  }

  return null;
}

/**
 * Read a price from the contract. Throws if the read fails.
 * Prices are cached per chain+address to avoid redundant RPC calls.
 */
async function readPriceFromContract({ wagmi, address, abi, functionName, label }) {
  const readContract = getReadContractFn(wagmi);

  if (!readContract) {
    const available = wagmi ? Object.keys(wagmi).join(", ") : "wagmi is null/undefined";
    const configKeys = wagmi?.config ? Object.keys(wagmi.config).join(", ") : "no config";
    throw new Error(`Cannot read ${label}: no readContract available. wagmi keys: [${available}], config keys: [${configKeys}]`);
  }

  if (!address) {
    throw new Error(`Cannot read ${label}: contract address not configured`);
  }

  const { activeNetwork } = getWeb3Config();
  const chainId = activeNetwork.chainId;
  const key = cacheKey(chainId, address);
  const cached = priceCache.get(key);

  if (typeof cached === "bigint") {
    log("using cached price", { label, price: cached.toString() });
    return cached;
  }

  log("reading price from contract", { label, address, chainId });

  const price = await readContract({
    address,
    abi,
    functionName,
    chainId,
  });

  if (typeof price !== "bigint") {
    throw new Error(`Cannot read ${label}: contract returned invalid price type (${typeof price})`);
  }

  priceCache.set(key, price);
  log("price read successfully", { label, price: price.toString() });
  return price;
}

/**
 * Read the mint price from the primary contract.
 * Throws if the contract cannot be read - does NOT use config fallbacks.
 * @param {ReturnType<import("../client/wagmi.js").loadWagmiClient>} wagmi
 * @returns {Promise<bigint>}
 */
export async function getMintPriceWei(wagmi) {
  const { contracts } = getWeb3Config();
  return readPriceFromContract({
    wagmi,
    address: contracts?.primary,
    abi: PRIMARY_PRICE_ABI,
    functionName: "salePrice",
    label: "mint price",
  });
}

/**
 * Read the personalization price from the underlay contract.
 * Throws if the contract cannot be read - does NOT use config fallbacks.
 * @param {ReturnType<import("../client/wagmi.js").loadWagmiClient>} wagmi
 * @returns {Promise<bigint>}
 */
export async function getPersonalizePriceWei(wagmi) {
  const { contracts } = getWeb3Config();
  return readPriceFromContract({
    wagmi,
    address: contracts?.underlay,
    abi: UNDERLAY_PRICE_ABI,
    functionName: "pricePerSquare",
    label: "personalization price",
  });
}
