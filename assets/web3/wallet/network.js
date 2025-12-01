import { enableSepolia } from "../config.js";
import { MAINNET_CHAIN_ID, SEPOLIA_CHAIN_ID } from "./wagmi-client.js";

const DEBUG = Boolean(window?.suWeb3?.debug);
const log = (...args) => {
  if (DEBUG) console.debug("[wallet-network]", ...args);
};

export const PREFERRED_CHAIN_ID = MAINNET_CHAIN_ID;
export const PREFERRED_CHAIN_LABEL = "Ethereum Mainnet";

/**
 * @param {number | null | undefined} chainId
 * @returns {boolean}
 */
export function isAllowedChain(chainId) {
  if (chainId === MAINNET_CHAIN_ID) return true;
  if (enableSepolia && chainId === SEPOLIA_CHAIN_ID) return true;
  return false;
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
