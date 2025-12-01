import { enableSepolia } from "./config.js";
import {
  MAINNET_CHAIN_ID,
  SEPOLIA_CHAIN_ID,
  loadWagmiClient,
} from "./wallet/wagmi-client.js";
import { openConnectModal } from "./wallet/connect-modal/index.js";
import {
  clearStoredSession,
  getStoredSession,
  openWalletDeepLink,
} from "./wallet/wc-store.js";

let cachedClients = null;
const readyCallbacks = [];
const wagmiLocalStorageKey = "wagmi.store";
let disconnectWatcher = null;
const wagmiKeys = [wagmiLocalStorageKey, "wagmi.wallet", "wagmi.connected"];
const wcKeyPrefixes = ["wc@2:client:", "wc@2:", "walletconnect"];
const DEBUG = Boolean(typeof window !== "undefined" && window?.suWeb3?.debug);
const log = (...args) => {
  if (DEBUG) console.debug("[web3-foundation]", ...args);
};

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
    if (DEBUG && toRemove.length) {
      log(`removed WC keys (${onlyEmpty ? "empty only" : "all"}):`, toRemove.length);
    }
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
    wagmiKeys.forEach((key) => localStorage.removeItem(key));
    if (DEBUG) log("cleared wagmi keys", wagmiKeys);
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
    if (DEBUG) log("pruneWalletStorage", { hasSession: Boolean(session) });
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
      if (Array.isArray(connections) && connections.length > 0) return true;
      if (connections && typeof connections === "object" && Object.keys(connections).length > 0)
        return true;
    }
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
  if (DEBUG) log("shouldEagerLoadWeb3", { persisted, configAutoLoad: config?.autoLoad });
  return persisted;
}

export async function loadWeb3() {
  if (cachedClients) return cachedClients;
  cachedClients = await loadWagmiClient();
  if (!disconnectWatcher) {
    try {
      disconnectWatcher = cachedClients.watchAccount((account) => {
        if (!account.isConnected) {
          if (DEBUG) log("account disconnected; clearing wallet storage");
          clearAllWalletStorage();
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

export function hasWalletConnectSession() {
  return Boolean(getStoredSession());
}

export function openWalletFromStore() {
  const session = getStoredSession();
  if (!session) return false;
  return openWalletDeepLink(undefined, { userInitiated: true });
}
