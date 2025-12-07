import { getWeb3Config } from "./config/index.js";
import { createDebugLogger } from "./config/logger.js";
import { loadWagmiClient } from "./client/wagmi.js";
import { openConnectModal } from "./wallet/connect-modal/index.js";
import {
  clearStoredSession,
  getStoredSession,
  openWalletDeepLink,
} from "./wallet/wc-store.js";
import { isAllowedChain, getCurrentChainId } from "./wallet/network.js";
import { clearAllEnsCache } from "./wallet/ens-store.js";
import { activateWalletContext } from "./wallet/active-wallet-context.js";

const appConfig = getWeb3Config();
let cachedClients = null;
const readyCallbacks = [];
const wagmiLocalStorageKey = "wagmi.store";
let disconnectWatcher = null;
const wagmiKeys = [wagmiLocalStorageKey, "wagmi.wallet", "wagmi.connected"];
const wcKeyPrefixes = ["wc@2:client:", "wc@2:", "walletconnect"];
const log = createDebugLogger("web3-foundation");

function removeWalletConnectKeys({ onlyEmpty = false } = {}) {
  try {
    const toRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !wcKeyPrefixes.some((prefix) => key.startsWith(prefix))) continue;
      if (!onlyEmpty) {
        toRemove.push(key);
        continue;
      }
      const value = localStorage.getItem(key);
      if (!value || value === "{}") {
        toRemove.push(key);
        continue;
      }
      try {
        const parsed = JSON.parse(value);
        if (!parsed || (typeof parsed === "object" && Object.keys(parsed).length === 0)) {
          toRemove.push(key);
        }
      } catch (_error) {
        // keep non-empty/unparseable values when onlyEmpty=true
      }
    }
    toRemove.forEach((key) => localStorage.removeItem(key));
    if (toRemove.length) log(`removed WC keys (${onlyEmpty ? "empty only" : "all"}):`, toRemove.length);
  } catch (_error) {
    /* ignore */
  }
}

export function clearAllWalletStorage() {
  try {
    clearStoredSession();
  } catch (_error) {
    /* ignore */
  }
  try {
    clearAllEnsCache();
  } catch (_error) {
    /* ignore */
  }
  try {
    wagmiKeys.forEach((key) => localStorage.removeItem(key));
    log("cleared wagmi keys", wagmiKeys);
  } catch (_error) {
    /* ignore */
  }
  try {
    removeWalletConnectKeys({ onlyEmpty: false });
  } catch (_error) {
    /* ignore */
  }
}

export function pruneWalletStorage() {
  // Enforce TTL on our own WC session and drop empty WC client records.
  try {
    const session = getStoredSession();
    log("pruneWalletStorage", { hasSession: Boolean(session) });
  } catch (_error) {
    /* ignore */
  }
  removeWalletConnectKeys({ onlyEmpty: true });
}

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
      const account = parsed?.state?.data?.account;
      if (account) return true;
      if (Array.isArray(connections) && connections.length > 0) return true;
      if (connections && typeof connections === "object" && Object.keys(connections).length > 0) return true;
    }
    const connectedFlag = localStorage.getItem("wagmi.connected");
    if (connectedFlag === "true") return true;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && wcKeyPrefixes.some((prefix) => key.startsWith(prefix))) {
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
  pruneWalletStorage();
  const config = window.suWeb3;
  if (config?.autoLoad === true) return true;
  if (config?.autoLoad === false) return false;
  const persisted = hasPersistedWagmiConnection();
  log("shouldEagerLoadWeb3", { persisted, configAutoLoad: config?.autoLoad });
  return persisted;
}

export async function loadWeb3() {
  if (cachedClients) return cachedClients;
  cachedClients = await loadWagmiClient();
  if (!disconnectWatcher) {
    try {
      disconnectWatcher = cachedClients.watchAccount((account) => {
        if (!account.isConnected) {
          log("account disconnected; clearing wallet storage");
          clearAllWalletStorage();
        }
      });
    } catch (_error) {
      /* ignore watcher issues */
    }
  }

  // Activate wallet context now that wagmi is loaded
  // This ensures context events fire when user connects via button
  activateWalletContext(cachedClients);

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

/**
 * Check if currently on the correct network.
 * This is informational only - it doesn't try to switch.
 * 
 * MetaMask and WalletConnect both handle network switching automatically
 * during transactions, so we don't need to force a switch here.
 * 
 * @param {object} clients - The wagmi client bundle
 * @returns {Promise<{ onCorrectNetwork: boolean, currentChainId: number|null }>}
 */
export async function ensureCorrectNetwork(clients) {
  const wagmi = clients || (await loadWeb3());
  
  const currentChainId = getCurrentChainId(wagmi);
  const onCorrectNetwork = isAllowedChain(currentChainId);
  
  log("ensureCorrectNetwork check", { 
    currentChainId, 
    expectedChainId: appConfig.activeNetwork.chainId,
    onCorrectNetwork 
  });
  
  // Just return the status - don't try to switch
  // Wallets handle this automatically during transactions
  return { onCorrectNetwork, currentChainId };
}

/**
 * Check if currently on the correct network.
 * @param {object} [wagmi] - Optional wagmi client (will load if not provided)
 * @returns {Promise<boolean>}
 */
export async function isOnCorrectNetwork(wagmi) {
  const clients = wagmi || (await loadWeb3());
  const currentChainId = getCurrentChainId(clients);
  return isAllowedChain(currentChainId);
}

export function clearCachedWalletSession() {
  clearStoredSession();
}

export function hasWalletConnectSession() {
  return Boolean(getStoredSession());
}

export function openWalletFromStore() {
  const session = getStoredSession();
  if (!session) return false;
  return openWalletDeepLink(undefined, { userInitiated: true });
}
