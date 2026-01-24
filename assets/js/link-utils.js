/**
 * Link utilities for URL normalization and URI classification.
 */

// URI Classification categories
export const URI_CLASSIFICATION = {
  BLOCKED: "blocked",
  DEEPLINK: "deeplink",
  EXTERNAL: "external",
  INTERNAL: "internal",
};

// Dangerous schemes that should be blocked entirely
const BLOCKED_SCHEMES = new Set([
  "javascript",
  "data",
  "blob",
  "vbscript",
  "file",
]);

// HTTP-based schemes (standard web URLs)
const HTTP_SCHEMES = new Set(["http", "https"]);

/**
 * Detect safe relative hrefs that should be treated as internal navigation.
 * Supports absolute-path and relative-path references.
 * @param {string} href
 * @returns {boolean}
 */
function isRelativeHref(href) {
  if (!href || typeof href !== "string") return false;
  return (
    href.startsWith("/") ||
    href.startsWith("./") ||
    href.startsWith("../") ||
    href.startsWith("?") ||
    href.startsWith("#")
  );
}

/**
 * Decode URL-encoded string and extract scheme.
 * Handles cases like %6A%61%76%61%73%63%72%69%70%74: (encoded "javascript:")
 * @param {string} href
 * @returns {string|null} Lowercase scheme without colon, or null
 */
export function extractScheme(href) {
  if (!href || typeof href !== "string") return null;

  let decoded = href.trim();
  if (!decoded) return null;

  // Iteratively decode until no more changes (handles double-encoding)
  let prevDecoded;
  let iterations = 0;
  const maxIterations = 5;

  do {
    prevDecoded = decoded;
    try {
      decoded = decodeURIComponent(decoded);
    } catch {
      // Invalid encoding, use as-is
      break;
    }
    iterations++;
  } while (decoded !== prevDecoded && iterations < maxIterations);

  // Extract scheme (everything before first colon)
  const schemeMatch = decoded.match(/^([a-zA-Z][a-zA-Z0-9+.-]*):/);
  if (!schemeMatch) return null;

  return schemeMatch[1].toLowerCase();
}

/**
 * Check if a scheme is blocked (dangerous).
 * @param {string} scheme - Lowercase scheme without colon
 * @returns {boolean}
 */
export function isBlockedScheme(scheme) {
  return BLOCKED_SCHEMES.has(scheme);
}

/**
 * Check if a scheme is HTTP-based.
 * @param {string} scheme - Lowercase scheme without colon
 * @returns {boolean}
 */
export function isHttpScheme(scheme) {
  return HTTP_SCHEMES.has(scheme);
}

/**
 * Check if a path is a safe internal path that should navigate directly.
 * @param {URL} url
 * @returns {boolean}
 */
export function isSafeInternalPath(url) {
  if (!url) return false;

  // /buy page should navigate directly
  if (url.pathname === "/buy" || url.pathname.startsWith("/buy/")) {
    return true;
  }

  return false;
}

/**
 * Classify a URI into categories.
 * @param {string} href - The URI to classify
 * @param {string} [currentOrigin] - Current page origin (defaults to window.location.origin)
 * @returns {{ classification: string, scheme: string|null, url: URL|null, displayUri: string }}
 */
export function classifyUri(href, currentOrigin) {
  const result = {
    classification: URI_CLASSIFICATION.BLOCKED,
    scheme: null,
    url: null,
    displayUri: href || "",
  };

  if (!href || typeof href !== "string") {
    return result;
  }

  const trimmed = href.trim();
  if (!trimmed) {
    return result;
  }

  // Extract and check scheme (handles URL-encoded schemes)
  const scheme = extractScheme(trimmed);
  result.scheme = scheme;

  // Check for blocked schemes
  if (scheme && isBlockedScheme(scheme)) {
    result.classification = URI_CLASSIFICATION.BLOCKED;
    result.displayUri = `${scheme}:`;
    return result;
  }

  // Handle protocol-relative URLs (//example.com)
  if (trimmed.startsWith("//")) {
    try {
      const url = new URL("https:" + trimmed);
      result.url = url;
      result.displayUri = url.href;

      const origin = currentOrigin || window.location.origin;
      if (url.origin === origin) {
        result.classification = URI_CLASSIFICATION.INTERNAL;
      } else {
        result.classification = URI_CLASSIFICATION.EXTERNAL;
      }
    } catch {
      result.classification = URI_CLASSIFICATION.BLOCKED;
    }
    return result;
  }

  // Handle relative/internal references (/path, ./path, ../path, ?q=, #hash)
  if (isRelativeHref(trimmed)) {
    try {
      const url = new URL(trimmed, window.location.href);
      result.url = url;
      result.displayUri = trimmed;

      const origin = currentOrigin || window.location.origin;
      result.classification =
        url.origin === origin
          ? URI_CLASSIFICATION.INTERNAL
          : URI_CLASSIFICATION.EXTERNAL;
    } catch {
      result.classification = URI_CLASSIFICATION.BLOCKED;
    }

    return result;
  }

  // Non-HTTP schemes that aren't blocked are deeplinks
  if (scheme && !isHttpScheme(scheme)) {
    result.classification = URI_CLASSIFICATION.DEEPLINK;
    result.displayUri = trimmed;
    return result;
  }

  // Parse as URL
  try {
    // If no scheme, assume https
    const urlString = scheme ? trimmed : `https://${trimmed}`;
    const url = new URL(urlString, window.location.href);
    result.url = url;
    result.displayUri = url.href;
    result.scheme = url.protocol.replace(":", "");

    // Check if internal
    const origin = currentOrigin || window.location.origin;
    if (url.origin === origin) {
      result.classification = URI_CLASSIFICATION.INTERNAL;
    } else {
      result.classification = URI_CLASSIFICATION.EXTERNAL;
    }
  } catch {
    // If URL parsing fails, treat as blocked for safety
    result.classification = URI_CLASSIFICATION.BLOCKED;
  }

  return result;
}

/**
 * Normalize a user-provided href so it is a valid absolute URL.
 * - Returns empty string for blocked schemes (javascript:, data:, etc.)
 * - Keeps existing safe schemes (http/https/mailto/tel/etc) and protocol-relative (//example.com)
 * - Otherwise prefixes https://
 * @param {string} href
 * @returns {string} normalized URL or empty string if input is empty/invalid/blocked
 */
export function normalizeHref(href) {
  if (!href || typeof href !== "string") return "";
  const trimmed = href.trim();
  if (!trimmed) return "";

  // Check for blocked schemes before allowing through
  const scheme = extractScheme(trimmed);
  if (scheme && isBlockedScheme(scheme)) {
    return "";
  }

  // Keep safe relative/internal references as-is
  if (trimmed.startsWith("//")) return trimmed;
  if (isRelativeHref(trimmed)) return trimmed;

  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

// Expose as globals for IIFE modules (modal-core.js, etc.)
if (typeof window !== "undefined") {
  window.SuLinkUtils = {
    URI_CLASSIFICATION,
    extractScheme,
    isBlockedScheme,
    isHttpScheme,
    isSafeInternalPath,
    classifyUri,
    normalizeHref,
  };
}
