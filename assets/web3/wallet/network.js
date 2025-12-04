import { getWeb3Config } from "../config/index.js";
import { createDebugLogger } from "../config/logger.js";

const appConfig = getWeb3Config();
const log = createDebugLogger("wallet-network");

export const PREFERRED_CHAIN_ID = appConfig.activeNetwork.chainId;
export const PREFERRED_CHAIN_LABEL = appConfig.activeNetwork.label || "Ethereum";

/**
 * @param {number | null | undefined} chainId
 * @returns {boolean}
 */
export function isAllowedChain(chainId) {
  if (typeof chainId !== "number") return false;
  return chainId === PREFERRED_CHAIN_ID;
}

/**
 * @param {import("@wagmi/core").Config} wagmi
 */
export function canSwitchNetwork(wagmi) {
  return Boolean(wagmi?.switchNetwork);
}

/**
 * Attempt to move the user onto the preferred chain if they are currently on an unsupported one.
 * Returns true when a switch was requested, false when no action was needed or possible.
 * @param {import("@wagmi/core").Config} wagmi
 * @param {number} targetChainId
 */
export async function attemptNetworkSwitch(wagmi, targetChainId = PREFERRED_CHAIN_ID) {
  if (!canSwitchNetwork(wagmi)) return false;
  try {
    const chainId = wagmi?.getNetwork?.()?.chain?.id;
    if (isAllowedChain(chainId)) return false;
    log("switching network", { from: chainId, to: targetChainId });
    await wagmi.switchNetwork({ chainId: targetChainId });
    return true;
  } catch (error) {
    log("network switch failed", error);
    return false;
  }
}
