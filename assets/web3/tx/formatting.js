/**
 * @typedef {Object} TxPricing
 * @property {number} mintPriceEth
 * @property {number} personalizePriceEth
 */

/**
 * Default pricing fallback when runtime pricing is missing or malformed.
 * @type {TxPricing}
 */
export const DEFAULT_PRICING = {
  mintPriceEth: 0.5,
  personalizePriceEth: 0.001,
};

/**
 * Normalize pricing input to a safe numeric structure.
 * @param {Partial<TxPricing>} [pricing]
 * @returns {TxPricing}
 */
export function normalizePricing(pricing) {
  const safe = pricing && typeof pricing === "object" ? pricing : {};
  const asNumber = (value, fallback) => {
    const num = typeof value === "string" ? Number.parseFloat(value) : value;
    return Number.isFinite(num) ? num : fallback;
  };
  return {
    mintPriceEth: asNumber(safe.mintPriceEth, DEFAULT_PRICING.mintPriceEth),
    personalizePriceEth: asNumber(safe.personalizePriceEth, DEFAULT_PRICING.personalizePriceEth),
  };
}

/**
 * Shorten a transaction hash for display.
 * @param {string} [hash]
 * @returns {string}
 */
export function formatHash(hash) {
  if (!hash || typeof hash !== "string" || hash.length < 12) return hash || "";
  return `${hash.slice(0, 8)}...${hash.slice(-6)}`;
}

/**
 * Format a balance string with truncated decimals and commas.
 * Reuses the shared string-based formatter.
 */
export { formatBalanceString as formatBalance } from "../services/format-balance.js";

/**
 * Map internal status to UI progress bar status.
 * @param {string} status
 * @returns {string}
 */
export function buildBarState(status) {
  if (status === "pending") return "processing";
  return status;
}
