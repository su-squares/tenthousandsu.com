/**
 * WalletConnect deep link session storage with 24h TTL.
 * Mirrors the ritoswap behavior: capture display_uri once, derive topic, and reuse for mobile deep links.
 * @module wc-store
 */

const MOBILE_QUERY = "(max-width: 730px)";
const SESSION_EVENT = "su-wc-session-change";

const STORAGE_KEY = "su-wc-session";
const TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const DEBUG = Boolean(typeof window !== "undefined" && window?.suWeb3?.debug);
const log = (...args) => {
  if (DEBUG) console.debug("[wc-store]", ...args);
};

/**
 * @param {string} uri
 * @returns {string|null}
 */
export function extractTopic(uri) {
  if (!uri) return null;
  const match =
    uri.match(/wc:([a-f0-9]+)@/i) ||
    uri.match(/sessionTopic=([a-f0-9]+)/i) ||
    uri.match(/topic=([a-f0-9]+)/i) ||
    uri.match(/([a-f0-9]{64})/i);
  return match ? match[1] : null;
}

/**
 * Normalize a WalletConnect URI to a topic-only form for storage.
 * Keeps query params/symKey out of persistence.
 * @param {string} uri
 * @returns {string}
 */
export function sanitizeUri(uri) {
  if (!uri) return uri;
  const topic = extractTopic(uri);
  if (topic) return `wc:${topic}@2`;
  if (uri.startsWith("wc:") && !uri.includes("http")) return uri;
  return uri;
}

function emitSessionChange(hasSession) {
  try {
    if (typeof window !== "undefined" && typeof window.dispatchEvent === "function") {
      window.dispatchEvent(new CustomEvent(SESSION_EVENT, { detail: { hasSession } }));
    }
  } catch (_error) {
    /* ignore event dispatch issues */
  }
}

/** Basic mobile/touch capability check for WalletConnect deep links. */
export function isWalletCapable() {
  try {
    const touch = typeof navigator !== "undefined" && navigator.maxTouchPoints > 0;
    const media =
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia(MOBILE_QUERY).matches;
    return Boolean(touch || media);
  } catch (_error) {
    return false;
  }
}

/**
 * @returns {{ uri: string, topic: string | null, savedAt: number } | null}
 */
export function getStoredSession() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.savedAt || Date.now() - parsed.savedAt > TTL_MS) {
      log("session expired, clearing");
      localStorage.removeItem(STORAGE_KEY);
      emitSessionChange(false);
      return null;
    }
    return {
      uri: parsed.uri,
      topic: parsed.topic || extractTopic(parsed.uri),
      savedAt: parsed.savedAt,
    };
  } catch (_error) {
    return null;
  }
}

/**
 * @param {string} uri
 * @returns {{ uri: string, topic: string | null, savedAt: number }}
 */
export function rememberUri(uri) {
  // Keep the full URI available to immediate callers (for pairing),
  // but only persist a topic-only version to storage.
  const persistedUri = sanitizeUri(uri);
  const topic = extractTopic(uri);
  const entry = { uri: persistedUri, topic, savedAt: Date.now() };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entry));
    log("remembered session", { topic: topic ? topic.slice(0, 8) : null, persisted: true });
    emitSessionChange(true);
  } catch (_error) {
    /* ignore quota issues */
  }
  return { ...entry, uri: uri || persistedUri };
}

/** @param {string|null} topic */
export function rememberTopic(topic) {
  if (!topic) return;
  const entry = getStoredSession() || { uri: `wc:${topic}@2`, topic: null, savedAt: Date.now() };
  entry.topic = topic;
  entry.uri = sanitizeUri(entry.uri || `wc:${topic}@2`);
  entry.savedAt = Date.now();
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entry));
    log("updated session topic", { topic: topic ? topic.slice(0, 8) : null });
    emitSessionChange(true);
  } catch (_error) {
    /* ignore */
  }
}

export function clearStoredSession() {
  try {
    localStorage.removeItem(STORAGE_KEY);
    log("cleared session from storage");
    emitSessionChange(false);
  } catch (_error) {
    /* ignore */
  }
}

/**
 * Best-effort cleanup of WalletConnect-related localStorage keys when a session becomes corrupted.
 * Optionally limit to keys that look empty/invalid.
 * @param {{ onlyEmpty?: boolean }} [options]
 */
export function clearWalletConnectStorage(options = {}) {
  const prefixes = ["wc@2:client:", "wc@2:", "walletconnect"];
  const onlyEmpty = Boolean(options.onlyEmpty);
  const removed = [];
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (!key || !prefixes.some((prefix) => key.startsWith(prefix))) continue;

      if (!onlyEmpty) {
        removed.push(key);
        localStorage.removeItem(key);
        continue;
      }

      const value = localStorage.getItem(key);
      if (!value || value === "{}") {
        removed.push(key);
        localStorage.removeItem(key);
        continue;
      }

      try {
        const parsed = JSON.parse(value);
        if (!parsed || (typeof parsed === "object" && Object.keys(parsed).length === 0)) {
          removed.push(key);
          localStorage.removeItem(key);
        }
      } catch (_error) {
        // keep non-empty/unparseable values when onlyEmpty=true
      }
    }
    if (removed.length) {
      log("cleared WalletConnect storage", { count: removed.length, onlyEmpty });
    }
  } catch (_error) {
    /* ignore cleanup errors */
  }
}

/**
 * Attempt to open the wallet app using the stored topic/uri.
 * @param {string=} fallbackUri
 * @param {{ userInitiated?: boolean, failureTimeoutMs?: number }} [options]
 * @returns {boolean} true if we attempted a navigation
 */
export function openWalletDeepLink(fallbackUri, options = {}) {
  const session = getStoredSession();
  // Prefer the provided URI (with symKey) when available, otherwise fall back to stored/topic-only.
  const target = fallbackUri || session?.uri || (session?.topic ? `wc:${session.topic}@2` : null);
  if (!target) return false;

  const userInitiated = Boolean(options.userInitiated);
  const failureTimeoutMs =
    typeof options.failureTimeoutMs === "number" ? options.failureTimeoutMs : 1200;

  let settled = false;
  let timer = null;

  const cleanup = () => {
    if (timer) clearTimeout(timer);
    window.removeEventListener("pagehide", handlePageHide);
    document.removeEventListener("visibilitychange", handleVisibilityChange);
  };

  const handleFailure = () => {
    if (settled) return;
    settled = true;
    // Disabled mobile detection modal; leave unhandled for now.
    cleanup();
  };

  const markSuccess = () => {
    if (settled) return;
    settled = true;
    cleanup();
  };

  const handleVisibilityChange = () => {
    if (document.visibilityState === "hidden") {
      markSuccess();
    }
  };

  const handlePageHide = () => {
    markSuccess();
  };

  timer = window.setTimeout(() => {
    if (!settled && document.visibilityState !== "hidden") {
      handleFailure();
    } else {
      markSuccess();
    }
  }, failureTimeoutMs);

  window.addEventListener("pagehide", handlePageHide);
  document.addEventListener("visibilitychange", handleVisibilityChange);

  log("attempting deep link", {
    source: fallbackUri ? "fallback" : session?.uri ? "stored" : "topic-only",
    hasTopic: Boolean(session?.topic || extractTopic(fallbackUri)),
    userInitiated,
  });

  try {
    const link = document.createElement("a");
    link.href = target;
    link.style.display = "none";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch (_error) {
    handleFailure();
    return false;
  }

  return true;
}
