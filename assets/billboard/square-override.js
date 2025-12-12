/**
 * Square Override API - Foundational overlay mechanism for billboard squares
 *
 * This API provides a flexible way to overlay content on specific squares.
 * It can be used for blocking, highlighting, badges, custom overlays, etc.
 * The blocklist system builds on top of this API.
 *
 * Supports "locked" overrides:
 * - If a square has an override with { locked: true }, later register() calls
 *   without locked:true will NOT replace it. This prevents wrappers from
 *   overriding core policy overlays (blocklists).
 */

import { TOTAL_SQUARES } from "./billboard-utils.js";

/**
 * Parse a range string into a Set of square numbers
 * Supports: "100-200,500,600-650" → Set([100,101,...,200,500,600,...,650])
 * @param {string} rangeString
 * @returns {Set<number>}
 */
export function parseRangeString(rangeString) {
  const result = new Set();
  if (!rangeString || typeof rangeString !== "string") {
    return result;
  }

  const parts = rangeString.split(",").map((s) => s.trim()).filter(Boolean);

  for (const part of parts) {
    if (part.includes("-")) {
      const [startStr, endStr] = part.split("-").map((s) => s.trim());
      const start = parseInt(startStr, 10);
      const end = parseInt(endStr, 10);

      if (!Number.isNaN(start) && !Number.isNaN(end) && start <= end) {
        for (let i = start; i <= end; i++) {
          if (i >= 1 && i <= TOTAL_SQUARES) {
            result.add(i);
          }
        }
      }
    } else {
      const num = parseInt(part, 10);
      if (!Number.isNaN(num) && num >= 1 && num <= TOTAL_SQUARES) {
        result.add(num);
      }
    }
  }

  return result;
}

/**
 * Create a Square Override manager for a billboard instance
 * @param {HTMLElement[]} cells - Array of cell elements from the billboard
 * @returns {Object} Override manager API
 */
export function createSquareOverrideManager(cells) {
  // Registry: squareNumber -> config
  const overrides = new Map();

  // Track original cell state for cleanup
  const originalState = new Map();

  function saveOriginalState(squareNumber, cell) {
    if (!originalState.has(squareNumber)) {
      originalState.set(squareNumber, {
        className: cell.className,
        style: cell.getAttribute("style") || "",
        innerHTML: cell.innerHTML,
      });
    }
  }

  function restoreOriginalState(squareNumber, cell) {
    const original = originalState.get(squareNumber);
    if (original) {
      cell.className = original.className;
      cell.setAttribute("style", original.style);
      cell.innerHTML = original.innerHTML;
      originalState.delete(squareNumber);
    }
  }

  function applyOverride(cell, squareNumber, config) {
    saveOriginalState(squareNumber, cell);

    cell.dataset.override = "true";

    if (config.cssClass) {
      cell.classList.add(...config.cssClass.split(/\s+/).filter(Boolean));
    }

    if (config.style && typeof config.style === "object") {
      Object.assign(cell.style, config.style);
    }

    if (config.backgroundImage) {
      cell.style.backgroundImage = config.backgroundImage;
      cell.style.backgroundSize = config.backgroundSize || "cover";
      cell.style.backgroundPosition = config.backgroundPosition || "center";
    }

    if (config.innerHTML) {
      cell.innerHTML = config.innerHTML;
    }

    if (typeof config.render === "function") {
      config.render(cell, squareNumber, { config });
    }
  }

  function removeOverride(cell, squareNumber, config) {
    if (typeof config.cleanup === "function") {
      config.cleanup(cell, squareNumber);
    }

    restoreOriginalState(squareNumber, cell);

    delete cell.dataset.override;
  }

  /**
   * Register an override for a square
   * @param {number} squareNumber
   * @param {Object} config - Override configuration
   * @param {string} [config.cssClass]
   * @param {Object} [config.style]
   * @param {string} [config.backgroundImage]
   * @param {string} [config.innerHTML]
   * @param {Function} [config.render]
   * @param {Function} [config.cleanup]
   * @param {Object} [config.tooltip]
   * @param {string} [config.tooltip.text]
   * @param {string} [config.tooltip.cssClass]
   * @param {boolean} [config.clickable=true]
   * @param {Function} [config.onActivate]
   * @param {boolean} [config.locked=false] - Prevent non-locked overrides from replacing it
   */
  function register(squareNumber, config) {
    if (squareNumber < 1 || squareNumber > TOTAL_SQUARES) {
      console.warn(`[SquareOverride] Invalid square number: ${squareNumber}`);
      return;
    }

    const cell = cells[squareNumber - 1];
    if (!cell) {
      console.warn(`[SquareOverride] Cell not found for square: ${squareNumber}`);
      return;
    }

    const existing = overrides.get(squareNumber);
    if (existing && existing.locked && !(config && config.locked)) {
      console.warn(`[SquareOverride] Refusing to override locked square: ${squareNumber}`);
      return;
    }

    if (overrides.has(squareNumber)) {
      unregister(squareNumber);
    }

    overrides.set(squareNumber, config);
    applyOverride(cell, squareNumber, config);
  }

  function unregister(squareNumber) {
    const config = overrides.get(squareNumber);
    if (!config) return;

    const cell = cells[squareNumber - 1];
    if (cell) {
      removeOverride(cell, squareNumber, config);
    }

    overrides.delete(squareNumber);
  }

  function has(squareNumber) {
    return overrides.has(squareNumber);
  }

  function get(squareNumber) {
    return overrides.get(squareNumber);
  }

  function getAll() {
    return new Map(overrides);
  }

  function registerBatch(squareNumbers, config) {
    for (const squareNumber of squareNumbers) {
      register(squareNumber, config);
    }
  }

  function registerRange(rangeString, config) {
    const squareNumbers = parseRangeString(rangeString);
    for (const squareNumber of squareNumbers) {
      register(squareNumber, config);
    }
  }

  function unregisterBatch(squareNumbers) {
    for (const squareNumber of squareNumbers) {
      unregister(squareNumber);
    }
  }

  function clear() {
    for (const squareNumber of overrides.keys()) {
      unregister(squareNumber);
    }
  }

  function count() {
    return overrides.size;
  }

  return {
    register,
    unregister,
    has,
    get,
    getAll,
    registerBatch,
    registerRange,
    unregisterBatch,
    clear,
    count,
    parseRangeString,
  };
}

export { TOTAL_SQUARES };
