import { getWeb3Config } from "../config/index.js";

/**
 * Build a transaction explorer URL for the active network.
 * @param {string} hash - Transaction hash.
 * @returns {string|null}
 */
export function buildTxUrl(hash) {
  if (!hash) return null;
  const { activeNetwork } = getWeb3Config();
  const base = activeNetwork?.explorerBaseUrl;
  if (!base) return null;
  const path = activeNetwork.explorerTxPath || "/tx/";
  const trimmedBase = base.replace(/\/$/, "");
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${trimmedBase}${normalizedPath}${hash}`;
}
