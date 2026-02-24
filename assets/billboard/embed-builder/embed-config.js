/**
 * Embed Configuration Module
 *
 * Centralized URL parameter parsing and building for the embed system.
 * Shared by both embed.html (runtime) and embed-builder.html (configuration UI).
 */

import { parseRangeString } from "../square-override.js";

// Re-export for convenience
export { parseRangeString };

const HEADER_SIZE_DEFAULT = Object.freeze({ value: "2", unit: "rem" });
const HEADER_SIZE_UNITS = ["px", "rem", "em", "vh", "vw", "%"];
const DEFAULT_TEXT_COLOR = "#ffd700";
export const GRADIENT_BACKGROUND =
  "linear-gradient(135deg, rgba(45, 60, 150, 0.95), rgba(213, 51, 146, 0.9))";

/**
 * Default embed configuration
 */
export const DEFAULT_CONFIG = {
  panzoom: true,
  bg: "#000000",
  useGradientBackground: true,
  header: "susquares",
  headerColor: DEFAULT_TEXT_COLOR,
  headerSizeValue: HEADER_SIZE_DEFAULT.value,
  headerSizeUnit: HEADER_SIZE_DEFAULT.unit,
  hintColor: DEFAULT_TEXT_COLOR,
  resetButtonColor: DEFAULT_TEXT_COLOR,
  blockSquares: "",
  silenceSquares: "",
  blockDomains: [],
};

function parsePanzoomParam(param) {
  if (param === "off") return false;
  if (param === "on") return true;
  return DEFAULT_CONFIG.panzoom;
}

function normalizeColorParam(param, fallback) {
  if (!param || typeof param !== "string") {
    return fallback;
  }

  const result = validateColor(param);
  if (result.valid && result.normalized) {
    return result.normalized;
  }

  return fallback;
}

function normalizeColorForUrl(value) {
  if (!value || typeof value !== "string") {
    return null;
  }

  const result = validateColor(value);
  if (result.valid && result.normalized) {
    return result.normalized;
  }

  return null;
}

/**
 * Header text options
 */
export const HEADER_OPTIONS = {
  susquares: "Su Squares Billboard",
  billboard: "Billboard",
  squares: "Su Squares",
  none: "",
};

function parseHeaderSizeParam(param) {
  const fallback = {
    headerSizeValue: HEADER_SIZE_DEFAULT.value,
    headerSizeUnit: HEADER_SIZE_DEFAULT.unit,
  };

  if (!param || typeof param !== "string") {
    return fallback;
  }

  const trimmed = param.trim();
  if (!trimmed) {
    return fallback;
  }

  const match = trimmed.match(/^(-?\d*\.?\d+)(px|rem|em|vh|vw|%)$/i);
  if (!match) {
    return fallback;
  }

  const value = match[1];
  const unit = match[2].toLowerCase();
  if (!HEADER_SIZE_UNITS.includes(unit)) {
    return fallback;
  }

  return {
    headerSizeValue: value,
    headerSizeUnit: unit,
  };
}

/**
 * Parse embed configuration from URL
 * @param {string} [url] - URL to parse (defaults to current location)
 * @returns {Object} Parsed config object
 */
export function parseEmbedConfigFromUrl(url) {
  const urlObj = url ? new URL(url, window.location.href) : new URL(window.location.href);
  const params = urlObj.searchParams;

  const headerSize = parseHeaderSizeParam(params.get("headerSize"));
  const hasBgParam = params.has("bg");
  const bgValue = hasBgParam ? params.get("bg") || DEFAULT_CONFIG.bg : DEFAULT_CONFIG.bg;

  return {
    panzoom: parsePanzoomParam(params.get("panzoom")),
    bg: bgValue,
    useGradientBackground: !hasBgParam,
    header: params.get("header") || DEFAULT_CONFIG.header,
    headerSizeValue: headerSize.headerSizeValue,
    headerSizeUnit: headerSize.headerSizeUnit,
    headerColor: normalizeColorParam(params.get("headerColor"), DEFAULT_CONFIG.headerColor),
    hintColor: normalizeColorParam(params.get("hintColor"), DEFAULT_CONFIG.hintColor),
    resetButtonColor: normalizeColorParam(
      params.get("resetButtonColor"),
      DEFAULT_CONFIG.resetButtonColor
    ),
    blockSquares: params.get("blockSquares") || DEFAULT_CONFIG.blockSquares,
    silenceSquares: params.get("silenceSquares") || DEFAULT_CONFIG.silenceSquares,
    blockDomains: params.get("blockDomains")
      ? params.get("blockDomains").split(",").map((d) => d.trim()).filter(Boolean)
      : [],
  };
}

