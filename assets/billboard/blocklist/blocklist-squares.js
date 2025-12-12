/**
 * Square Blocklist - Billboard-specific square blocking
 *
 * Blocks specific square numbers with a black overlay.
 * When a square is blocked:
 * - Black overlay covers the square image
 * - Link is disabled
 * - Blocked tooltip appears on hover
 *
 * Also supports a "text silenced" list that keeps personalization text out of tooltips
 * while still showing the square normally.
 *
 * Uses the Square Override API to apply visual changes.
 * Supports range strings: "100-1000,2000,2050-5000"
 */

import { parseRangeString, TOTAL_SQUARES } from "../square-override.js";

// Blocklist state
let blockedSquares = new Set();
let textSilencedSquares = new Set();
let loadPromise = null;

function coerceSquareNumber(value) {
  const num = Number(value);
  if (Number.isNaN(num)) return null;
  if (num < 1 || num > TOTAL_SQUARES) return null;
  return num;
}

function toSquareSet(input) {
  if (input === null || input === undefined) {
    return new Set();
  }

  if (typeof input === "string") {
    return parseRangeString(input);
  }

  if (Array.isArray(input)) {
    const set = new Set();
    for (const value of input) {
      const squareNumber = coerceSquareNumber(value);
      if (squareNumber) {
        set.add(squareNumber);
      }
    }
    return set;
  }

  const squareNumber = coerceSquareNumber(input);
  return squareNumber ? new Set([squareNumber]) : new Set();
}

/**
 * Check if a square number is blocked
 * @param {number} squareNumber
 * @returns {boolean}
 */
export function isSquareBlocked(squareNumber) {
  return blockedSquares.has(squareNumber);
}

/**
 * Check if a square's personalization text should be silenced
 * @param {number} squareNumber
 * @returns {boolean}
 */
export function isSquareTextSilenced(squareNumber) {
  return textSilencedSquares.has(squareNumber);
}

/**
 * Load blocklist from JSON file
 * Supports either a legacy range string / array of numbers, or an object:
 * {
 *   "blocked": "100-200,500",
 *   "textSilenced": [12, 13]
 * }
 * @param {string} [url] - URL to blocklist JSON
 * @returns {Promise<void>}
 */
export async function load(url) {
  const blocklistUrl = url || new URL("blocklist-squares.json", import.meta.url).href;

  try {
    const response = await fetch(blocklistUrl);
    if (!response.ok) {
      throw new Error(`Failed to load blocklist: ${response.status}`);
    }

    const text = await response.text();
    const trimmed = text.trim();

    // Empty file or whitespace = no blocked/text-silenced squares
    if (!trimmed) {
      blockedSquares = new Set();
      textSilencedSquares = new Set();
      return;
    }

    let parsedJson = null;
    try {
      parsedJson = JSON.parse(trimmed);
    } catch {
      parsedJson = null;
    }

    if (parsedJson && typeof parsedJson === "object" && !Array.isArray(parsedJson)) {
      blockedSquares = toSquareSet(parsedJson.blocked ?? parsedJson.blocklist ?? "");
      textSilencedSquares = toSquareSet(
        parsedJson.textSilenced ?? parsedJson.textHidden ?? parsedJson.textBlocklist ?? ""
      );
      return;
    }

    if (typeof parsedJson === "string" || typeof parsedJson === "number" || Array.isArray(parsedJson)) {
      blockedSquares = toSquareSet(parsedJson);
      textSilencedSquares = new Set();
      return;
    }

    // Legacy text content: treat the whole file as a range string
    blockedSquares = parseRangeString(trimmed);
    textSilencedSquares = new Set();
  } catch (error) {
    console.error("[SquareBlocklist] Error loading blocklist:", error);
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
 * Add a square to the blocklist (runtime only, not persisted)
 * @param {number} squareNumber
 */
export function addSquare(squareNumber) {
  if (squareNumber >= 1 && squareNumber <= TOTAL_SQUARES) {
    blockedSquares.add(squareNumber);
  }
}

/**
 * Add multiple squares to the blocklist
 * @param {number[]} squares
 */
export function addSquares(squares) {
  for (const square of squares) {
    addSquare(square);
  }
}

/**
 * Add a square to the text-silenced list (runtime only, not persisted)
 * @param {number} squareNumber
 */
export function addTextSilencedSquare(squareNumber) {
  if (squareNumber >= 1 && squareNumber <= TOTAL_SQUARES) {
    textSilencedSquares.add(squareNumber);
  }
}

/**
 * Add multiple squares to the text-silenced list
 * @param {number[]} squares
 */
export function addTextSilencedSquares(squares) {
  for (const square of squares) {
    addTextSilencedSquare(square);
  }
}

/**
 * Add squares from a range string
 * @param {string} rangeString - e.g., "100-200,500"
 */
export function addRange(rangeString) {
  const squares = parseRangeString(rangeString);
  for (const square of squares) {
    blockedSquares.add(square);
  }
}

/**
 * Remove a square from the blocklist (runtime only)
 * @param {number} squareNumber
 */
export function removeSquare(squareNumber) {
  blockedSquares.delete(squareNumber);
  textSilencedSquares.delete(squareNumber);
}

/**
 * Clear all blocked squares
 */
export function clear() {
  blockedSquares.clear();
  textSilencedSquares.clear();
  loadPromise = null;
}

/**
 * Get all blocked squares
 * @returns {Set<number>}
 */
export function getBlockedSquares() {
  return new Set(blockedSquares);
}

/**
 * Get text-silenced squares
 * @returns {Set<number>}
 */
export function getTextSilencedSquares() {
  return new Set(textSilencedSquares);
}

/**
 * Get count of blocked squares
 * @returns {number}
 */
export function count() {
  return blockedSquares.size;
}

// Export as namespace object for convenience
export const SquareBlocklist = {
  load,
  loadOnce,
  isSquareBlocked,
  isSquareTextSilenced,
  addSquare,
  addSquares,
  addTextSilencedSquare,
  addTextSilencedSquares,
  addRange,
  removeSquare,
  clear,
  getBlockedSquares,
  getTextSilencedSquares,
  count,
  parseRangeString,
};
