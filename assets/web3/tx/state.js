import { normalizePricing } from "./formatting.js";

/**
 * @typedef {"mint"|"personalize"|"unpersonalize"|"both"} TxMode
 */

/**
 * @typedef {import("./formatting.js").TxPricing} TxPricing
 */

/**
 * @typedef {Object} BalanceContext
 * @property {string} address
 * @property {number} chainId
 * @property {Function} fetcher
 */

/**
 * @typedef {Object} TxState
 * @property {"idle"|"processing"|"pending"|"success"|"error"} status
 * @property {string} title
 * @property {string} message
 * @property {string} helpText
 * @property {Array<{hash:string,url?:string}>} pending
 * @property {Array<{hash:string,url?:string}>} confirmed
 * @property {TxPricing} pricing
 * @property {TxMode} mode
 * @property {boolean} showWalletButton
 * @property {boolean} showBalance
 * @property {{ formatted: string, symbol?: string } | null} balance
 * @property {boolean} balanceLoading
 * @property {BalanceContext|null} balanceContext
 */

/**
 * Build the initial transaction state.
 * @param {Object} [options]
 * @param {string} [options.title]
 * @param {string} [options.message]
 * @param {TxPricing} [options.pricing]
 * @param {TxMode} [options.mode]
 * @param {boolean} [options.showBalance]
 * @returns {TxState}
 */
export function createInitialState(options = {}) {
  return {
    status: "idle",
    title: options.title || "Transaction status",
    message: options.message || "",
    helpText: "",
    pending: [],
    confirmed: [],
    pricing: normalizePricing(options.pricing),
    mode: options.mode || "both",
    showWalletButton: false,
    showBalance: options.showBalance ?? true,
    balance: null,
    balanceLoading: false,
    balanceContext: null,
  };
}
