/**
 * Shared ETH balance cache with 60s stale threshold and single-flight fetches.
 * In-memory only (balances are too volatile for localStorage).
 * Auto-polls every 60s while there are active subscribers.
 * @module balance-store
 */
import { createDebugLogger } from "../config/logger.js";

const log = createDebugLogger("balance-store");

const STALE_MS = 60 * 1000; // 60 seconds
const POLL_INTERVAL_MS = 60 * 1000; // 1 minute

/** @type {Map<string, { balance: any, fetchedAt: number }>} */
const memoryCache = new Map();

/** @type {Map<string, Promise<any>>} */
const inFlight = new Map();

/** @type {Set<(payload: { address: string, chainId: number, balance: any, source: string }) => void>} */
const listeners = new Set();

/** @type {{ address: string, chainId: number, fetcher: Function } | null} */
let pollContext = null;

/** @type {number | null} */
let pollIntervalId = null;

const now = () => Date.now();

/**
 * Create cache key from address and chainId.
 * @param {string} address
 * @param {number} chainId
 * @returns {string|null}
 */
function makeKey(address, chainId) {
    if (!address || !chainId) return null;
    return `${chainId}:${address.toLowerCase()}`;
}

/**
 * Check if cached entry is still fresh.
 * @param {{ balance: any, fetchedAt: number } | undefined} entry
 * @returns {boolean}
 */
function isFresh(entry) {
    if (!entry || typeof entry.fetchedAt !== "number") return false;
    return now() - entry.fetchedAt < STALE_MS;
}

/**
 * Get cached entry if it exists and is fresh.
 * @param {string} address
 * @param {number} chainId
 * @returns {{ key: string|null, entry: { balance: any, fetchedAt: number }|null }}
 */
function getEntry(address, chainId) {
    const key = makeKey(address, chainId);
    if (!key) return { key: null, entry: null };

    const mem = memoryCache.get(key);
    if (isFresh(mem)) {
        return { key, entry: mem };
    }

    // Clean up stale entry
    memoryCache.delete(key);
    return { key, entry: null };
}

/**
 * Save balance to cache.
 * @param {string} key
 * @param {any} balance
 * @returns {{ balance: any, fetchedAt: number }}
 */
function saveEntry(key, balance) {
    const entry = { balance, fetchedAt: now() };
    memoryCache.set(key, entry);
    return entry;
}

/**
 * Notify all listeners of a balance update.
 * @param {string} address
 * @param {number} chainId
 * @param {any} balance
 * @param {string} source
 */
function notify(address, chainId, balance, source) {
    if (!listeners.size) return;
    const payload = { address, chainId, balance, source };
    listeners.forEach((fn) => {
        try {
            fn(payload);
        } catch (_error) {
            /* ignore subscriber errors */
        }
    });
}

/**
 * Start polling if not already running and there are subscribers.
 */
function maybeStartPolling() {
    if (pollIntervalId !== null) return;
    if (listeners.size === 0) return;
    if (!pollContext) return;

    log("starting polling", { interval: POLL_INTERVAL_MS });

    pollIntervalId = setInterval(async () => {
        if (!pollContext) {
            maybeStopPolling();
            return;
        }

        const { address, chainId, fetcher } = pollContext;
        try {
            await refreshBalance(address, chainId, fetcher);
        } catch (error) {
            log("poll refresh failed", error);
        }
    }, POLL_INTERVAL_MS);
}

/**
 * Stop polling if running.
 */
function maybeStopPolling() {
    if (pollIntervalId === null) return;

    log("stopping polling");
    clearInterval(pollIntervalId);
    pollIntervalId = null;
}

/**
 * Get cached balance if it exists and is fresh.
 * @param {string} address
 * @param {number} chainId
 * @returns {any|null}
 */
export function getCachedBalance(address, chainId) {
    const { entry } = getEntry(address, chainId);
    return entry?.balance ?? null;
}

/**
 * Fetch balance with caching and single-flight protection.
 * @param {{ address: string, chainId: number, fetcher: (address: string, chainId: number) => Promise<any> }} params
 * @returns {Promise<{ balance: any, source: "cache"|"fresh" }>}
 */
export function getBalance(params) {
    const { address, chainId, fetcher } = params || {};
    const { key, entry } = getEntry(address, chainId);

    if (!key || typeof fetcher !== "function") {
        return Promise.resolve({ balance: null, source: "cache" });
    }

    // Update poll context for future polling
    pollContext = { address, chainId, fetcher };
    maybeStartPolling();

    if (entry) {
        return Promise.resolve({ balance: entry.balance, source: "cache" });
    }

    if (inFlight.has(key)) {
        return inFlight.get(key);
    }

    const promise = (async () => {
        let balance = null;
        try {
            balance = await fetcher(address, chainId);
            saveEntry(key, balance);
            notify(address, chainId, balance, "fresh");
            log("fetched balance", { address, chainId, balance: balance?.formatted });
            return { balance, source: "fresh" };
        } catch (error) {
            log("fetch balance failed", error);
            throw error;
        } finally {
            inFlight.delete(key);
        }
    })();

    inFlight.set(key, promise);
    return promise;
}

/**
 * Force a fresh balance fetch, ignoring cache.
 * @param {string} address
 * @param {number} chainId
 * @param {(address: string, chainId: number) => Promise<any>} fetcher
 * @returns {Promise<any>}
 */
export async function refreshBalance(address, chainId, fetcher) {
    const key = makeKey(address, chainId);
    if (!key || typeof fetcher !== "function") {
        return null;
    }

    // Invalidate current cache
    memoryCache.delete(key);

    // Cancel any in-flight request by waiting for it first
    if (inFlight.has(key)) {
        try {
            await inFlight.get(key);
        } catch (_error) {
            /* ignore */
        }
    }

    // Fetch fresh
    const result = await getBalance({ address, chainId, fetcher });
    return result.balance;
}

/**
 * Invalidate cached balance for an address (call after tx confirms).
 * @param {string} address
 * @param {number} chainId
 */
export function invalidateBalance(address, chainId) {
    const key = makeKey(address, chainId);
    if (!key) return;

    memoryCache.delete(key);
    inFlight.delete(key);
    log("invalidated balance", { address, chainId });
}

/**
 * Subscribe to balance updates.
 * @param {(payload: { address: string, chainId: number, balance: any, source: string }) => void} listener
 * @returns {() => void} Unsubscribe function
 */
export function subscribeBalance(listener) {
    if (typeof listener !== "function") return () => { };

    listeners.add(listener);
    maybeStartPolling();

    return () => {
        listeners.delete(listener);
        if (listeners.size === 0) {
            maybeStopPolling();
            pollContext = null;
        }
    };
}

/**
 * Clear all cached balances (useful for disconnect).
 */
export function clearAllBalanceCache() {
    memoryCache.clear();
    inFlight.clear();
    maybeStopPolling();
    pollContext = null;
    log("cleared all balance cache");
}

/**
 * Get current polling status (for debugging).
 * @returns {{ isPolling: boolean, subscriberCount: number, cacheSize: number }}
 */
export function getBalanceStoreStatus() {
    return {
        isPolling: pollIntervalId !== null,
        subscriberCount: listeners.size,
        cacheSize: memoryCache.size,
    };
}

export const BALANCE_STALE_MS = STALE_MS;
export const BALANCE_POLL_INTERVAL_MS = POLL_INTERVAL_MS;
