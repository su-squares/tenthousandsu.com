/**
 * Shared ENS cache with 24h TTL and single-flight fetches.
 * Persists to localStorage (per address+chain) and keeps an in-memory layer for fast lookups.
 * @module ens-store
 */
import { createDebugLogger } from "../config/logger.js";

const log = createDebugLogger("ens-store");
const TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const STORAGE_PREFIX = "su-ens";

const memoryCache = new Map();
const inFlight = new Map();
const listeners = new Set();

const now = () => Date.now();

function makeKey(address, chainId) {
  if (!address || !chainId) return null;
  return `${STORAGE_PREFIX}:${chainId}:${address.toLowerCase()}`;
}

function isFresh(entry) {
  if (!entry || typeof entry.fetchedAt !== "number") return false;
  return now() - entry.fetchedAt < TTL_MS;
}

function readFromStorage(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!isFresh(parsed)) {
      localStorage.removeItem(key);
      return null;
    }
    return parsed;
  } catch (_error) {
    return null;
  }
}

function writeToStorage(key, entry) {
  try {
    localStorage.setItem(key, JSON.stringify(entry));
  } catch (_error) {
    /* ignore quota issues */
  }
}

function getEntry(address, chainId) {
  const key = makeKey(address, chainId);
  if (!key) return { key: null, entry: null };

  const mem = memoryCache.get(key);
  if (isFresh(mem)) {
    return { key, entry: mem };
  }

  const stored = readFromStorage(key);
  if (stored) {
    memoryCache.set(key, stored);
    return { key, entry: stored };
  }

  // Clean up stale memory entry
  memoryCache.delete(key);
  return { key, entry: null };
}

function saveEntry(key, name) {
  const entry = { name: name || null, fetchedAt: now() };
  memoryCache.set(key, entry);
  writeToStorage(key, entry);
  return entry;
}

function notify(address, chainId, name, source) {
  if (!listeners.size) return;
  const payload = { address, chainId, name: name || null, source };
  listeners.forEach((fn) => {
    try {
      fn(payload);
    } catch (_error) {
      /* ignore subscriber errors */
    }
  });
}

/**
 * Get a cached ENS name if it is still fresh.
 * @param {string} address
 * @param {number} chainId
 * @returns {string|null}
 */
export function getCachedEnsName(address, chainId) {
  const { entry } = getEntry(address, chainId);
  if (entry && isFresh(entry)) {
    return entry.name || null;
  }
  return null;
}

/**
 * Fetch an ENS name with caching and single-flight protection.
 * @param {{ address: string, chainId: number, fetcher: (address: string, chainId: number) => Promise<string|null> }} params
 * @returns {Promise<{ name: string|null, source: "cache"|"fresh" }>}
 */
export function getEnsName(params) {
  const { address, chainId, fetcher } = params || {};
  const { key, entry } = getEntry(address, chainId);
  if (!key || typeof fetcher !== "function") {
    return Promise.resolve({ name: null, source: "cache" });
  }

  if (entry) {
    return Promise.resolve({ name: entry.name || null, source: "cache" });
  }

  if (inFlight.has(key)) {
    return inFlight.get(key);
  }

  const promise = (async () => {
    let name = null;
    try {
      name = await fetcher(address, chainId);
      saveEntry(key, name);
      notify(address, chainId, name, "fresh");
      log("fetched ENS", { address, chainId, name });
      return { name: name || null, source: "fresh" };
    } catch (error) {
      log("fetch ENS failed", error);
      throw error;
    } finally {
      inFlight.delete(key);
    }
  })();

  inFlight.set(key, promise);
  return promise;
}

/**
 * Warm the cache without caring about the result.
 * @param {string} address
 * @param {number} chainId
 * @param {(address: string, chainId: number) => Promise<string|null>} fetcher
 */
export function prefetchEnsName(address, chainId, fetcher) {
  getEnsName({ address, chainId, fetcher }).catch(() => {
    /* ignore failures when prefetching */
  });
}

/** @param {(payload: { address: string, chainId: number, name: string|null, source: string }) => void} listener */
export function subscribeEns(listener) {
  if (typeof listener !== "function") return () => {};
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function clearEnsCacheForAddress(address, chainId) {
  const key = makeKey(address, chainId);
  if (!key) return;
  memoryCache.delete(key);
  inFlight.delete(key);
  try {
    localStorage.removeItem(key);
  } catch (_error) {
    /* ignore */
  }
}

export function clearAllEnsCache() {
  memoryCache.clear();
  inFlight.clear();
  try {
    const toRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(`${STORAGE_PREFIX}:`)) {
        toRemove.push(key);
      }
    }
    toRemove.forEach((key) => localStorage.removeItem(key));
    log("cleared ENS cache", { count: toRemove.length });
  } catch (_error) {
    /* ignore */
  }
}

export const ENS_CACHE_TTL_MS = TTL_MS;
