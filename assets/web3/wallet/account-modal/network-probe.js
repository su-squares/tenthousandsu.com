import { getWeb3Config, ChainKey } from "../../config/index.js";
import { createDebugLogger } from "../../config/logger.js";

const log = createDebugLogger("account-modal:probe");
const appConfig = getWeb3Config();

function toHexChainId(chainId) {
  return `0x${Number(chainId).toString(16)}`;
}

/**
 * Only probe when the active app network is Sunet.
 */
export function shouldProbeNetworkAvailability() {
  const key = appConfig.activeNetwork?.key || appConfig.chain;
  return key === ChainKey.SUNET;
}

/**
 * Probe if the target network is available in the wallet.
 * For WC: checks approved chains; for injected: attempts switch to detect 4902.
 * @param {import("@wagmi/core").Config} wagmi
 * @returns {Promise<{ available: boolean, error?: any }>}
 */
export async function probeNetworkAvailable(wagmi) {
  try {
    if (!shouldProbeNetworkAvailability()) return { available: true };

    const account = wagmi?.getAccount?.();
    const connector = account?.connector;

    // WalletConnect - check if chain is in the session's approved chains
    if (connector?.id === "walletConnect") {
      try {
        const provider = await connector.getProvider();
        const session = provider?.session;
        const approvedChains = session?.namespaces?.eip155?.chains || [];
        const targetChainRef = `eip155:${appConfig.activeNetwork.chainId}`;
        const isApproved = approvedChains.includes(targetChainRef);
        log("WC session chains:", approvedChains, "target:", targetChainRef, "approved:", isApproved);
        return { available: isApproved };
      } catch (error) {
        log("WC session check failed", error);
        return { available: false };
      }
    }

    // Injected provider - try to switch and catch 4902
    if (!connector?.getProvider) {
      return { available: false };
    }

    const provider = await connector.getProvider();
    if (!provider?.request) {
      return { available: false };
    }

    const hexChainId = toHexChainId(appConfig.activeNetwork.chainId);

    try {
      await provider.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: hexChainId }],
      });
      return { available: true };
    } catch (error) {
      if (error.code === 4902) return { available: false };
      const message = (error.message || "").toLowerCase();
      if (message.includes("unrecognized chain") || message.includes("try adding")) return { available: false };
      if (error.code === 4001 || message.includes("user rejected")) return { available: true };
      log("Unknown switch error, assuming not available", error);
      return { available: false, error };
    }
  } catch (error) {
    log("probeNetworkAvailable failed", error);
    return { available: false, error };
  }
}