/**
 * Build embed URL from config state
 * Only includes non-default values to keep URL clean
 * @param {Object} config - Config object
 * @param {string} baseUrl - Base URL for the embed page
 * @returns {string} Full URL with query params
 */
export function buildEmbedUrlFromState(config, baseUrl) {
  const url = new URL(baseUrl, window.location.href);
  const params = url.searchParams;

  // Clear existing params
  for (const key of [...params.keys()]) {
    params.delete(key);
  }

  // Only add non-default values
  if (config.panzoom === false) {
    params.set("panzoom", "off");
  }

  if (config.useGradientBackground === false) {
    const bgValue =
      typeof config.bg === "string" && config.bg.trim()
        ? config.bg.trim()
        : DEFAULT_CONFIG.bg;
    params.set("bg", bgValue);
  }

  if (config.header && config.header !== DEFAULT_CONFIG.header) {
    params.set("header", config.header);
  }

  const headerColor = normalizeColorForUrl(config.headerColor);
  if (headerColor && headerColor !== DEFAULT_CONFIG.headerColor) {
    params.set("headerColor", headerColor);
  }

  const sizeValue = typeof config.headerSizeValue === "string" ? config.headerSizeValue.trim() : "";
  const sizeUnit = config.headerSizeUnit || "";
  if (sizeValue && sizeUnit) {
    const combined = `${sizeValue}${sizeUnit}`;
    const defaultCombined = `${DEFAULT_CONFIG.headerSizeValue}${DEFAULT_CONFIG.headerSizeUnit}`;
    if (combined !== defaultCombined) {
      params.set("headerSize", combined);
    }
  }

  const hintColor = normalizeColorForUrl(config.hintColor);
  if (hintColor && hintColor !== DEFAULT_CONFIG.hintColor) {
    params.set("hintColor", hintColor);
  }

  const resetColor = normalizeColorForUrl(config.resetButtonColor);
  if (resetColor && resetColor !== DEFAULT_CONFIG.resetButtonColor) {
    params.set("resetButtonColor", resetColor);
  }

  if (config.blockSquares && config.blockSquares.trim()) {
    params.set("blockSquares", config.blockSquares.trim());
  }

  if (config.silenceSquares && config.silenceSquares.trim()) {
    params.set("silenceSquares", config.silenceSquares.trim());
  }

  if (config.blockDomains && config.blockDomains.length > 0) {
    const domains = Array.isArray(config.blockDomains)
      ? config.blockDomains
      : config.blockDomains.split(",").map((d) => d.trim()).filter(Boolean);
    if (domains.length > 0) {
      params.set("blockDomains", domains.join(","));
    }
  }

  return url.toString();
}

/**
 * Validate a square range string
 * @param {string} rangeString - Range string to validate (e.g., "10-500,700")
 * @returns {Object} { valid: boolean, error?: string, parsed?: Set<number> }
 */
