import { enableSepolia } from "./config.js";
import {
  MAINNET_CHAIN_ID,
  SEPOLIA_CHAIN_ID,
  loadWagmiClient,
} from "./wallet/wagmi-client.js";
import { openConnectModal } from "./wallet/connect-modal.js";
import {
  clearStoredSession,
  getStoredSession,
  openWalletDeepLink,
} from "./wallet/wc-store.js";

let cachedClients = null;
const readyCallbacks = [];
const wagmiLocalStorageKey = "wagmi.store";
let disconnectWatcher = null;

export function onWeb3Ready(callback) {
  if (cachedClients) {
    queueMicrotask(() => callback(cachedClients));
    return;
  }
  readyCallbacks.push(callback);
}

function hasPersistedWagmiConnection() {
  try {
    const raw = localStorage.getItem(wagmiLocalStorageKey);
    if (raw) {
      const parsed = JSON.parse(raw);
      const connections = parsed?.state?.connections;
      if (Array.isArray(connections) && connections.length > 0) return true;
      if (connections && typeof connections === "object" && Object.keys(connections).length > 0)
        return true;
    }
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith("wc@2:client:")) {
        const value = localStorage.getItem(key);
        if (value && value !== "{}") return true;
      }
      if (key === "su-wc-session") {
        return true;
      }
    }
  } catch (error) {
    console.warn("Unable to inspect wagmi storage", error);
  }
  return false;
}

export function shouldEagerLoadWeb3() {
  const config = window.suWeb3;
  if (config?.autoLoad === false) return false;
  // Default to eager load unless explicitly disabled.
  if (config?.autoLoad === true) return true;
  return hasPersistedWagmiConnection() || true;
}

export async function loadWeb3() {
  if (cachedClients) return cachedClients;
  cachedClients = await loadWagmiClient();
  if (!disconnectWatcher) {
    try {
      disconnectWatcher = cachedClients.watchAccount((account) => {
        if (!account.isConnected) {
          clearStoredSession();
        }
      });
    } catch (_error) {
      /* ignore watcher issues */
    }
  }
  readyCallbacks.splice(0).forEach((cb) => cb(cachedClients));
  return cachedClients;
}

export async function ensureConnected(action) {
  const wagmi = await loadWeb3();
  const runAction = () => action(wagmi);

  if (wagmi.getAccount().isConnected) {
    return runAction();
  }

  return new Promise(async (resolve, reject) => {
    let finished = false;
    const cleanup = () => {
      finished = true;
      try {
        accountUnsubscribe?.();
      } catch (_error) {
        /* noop */
      }
    };

    const accountUnsubscribe = wagmi.watchAccount((account) => {
      if (!account.isConnected || finished) return;
      cleanup();
      resolve(runAction());
    });

    try {
      const session = getStoredSession();
      const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
      if (session && isMobile) {
        openWalletDeepLink();
      }
      await openConnectModal();
      const account = wagmi.getAccount();
      if (account?.isConnected) {
        cleanup();
        resolve(runAction());
      } else {
        cleanup();
        resolve();
      }
    } catch (error) {
      cleanup();
      reject(error);
    }
  });
}

export async function ensureMainnetOrWarn(clients) {
  const wagmi = clients || (await loadWeb3());
  try {
    const network = wagmi.getNetwork();
    const chainId = network?.chain?.id;
    const isAllowedChain =
      chainId === MAINNET_CHAIN_ID || (enableSepolia && chainId === SEPOLIA_CHAIN_ID);
    if (isAllowedChain) return wagmi;
    if (wagmi.switchNetwork) {
      await wagmi.switchNetwork({ chainId: MAINNET_CHAIN_ID });
      return wagmi;
    }
  } catch (error) {
    console.warn("Network switch failed", error);
  }
  alert("Please switch to Ethereum mainnet to continue.");
  throw new Error("Not on mainnet");
}

export function clearCachedWalletSession() {
  clearStoredSession();
}

export function openWalletFromStore() {
  const session = getStoredSession();
  if (!session) return false;
  return openWalletDeepLink();
}
