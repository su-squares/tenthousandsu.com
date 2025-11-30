/**
 * WalletConnect deep link session storage with 24h TTL.
 * Mirrors the ritoswap behavior: capture display_uri once, derive topic, and reuse for mobile deep links.
 * @module wc-store
 */

const STORAGE_KEY = "su-wc-session";
const TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

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
 * @param {string} uri
 * @returns {string}
 */
export function sanitizeUri(uri) {
  if (!uri) return uri;
  if (uri.startsWith("wc:") && !uri.includes("http")) return uri;
  const topic = extractTopic(uri);
  if (topic) return `wc:${topic}@2`;
  return uri;
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
      localStorage.removeItem(STORAGE_KEY);
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
  const sanitized = sanitizeUri(uri);
  const topic = extractTopic(sanitized);
  const entry = { uri: sanitized, topic, savedAt: Date.now() };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entry));
  } catch (_error) {
    /* ignore quota issues */
  }
  return entry;
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
  } catch (_error) {
    /* ignore */
  }
}

export function clearStoredSession() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (_error) {
    /* ignore */
  }
}

/**
 * Attempt to open the wallet app using the stored topic/uri.
 * @param {string=} fallbackUri
 * @returns {boolean} true if we attempted a navigation
 */
export function openWalletDeepLink(fallbackUri) {
  const session = getStoredSession();
  const target = session?.uri || (session?.topic ? `wc:${session.topic}@2` : fallbackUri);
  if (!target) return false;
  window.location.href = target;
  return true;
}
