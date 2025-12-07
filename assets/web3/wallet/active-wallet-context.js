/**
 * Centralized active wallet context.
 * Tracks the current connected wallet address and chain, provides balance fetching.
 * Components can subscribe to changes without knowing wagmi internals.
 *
 * IMPORTANT: Respects lazy loading - will NOT load wagmi unless shouldEagerLoadWeb3() returns true.
 *
 * @module active-wallet-context
 */
import { getWeb3Config } from "../config/index.js";
// Note: foundation.js imports are dynamic to avoid circular dependency
// (foundation.js imports activateWalletContext from this module)
import { getBalance, getCachedBalance, subscribeBalance, refreshBalance } from "./balance-store.js";
import { createDebugLogger } from "../config/logger.js";

const log = createDebugLogger("active-wallet-context");

export const WALLET_CONTEXT_CHANGE_EVENT = "su-wallet-context-change";

/** @type {{ address: string|null, chainId: number|null, isConnected: boolean }} */
let currentContext = {
  address: null,
  chainId: null,
  isConnected: false,
};

/** @type {(() => void)|null} */
let accountUnsubscribe = null;
/** @type {(() => void)|null} */
let networkUnsubscribe = null;
let initialized = false;

/**
 * Emit context change event to notify listeners.
 */
function emitContextChange() {
  try {
    window.dispatchEvent(new CustomEvent(WALLET_CONTEXT_CHANGE_EVENT, {
      detail: { ...currentContext }
    }));
    log("emitted context change", currentContext);
  } catch (_error) {
    /* ignore */
  }
}

/**
 * Update context from wagmi state and emit change if needed.
 * @param {object} wagmi - The wagmi client
 */
function updateFromWagmi(wagmi) {
  const account = wagmi.getAccount();
  const appConfig = getWeb3Config();

  const newContext = {
    address: account?.address || null,
    chainId: appConfig.activeNetwork.chainId,
    isConnected: Boolean(account?.isConnected),
  };

  const changed =
    newContext.address !== currentContext.address ||
    newContext.chainId !== currentContext.chainId ||
    newContext.isConnected !== currentContext.isConnected;

  if (changed) {
    log("context changed", { old: currentContext, new: newContext });
    currentContext = newContext;
    emitContextChange();
  }
}

/**
 * Initialize the active wallet context.
 *
 * IMPORTANT: This respects lazy loading - it will only load wagmi if
 * shouldEagerLoadWeb3() returns true (i.e., there's a persisted connection).
 *
 * Safe to call multiple times - will only initialize once.
 *
 * @returns {Promise<{ address: string|null, chainId: number|null, isConnected: boolean }>}
 */
export async function initActiveWalletContext() {
  if (initialized) return currentContext;

  // Dynamic import to avoid circular dependency
  const { shouldEagerLoadWeb3, loadWeb3 } = await import("../foundation.js");

  // Check FIRST - don't load wagmi unnecessarily!
  if (!shouldEagerLoadWeb3()) {
    log("skipping init - no persisted connection");
    initialized = true; // Mark as initialized so we don't check again
    return currentContext;
  }

  try {
    const wagmi = await loadWeb3();

    // Set initial state from current wagmi state
    updateFromWagmi(wagmi);

    // Watch for account changes (connect/disconnect)
    if (wagmi.watchAccount) {
      accountUnsubscribe = wagmi.watchAccount(() => {
        updateFromWagmi(wagmi);
      });
    }

    // Watch for network changes
    if (wagmi.watchNetwork) {
      networkUnsubscribe = wagmi.watchNetwork(() => {
        updateFromWagmi(wagmi);
      });
    }

    initialized = true;
    log("initialized", currentContext);
  } catch (error) {
    log("initialization failed", error);
    initialized = true; // Still mark as initialized to prevent retries
  }

  return currentContext;
}

/**
 * Force re-initialization (useful when wagmi loads later via connect button).
 * Called internally by foundation.js when loadWeb3() completes.
 * @param {object} wagmi - The wagmi client
 */
