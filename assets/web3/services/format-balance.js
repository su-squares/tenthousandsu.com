/**
 * Core string-based balance formatter.
 *
 * Mirrors the previous tx/formatting.js `formatBalance` behavior:
 * - Truncates decimals based on magnitude
 * - Adds thousands separators
 * - Shows "<0.00001" for tiny non-zero values
 *
 * @param {string} [formatted]
 * @returns {string}
 */
export function formatBalanceString(formatted) {
  if (!formatted || typeof formatted !== "string") return "—";

  const num = Number.parseFloat(formatted);
  if (!Number.isFinite(num)) return formatted;

  if (num > 0 && num < 0.00001) return "<0.00001";

  let decimals;
  if (num < 1) {
    decimals = 5;
  } else if (num < 1000) {
    decimals = 4;
  } else {
    decimals = 2;
  }

  const scale = Math.pow(10, decimals);
  const truncated = Math.floor(num * scale) / scale;

  const parts = truncated.toFixed(decimals).split(".");
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");

  if (parts[1]) {
    parts[1] = parts[1].replace(/0+$/, "");
    if (parts[1] === "") {
      return parts[0];
    }
  }

  return parts.join(".");
}

/**
 * Format a balance object (with .formatted and .symbol) into a user-facing string.
 *
 * @param {{ formatted?: string, symbol?: string } | null | undefined} balance
 * @returns {string}
 */
export function formatBalanceForDisplay(balance) {
  if (!balance) return "";

  const core = formatBalanceString(balance.formatted);
  if (!core) return "";
  if (core === "—") return core;

  const symbol = balance.symbol || "ETH";
  return `${core} ${symbol}`;
}
