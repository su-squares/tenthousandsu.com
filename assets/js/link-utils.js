/**
 * Normalize a user-provided href so it is a valid absolute URL.
 * - Keeps existing schemes (http/https/mailto/etc) and protocol-relative (//example.com)
 * - Otherwise prefixes https://
 * @param {string} href
 * @returns {string} normalized URL or empty string if input is empty/invalid
 */
export function normalizeHref(href) {
  if (!href || typeof href !== "string") return "";
  const trimmed = href.trim();
  if (!trimmed) return "";
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)) return trimmed;
  if (trimmed.startsWith("//")) return trimmed;
  return `https://${trimmed}`;
}