export function activateWalletContext(wagmi) {
  if (!wagmi) return;

  // Set initial state
  updateFromWagmi(wagmi);

  // Set up watchers if not already done
  if (!accountUnsubscribe && wagmi.watchAccount) {
    accountUnsubscribe = wagmi.watchAccount(() => {
      updateFromWagmi(wagmi);
    });
  }

  if (!networkUnsubscribe && wagmi.watchNetwork) {
    networkUnsubscribe = wagmi.watchNetwork(() => {
      updateFromWagmi(wagmi);
    });
  }

  initialized = true;
  log("activated via loadWeb3", currentContext);
}

/**
 * Get the current wallet context (synchronous, uses cached state).
 * @returns {{ address: string|null, chainId: number|null, isConnected: boolean }}
 */
export function getActiveWalletContext() {
  return { ...currentContext };
}

/**
 * Check if there is an active connected wallet.
 * @returns {boolean}
 */
export function hasActiveWallet() {
  return Boolean(currentContext.isConnected && currentContext.address);
}

/**
 * Get cached balance for the active wallet (synchronous).
 * Returns null if no wallet connected or no cached balance.
 * @returns {any|null}
 */
export function getActiveWalletCachedBalance() {
  if (!currentContext.address || !currentContext.chainId) return null;
  return getCachedBalance(currentContext.address, currentContext.chainId);
}

/**
 * Fetch balance for the active wallet.
 * Uses the centralized balance-store for caching and single-flight.
 * @returns {Promise<{ balance: any, source: "cache"|"fresh" }>}
 */
export async function getActiveWalletBalance() {
  if (!currentContext.address || !currentContext.chainId) {
    return { balance: null, source: "cache" };
  }

  const { loadWeb3 } = await import("../foundation.js");
  const wagmi = await loadWeb3();
  const { address, chainId } = currentContext;

  return getBalance({
    address,
    chainId,
    fetcher: (addr, chain) => wagmi.fetchBalance({ address: addr, chainId: chain }),
  });
}

/**
 * Force refresh balance for the active wallet.
 * @returns {Promise<any>}
 */
export async function refreshActiveWalletBalance() {
  if (!currentContext.address || !currentContext.chainId) {
    return null;
  }

  const { loadWeb3 } = await import("../foundation.js");
  const wagmi = await loadWeb3();
  const { address, chainId } = currentContext;

  return refreshBalance(
    address,
    chainId,
    (addr, chain) => wagmi.fetchBalance({ address: addr, chainId: chain })
  );
}

/**
 * Subscribe to balance updates for the active wallet.
 * Automatically filters to only the active wallet's address.
 * @param {(balance: any) => void} callback
 * @returns {() => void} Unsubscribe function
 */
export function subscribeActiveWalletBalance(callback) {
  return subscribeBalance((payload) => {
    if (currentContext.address &&
      payload.address?.toLowerCase() === currentContext.address.toLowerCase()) {
      callback(payload.balance);
    }
  });
}

/**
 * Get the balance context object for components that need it.
 * Backwards compatible with setBalanceContext API.
 * @returns {Promise<{ address: string, chainId: number, fetcher: Function }|null>}
 */
export async function getBalanceContextForComponent() {
  if (!currentContext.address || !currentContext.chainId) {
    return null;
  }

  const { loadWeb3 } = await import("../foundation.js");
  const wagmi = await loadWeb3();

  return {
    address: currentContext.address,
    chainId: currentContext.chainId,
    fetcher: (addr, chain) => wagmi.fetchBalance({ address: addr, chainId: chain }),
  };
}

/**
 * Cleanup watchers (call on page unload if needed).
 */
export function destroyActiveWalletContext() {
  if (accountUnsubscribe) {
    accountUnsubscribe();
    accountUnsubscribe = null;
  }
  if (networkUnsubscribe) {
    networkUnsubscribe();
    networkUnsubscribe = null;
  }
  initialized = false;
  currentContext = { address: null, chainId: null, isConnected: false };
  log("destroyed");
}
