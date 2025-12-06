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

function toWei(ethValue, fallbackWei) {
  const num = typeof ethValue === "string" ? Number.parseFloat(ethValue) : ethValue;
  if (!Number.isFinite(num) || num <= 0) return fallbackWei;
  // Avoid floating drift by multiplying in stages
  const scaled = Math.round(num * 1e6);
  return BigInt(scaled) * 1000000000000n;
}

const priceCache = new Map(); // key: `${chainId}:${address}` -> bigint

function cacheKey(wagmi, address) {
  try {
    const chainId = wagmi?.getNetwork?.()?.chain?.id;
    return `${chainId ?? "unknown"}:${address}`;
  } catch (_error) {
    return `unknown:${address}`;
  }
}

async function readPrice({ wagmi, address, abi, functionName, fallback }) {
  if (!wagmi?.readContract || !address) return fallback;
  const key = cacheKey(wagmi, address);
  const cached = priceCache.get(key);
  if (typeof cached === "bigint") return cached;
  try {
    const { activeNetwork } = getWeb3Config();
    const price = await wagmi.readContract({ address, abi, functionName, chainId: activeNetwork.chainId });
    if (typeof price === "bigint") {
      priceCache.set(key, price);
      return price;
    }
  } catch (error) {
    log("price read failed; using fallback", { functionName, error });
  }
  return fallback;
}

/**
 * Read the mint price from the primary contract, falling back to config pricing.
 * @param {ReturnType<import("../client/wagmi.js").loadWagmiClient>} wagmi
 * @returns {Promise<bigint>}
 */
export async function getMintPriceWei(wagmi) {
  const { contracts, pricing } = getWeb3Config();
  const fallback = toWei(pricing?.mintPriceEth ?? 0.5, 500000000000000000n);
  return readPrice({
    wagmi,
    address: contracts?.primary,
    abi: PRIMARY_PRICE_ABI,
    functionName: "salePrice",
    fallback,
  });
}

/**
 * Read the personalization price from the underlay contract, falling back to config pricing.
 * @param {ReturnType<import("../client/wagmi.js").loadWagmiClient>} wagmi
 * @returns {Promise<bigint>}
 */
export async function getPersonalizePriceWei(wagmi) {
  const { contracts, pricing } = getWeb3Config();
  const fallback = toWei(pricing?.personalizePriceEth ?? 0.001, 1000000000000000n);
  return readPrice({
    wagmi,
    address: contracts?.underlay,
    abi: UNDERLAY_PRICE_ABI,
    functionName: "pricePerSquare",
    fallback,
  });
}
