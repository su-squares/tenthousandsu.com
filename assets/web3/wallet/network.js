import { getWeb3Config } from "../config/index.js";
import { createDebugLogger } from "../config/logger.js";

const appConfig = getWeb3Config();
const log = createDebugLogger("wallet-network");

export const PREFERRED_CHAIN_ID = appConfig.activeNetwork.chainId;
export const PREFERRED_CHAIN_LABEL = appConfig.activeNetwork.label || "Ethereum";

/**
 * Check if the given chain ID matches the preferred/allowed chain.
 * @param {number | null | undefined} chainId
 * @returns {boolean}
 */
export function isAllowedChain(chainId) {
  if (typeof chainId !== "number") return false;
  return chainId === PREFERRED_CHAIN_ID;
}

/**
 * Get current chain ID from wagmi's getNetwork.
 * @param {object} wagmi
 * @returns {number|null}
 */
export function getCurrentChainId(wagmi) {
  try {
    const network = wagmi?.getNetwork?.();
    if (network?.chain?.id) {
      return network.chain.id;
    }
    return null;
  } catch (error) {
    log("getCurrentChainId error", error);
    return null;
  }
}

/**
 * Check if the connector is WalletConnect.
 * @param {object} wagmi
 * @returns {boolean}
 */
export function isWalletConnectConnector(wagmi) {
  try {
    const account = wagmi?.getAccount?.();
    return account?.connector?.id === "walletConnect";
  } catch (error) {
    return false;
  }
}

/**
 * @deprecated No longer used - network switching happens automatically during transactions.
 */
export function canSwitchNetwork(wagmi) {
  return Boolean(wagmi?.switchNetwork);
}

/**
 * @deprecated No longer used - showing manual instructions instead.
 */
export async function requestPreferredNetwork(wagmi, options = {}) {
  log("requestPreferredNetwork called but no longer implemented - wallets handle switching during tx");
  return { success: false, action: "deprecated" };
}

/**
 * @deprecated No longer used.
 */
export async function attemptNetworkSwitch(wagmi, targetChainId = PREFERRED_CHAIN_ID) {
  return false;
}