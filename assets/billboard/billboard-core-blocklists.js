/**
 * Billboard core blocklist integration
 * Owns:
 * - Loading core blocklists once (memoized)
 * - Simple check helpers
 * - Applying core square-blocklist overlays to an override manager
 */

import { SquareBlocklist } from "./blocklist/blocklist-squares.js";
import { DomainBlocklist } from "../blocklist/blocklist-domains.js";

let coreBlocklistsPromise = null;

/**
 * Load core blocklists once (memoized).
 * @returns {Promise<void>}
 */
export function loadCoreBlocklistsOnce() {
  if (!coreBlocklistsPromise) {
    coreBlocklistsPromise = Promise.all([
      SquareBlocklist.loadOnce(),
      DomainBlocklist.loadOnce(),
    ])
      .then(() => undefined)
      .catch((error) => {
        console.error("[BillboardCore] Failed to load core blocklists:", error);
      });
  }
  return coreBlocklistsPromise;
}

/**
 * Shared readiness promise (starts immediately).
 * @type {Promise<void>}
 */
export const coreBlocklistsReady = loadCoreBlocklistsOnce();

/**
 * Check if a square is blocked by the core square blocklist.
 * @param {number} squareNumber
 * @returns {boolean}
 */
export function isCoreSquareBlocked(squareNumber) {
  return SquareBlocklist.isSquareBlocked(squareNumber);
}

/**
 * Check if a square's personalization text is silenced by core policy.
 * @param {number} squareNumber
 * @returns {boolean}
 */
export function isCoreSquareTextHidden(squareNumber) {
  return SquareBlocklist.isSquareTextSilenced(squareNumber);
}

/**
 * Check if an href is blocked by the core domain blocklist.
 * @param {string|null|undefined} href
 * @returns {boolean}
 */
export function isCoreHrefBlocked(href) {
  if (!href || typeof href !== "string") return false;
  return DomainBlocklist.isDomainBlockedByHref(href);
}

/**
 * Apply core square-blocklist overlays to an override manager.
 * Uses locked overrides so wrappers cannot replace core policy overlays.
 *
 * @param {Object|null} overrideManager
 * @param {Object} options
 * @param {Object} [options.style]
 * @param {string} [options.tooltipCssClass]
 * @param {(n:number)=>string} [options.tooltipText]
 * @returns {Promise<void>}
 */
export async function applyCoreSquareBlocklistOverrides(overrideManager, options = {}) {
  if (!overrideManager) return;

  const {
    style = { background: "#000" },
    tooltipCssClass = "billboard__tooltip--blocked",
    tooltipText = (n) => `Square #${n} — For your protection, this square is disabled`,
  } = options;

  await coreBlocklistsReady;

  const blockedSquares = SquareBlocklist.getBlockedSquares();
  for (const squareNumber of blockedSquares) {
    overrideManager.register(squareNumber, {
      style,
      clickable: false,
      locked: true,
      tooltip: {
        text: tooltipText(squareNumber),
        cssClass: tooltipCssClass,
      },
    });
  }
}