export function validateSquareRange(rangeString) {
  if (!rangeString || !rangeString.trim()) {
    return { valid: true, parsed: new Set() };
  }

  const trimmed = rangeString.trim();

  // Check for obviously invalid characters
  if (!/^[\d,\s-]+$/.test(trimmed)) {
    return {
      valid: false,
      error: "Invalid characters. Use numbers, commas, and hyphens only.",
    };
  }

  try {
    const parsed = parseRangeString(trimmed);

    // Check if anything was parsed
    if (parsed.size === 0 && trimmed.length > 0) {
      return {
        valid: false,
        error: "No valid squares found. Format: 1-100,500,600-700",
      };
    }

    return { valid: true, parsed };
  } catch (e) {
    return {
      valid: false,
      error: e.message || "Invalid range format",
    };
  }
}

/**
 * Validate a CSS color value
 * @param {string} color - Color string to validate
 * @returns {Object} { valid: boolean, normalized?: string, error?: string }
 */
export function validateColor(color) {
  if (!color || color === "transparent") {
    return { valid: true, normalized: "transparent" };
  }

  const trimmed = color.trim();

  // Handle hex without # prefix
  if (/^[0-9a-fA-F]{3}$/.test(trimmed) || /^[0-9a-fA-F]{6}$/.test(trimmed)) {
    return { valid: true, normalized: "#" + trimmed };
  }

  // Handle hex with # prefix
  if (/^#[0-9a-fA-F]{3}$/.test(trimmed) || /^#[0-9a-fA-F]{6}$/.test(trimmed)) {
    return { valid: true, normalized: trimmed };
  }

  // Use CSS.supports for other color formats
  if (typeof CSS !== "undefined" && CSS.supports && CSS.supports("background-color", trimmed)) {
    return { valid: true, normalized: trimmed };
  }

  // Fallback: accept common color names
  const commonColors = [
    "black", "white", "red", "green", "blue", "yellow", "orange", "purple",
    "pink", "gray", "grey", "brown", "cyan", "magenta", "lime", "navy",
    "teal", "olive", "maroon", "silver", "aqua", "fuchsia",
  ];

  if (commonColors.includes(trimmed.toLowerCase())) {
    return { valid: true, normalized: trimmed.toLowerCase() };
  }

  return {
    valid: false,
    error: "Invalid color. Use hex (#ff5500) or color names.",
  };
}

/**
 * Validate a comma-separated domain list
 * @param {string} domainsString - Comma-separated domains
 * @returns {Object} { valid: boolean, domains: string[], invalid: string[] }
 */
export function validateDomains(domainsString) {
  if (!domainsString || !domainsString.trim()) {
    return { valid: true, domains: [], invalid: [] };
  }

  const parts = domainsString.split(",").map((d) => d.trim()).filter(Boolean);
  const valid = [];
  const invalid = [];

  // Basic domain pattern (allows subdomains)
  const domainPattern = /^([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)*[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z]{2,})?$/i;

  for (const domain of parts) {
    // Also accept simple domains like "localhost" or "example"
    if (domainPattern.test(domain) || /^[a-z0-9-]+$/i.test(domain)) {
      valid.push(domain.toLowerCase());
    } else {
      invalid.push(domain);
    }
  }

  return {
    valid: invalid.length === 0,
    domains: valid,
    invalid,
  };
}

/**
 * Check if URL length might cause issues
 * @param {string} url - URL to check
 * @returns {Object} { ok: boolean, warning?: string, length: number }
 */
export function checkUrlLength(url) {
  const length = url.length;

  if (length > 2000) {
    return {
      ok: false,
      warning: `URL is ${length} characters. Some browsers/servers may not support URLs over 2000 characters.`,
      length,
    };
  }

  if (length > 1500) {
    return {
      ok: true,
      warning: `URL is ${length} characters. Consider reducing blocklist size for better compatibility.`,
      length,
    };
  }

  return { ok: true, length };
}

// Export as namespace object for convenience
export const EmbedConfig = {
  DEFAULT_CONFIG,
  HEADER_OPTIONS,
  parseEmbedConfigFromUrl,
  buildEmbedUrlFromState,
  validateSquareRange,
  validateColor,
  validateDomains,
  checkUrlLength,
  parseRangeString,
};
