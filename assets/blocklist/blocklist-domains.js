/**
 * Domain Blocklist - Global domain blocking for links
 *
 * Used by:
 * - Billboard (tooltip-based blocking, no modal)
 * - Link Guard (blocked modal for non-billboard links)
 *
 * Domain matching includes subdomains and parent domains:
 * - If "evil.com" is blocked, "sub.evil.com" is also blocked
 * - If "sub.evil.com" is blocked, "evil.com" is also blocked
 */

// Blocklist state
let blockedDomains = new Set();
let loadPromise = null;

/**
 * Normalize a domain for comparison
 * @param {string} domain
 * @returns {string}
 */
function normalizeDomain(domain) {
  if (!domain || typeof domain !== "string") return "";
  return domain.toLowerCase().trim();
}

/**
 * Extract domain from a URL or href string
 * @param {string} href
 * @returns {string|null}
 */
export function extractDomain(href) {
  if (!href || typeof href !== "string") return null;

  try {
    // Handle relative URLs by providing a base
    const url = new URL(href, "https://example.com");

    // Only process http/https
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return null;
    }

    return normalizeDomain(url.hostname);
  } catch {
    return null;
  }
}

/**
 * Get all domain parts for matching (domain + all parent domains)
 * e.g., "a.b.c.com" → ["a.b.c.com", "b.c.com", "c.com", "com"]
 * @param {string} domain
 * @returns {string[]}
 */
function getDomainParts(domain) {
  const normalized = normalizeDomain(domain);
  if (!normalized) return [];

  const parts = normalized.split(".");
  const result = [];

  for (let i = 0; i < parts.length; i++) {
    result.push(parts.slice(i).join("."));
  }

  return result;
}

/**
 * Check if a domain matches any blocked domain
 * Matches if:
 * - Exact match with blocked domain
 * - Domain is a subdomain of blocked domain
 * - Domain is a parent domain of blocked domain
 * @param {string} domain
 * @returns {boolean}
 */
export function isDomainBlocked(domain) {
  const normalized = normalizeDomain(domain);
  if (!normalized) return false;

  // Check direct match
  if (blockedDomains.has(normalized)) {
    return true;
  }

  // Check if domain is a subdomain of any blocked domain
  // e.g., if "evil.com" is blocked, "sub.evil.com" is also blocked
  const domainParts = getDomainParts(normalized);
  for (const part of domainParts) {
    if (blockedDomains.has(part)) {
      return true;
    }
  }

  // Check if any blocked domain is a subdomain of this domain
  // e.g., if "sub.evil.com" is blocked, "evil.com" is also blocked
  for (const blockedDomain of blockedDomains) {
    const blockedParts = getDomainParts(blockedDomain);
    if (blockedParts.includes(normalized)) {
      return true;
    }
  }

  return false;
}

/**
 * Check if a URL/href uses a blocked domain
 * @param {string} href
 * @returns {boolean}
 */
export function isDomainBlockedByHref(href) {
  const domain = extractDomain(href);
  if (!domain) return false;
  return isDomainBlocked(domain);
}

/**
 * Load blocklist from JSON file
 * @param {string} [url] - URL to blocklist JSON (defaults to same directory)
 * @returns {Promise<void>}
 */
export async function load(url) {
  // Default URL relative to this script
  const blocklistUrl = url || new URL("blocklist-domains.json", import.meta.url).href;

  try {
    const response = await fetch(blocklistUrl);
    if (!response.ok) {
      throw new Error(`Failed to load blocklist: ${response.status}`);
    }

    const data = await response.json();

    // Expect an array of domain strings
    if (Array.isArray(data)) {
      blockedDomains = new Set(data.map(normalizeDomain).filter(Boolean));
    } else {
      console.warn("[DomainBlocklist] Expected array, got:", typeof data);
      blockedDomains = new Set();
    }
  } catch (error) {
    console.error("[DomainBlocklist] Error loading blocklist:", error);
    // Keep existing blocklist on error
  }
}

/**
 * Load blocklist (memoized - only loads once)
 * @param {string} [url]
 * @returns {Promise<void>}
 */
export function loadOnce(url) {
  if (!loadPromise) {
    loadPromise = load(url);
  }
  return loadPromise;
}

/**
 * Add a domain to the blocklist (runtime only, not persisted)
 * @param {string} domain
 */
export function addDomain(domain) {
  const normalized = normalizeDomain(domain);
  if (normalized) {
    blockedDomains.add(normalized);
  }
}

/**
 * Add multiple domains to the blocklist
 * @param {string[]} domains
 */
export function addDomains(domains) {
  for (const domain of domains) {
    addDomain(domain);
  }
}

/**
 * Remove a domain from the blocklist (runtime only)
 * @param {string} domain
 */
export function removeDomain(domain) {
  const normalized = normalizeDomain(domain);
  if (normalized) {
    blockedDomains.delete(normalized);
  }
}

/**
 * Clear all blocked domains
 */
export function clear() {
  blockedDomains.clear();
  loadPromise = null;
}

/**
 * Get all blocked domains
 * @returns {Set<string>}
 */
export function getBlockedDomains() {
  return new Set(blockedDomains);
}

/**
 * Get count of blocked domains
 * @returns {number}
 */
export function count() {
  return blockedDomains.size;
}

// Export as namespace object for convenience
export const DomainBlocklist = {
  load,
  loadOnce,
  isDomainBlocked,
  isDomainBlockedByHref,
  extractDomain,
  addDomain,
  addDomains,
  removeDomain,
  clear,
  getBlockedDomains,
  count,
};
