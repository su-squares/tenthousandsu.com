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

/**
 * Build a block explorer URL for the active network.
 * @param {number|string} blockNumber - Block number.
 * @returns {string|null}
 */
export function buildBlockUrl(blockNumber) {
  if (!blockNumber) return null;
  const { activeNetwork } = getWeb3Config();
  const base = activeNetwork?.explorerBaseUrl;
  if (!base) return null;
  const trimmedBase = base.replace(/\/$/, "");
  return `${trimmedBase}/block/${blockNumber}`;
}

/**
 * Build a token page URL for the active network.
 * @param {string} contractAddress - Token contract address.
 * @param {number|string} [tokenId] - Optional token ID for ERC-721/1155.
 * @returns {string|null}
 */
export function buildTokenUrl(contractAddress, tokenId) {
  if (!contractAddress) return null;
  const { activeNetwork } = getWeb3Config();
  const base = activeNetwork?.explorerBaseUrl;
  if (!base) return null;
  const trimmedBase = base.replace(/\/$/, "");
  return tokenId
    ? `${trimmedBase}/token/${contractAddress}?a=${tokenId}`
    : `${trimmedBase}/token/${contractAddress}`;
}

/**
 * Get the name of the block explorer for the active network.
 * @returns {string}
 */
export function getExplorerName() {
  const { activeNetwork } = getWeb3Config();
  return activeNetwork?.explorerName || "Block Explorer";
}

/**
 * Get the base URL of the block explorer for the active network.
 * @returns {string|null}
 */
export function getExplorerBaseUrl() {
  const { activeNetwork } = getWeb3Config();
  return activeNetwork?.explorerBaseUrl || null;
}
