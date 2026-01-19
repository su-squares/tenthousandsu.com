/**
 * Homepage billboard wrapper
 * Now a real wrapper around createBillboard():
 * - Core handles: grid, hover/click, keyboard nav (when grid focused), tooltip/highlight rendering, core blocklists
 * - Wrapper handles: linkAnchor wiring, leaving-modal integration, electric fence animation, global keyboard nav (when grid not focused)
 */

import { createBillboard, GRID_DIMENSION } from "../billboard-core.js";
import { isMintInternalLink, shouldHideUriLabel } from "./link-label-utils.js";
import { extractScheme, isBlockedScheme } from "../../js/link-utils.js";
import { assetPath } from "../../js/asset-base.js";
import { scheduleBillboardRuntimeFallback } from "../runtime-fallback.js";

/**
 * Initialize the homepage billboard
 * @param {Object} options
 * @param {HTMLElement} options.mapWrapper - The .map-wrapper element (acts as mounted wrapper)
 * @param {HTMLImageElement} options.image - The billboard image element (already in DOM)
 * @param {HTMLElement} options.positionDiv - The highlight/position indicator (already in DOM)
 * @param {HTMLElement} options.tooltipDiv - The tooltip element (already in DOM)
 * @param {HTMLElement} options.fenceContainer - Container for electric fence elements
 * @param {HTMLAnchorElement} options.linkAnchor - The #wheretogo anchor
 * @param {HTMLButtonElement} [options.resetButton] - Optional reset zoom button
 * @param {string} options.baseurl - Site base URL
 * @param {Function} [options.normalizeHref] - URL normalization function
 * @returns {Object} Controller with methods
 */
export function initHomepageBillboard(options) {
  const {
    mapWrapper,
    image,
    positionDiv,
    tooltipDiv,
    fenceContainer,
    linkAnchor,
    resetButton,
    baseurl = "",
    normalizeHref = (href) => href,
  } = options;

  if (!mapWrapper || !image || !positionDiv || !tooltipDiv) {
    console.error("Homepage billboard: missing required elements");
    return null;
  }

  // Ensure homepage tooltip uses core tooltip styling (purple gradient + yellow text)
  // while retaining the homepage layout class (map-tooltip).
  tooltipDiv.classList.add("billboard__tooltip");

  // Data state
  let squarePersonalizations = [];

  // Tracks last “position” even if selection is cleared (for global keyboard nav)
  let positionSquareNumber = 1;

  // Electric fence state
  const fence = new Set();
  let litUpEdge = new Set();
  const wasEverLitUp = new Set();

  // Remove initial href from link anchor
  if (linkAnchor) {
    linkAnchor.removeAttribute("href");
  }

  /**
   * Build UI model for a square (used for tooltip text + link behavior + cursor),
   * given info computed by core (blocklists, href, etc).
   */
  function getSquareUi(squareNumber, ctx, info) {
    const personalization = ctx?.personalization;
    const pLabel = Array.isArray(personalization) ? personalization[0] : null;
    const pHrefRaw = Array.isArray(personalization) ? personalization[1] : null;
    const mintedEmpty = !pLabel && !pHrefRaw;

    const isSquareBlocked = Boolean(info?.isSquareBlocked);
    const isDomainBlocked = Boolean(info?.isDomainBlocked);
    const isBlockedAny = isSquareBlocked || isDomainBlocked;

    // Destination logic
    let destinationHref = null;
    const hrefRawString = typeof pHrefRaw === "string" ? pHrefRaw.trim() : "";
    const scheme = hrefRawString ? extractScheme(hrefRawString) : null;
    const isBlockedUriScheme = Boolean(scheme && isBlockedScheme(scheme));

    if (isSquareBlocked) {
      destinationHref = null;
    } else if (!personalization) {
      destinationHref = isBlockedAny ? null : `${baseurl}/buy?square=${squareNumber}`;
    } else if (mintedEmpty) {
      destinationHref = null;
    } else if (isBlockedUriScheme) {
      destinationHref = null;
    } else {
      const normalized = normalizeHref(pHrefRaw);
      destinationHref = normalized ? normalized : null;
    }

    const hideUriLabel = shouldHideUriLabel(pLabel, destinationHref, baseurl);

    // Tooltip text
    // IMPORTANT: For blocked squares OR blocked domains, show the same "disabled" type.
    let tooltipText = `#${squareNumber}`;

    if (isBlockedAny) {
      tooltipText = `Square #${squareNumber} — For your protection, this square is disabled`;
    } else if (!personalization) {
      tooltipText = `Square #${squareNumber} is available for sale, click to buy.`;
    } else if (mintedEmpty) {
      tooltipText = `Square #${squareNumber} WAS PURCHASED BUT NOT YET PERSONALIZED`;
    } else if (isBlockedUriScheme) {
      tooltipText = `Square #${squareNumber} — Link blocked for your protection`;
    } else if (hideUriLabel) {
      tooltipText = `Square #${squareNumber} — Personalized link available`;
    } else {
      tooltipText = pLabel ? `Square #${squareNumber} ${pLabel}` : `Square #${squareNumber}`;
    }

    // Cursor
    let cursor = "not-allowed";
    if (!isBlockedAny) {
      if (!personalization) cursor = "pointer";
      else if (mintedEmpty) cursor = "not-allowed";
      else cursor = destinationHref ? "pointer" : "not-allowed";
    }

    return {
      destinationHref,
      tooltipText,
      cursor,
      clickable: Boolean(destinationHref),
    };
  }

  /**
   * Core billboard instance mounted into existing DOM.
   */
  const billboard = createBillboard(mapWrapper, {
    mode: "interactive",
    enableGrid: true,
    enableKeyboard: true,
    enablePanZoom: true,
    enableCoreBlocklists: true,
    allowBlockedSelection: true,

    // Use homepage grid classes
    gridClassName: "map-grid",
    cellClassName: "map-grid__cell",
    ariaLabel: "Su Squares billboard",
    gridTestId: "billboard-grid",

    // CRITICAL: prevent core from applying a special "blocked" tooltip class.
    // We want blocked/domain-blocked squares to look like "disabled" (data-disabled="true"),
    // not like a separate blocked theme.
    blockedTooltipCssClass: "",
    missingLinkTooltipSuffix: "(Square has no link)",
    missingTextTooltipSuffix: "(Square has no text)",

    // Mount existing DOM nodes so we don't create duplicates
    mount: {
      wrapper: mapWrapper,
      image,
      highlight: positionDiv,
      tooltip: tooltipDiv,
    },

    getPersonalization(squareNumber) {
      return squarePersonalizations[squareNumber - 1] ?? null;
    },

    // Core uses this for domain-block checks
    getHref(squareNumber, ctx) {
      const p = ctx?.personalization;
      if (!p || !Array.isArray(p)) return null;
      const raw = p[1];
      const normalized = normalizeHref(raw);
      return normalized ? normalized : null;
    },

    // Disable clicking for “minted but not personalized” or missing href,
    // while still allowing hover/selection.
    filter(squareNumber, ctx) {
      const personalization = ctx?.personalization;

      // Available for sale
      if (!personalization) return true;

      if (Array.isArray(personalization)) {
        const label = personalization[0];
        const hrefRaw = personalization[1];

        // Minted but not personalized
        if (!label && !hrefRaw) {
          return {
            allowed: false,
            showDisabledTooltip: false,
            reason: "minted-empty",
          };
        }

        // Allow activation for blocked URI schemes so we can show the blocked modal.
        if (typeof hrefRaw === "string") {
          const scheme = extractScheme(hrefRaw.trim());
          if (scheme && isBlockedScheme(scheme)) {
            return true;
          }
        }

        // Personalized but missing/invalid href
        const normalized = normalizeHref(hrefRaw);
        if (!normalized) {
          return {
            allowed: false,
            showDisabledTooltip: false,
            reason: "invalid-href",
          };
        }

        return true;
      }

      return false;
    },

    // Homepage tooltip content
    getTooltipContent(squareNumber, ctx, info) {
      const ui = getSquareUi(squareNumber, ctx, info);
      return ui.tooltipText;
    },

    // Always return null so the homepage uses the default core tooltip styling
    // for normal squares, and the core disabled styling for any not-allowed squares.
    getTooltipCssClass() {
      return null;
    },

    // Keep linkAnchor + cursor synced with current selection
    onSquareHover(squareNumber, ctx, info) {
      positionSquareNumber = squareNumber;

      const ui = getSquareUi(squareNumber, ctx, info);

      if (image) {
        image.style.cursor = ui.cursor;
      }

      if (!linkAnchor) return;

      const shouldExposeHref =
        Boolean(ui.destinationHref) &&
        !info?.isSquareBlocked &&
        !info?.isDomainBlocked &&
        isMintInternalLink(ui.destinationHref, baseurl);

      if (shouldExposeHref) {
        linkAnchor.href = ui.destinationHref;
      } else {
        linkAnchor.removeAttribute("href");
      }
    },

    onClearSelection() {
      if (image) {
        image.style.cursor = "";
      }
      if (linkAnchor) {
        linkAnchor.removeAttribute("href");
      }
    },

    onSquareActivate(squareNumber, event, ctx, info) {
      if (event && typeof event.preventDefault === "function") {
        event.preventDefault();
      }
      if (event && typeof event.stopPropagation === "function") {
        event.stopPropagation();
      }

      if (info?.isSquareBlocked) {
        const blockedModal = window.SuBlockedModal;
        if (blockedModal && typeof blockedModal.show === "function") {
          blockedModal.show(`Square #${squareNumber}`, { variant: "square" });
        }
        return;
      }

      // Handle blocked URI schemes (javascript:, data:, etc.) by showing blocked modal.
      const rawHref = Array.isArray(ctx?.personalization) ? ctx.personalization[1] : null;
      if (typeof rawHref === "string" && rawHref.trim()) {
        const scheme = extractScheme(rawHref.trim());
        if (scheme && isBlockedScheme(scheme)) {
          const modal = window.SuLeavingModal;
          const target = linkAnchor?.getAttribute("target") || "_self";
          if (modal && typeof modal.gateLinkNavigation === "function") {
            modal.gateLinkNavigation(rawHref, event, target);
            return;
          }
          const blockedModal = window.SuBlockedModal;
          if (blockedModal && typeof blockedModal.show === "function") {
            blockedModal.show(`${scheme}:`, { variant: "uri" });
          }
          return;
        }
      }

      const ui = getSquareUi(squareNumber, ctx, info);
      if (!ui.destinationHref) return;

      if (info?.isDomainBlocked) {
        const blockedModal = window.SuBlockedModal;
        if (blockedModal && typeof blockedModal.show === "function") {
          blockedModal.show(info.href || ui.destinationHref, { variant: "domain" });
        }
        return;
      }

      const target = linkAnchor?.getAttribute("target") || "_self";
      const modal = window.SuLeavingModal;

      if (modal && typeof modal.gateLinkNavigation === "function") {
        const handled = modal.gateLinkNavigation(ui.destinationHref, event, target);
        if (handled) return;
      }

      if (target === "_self") {
        window.location.assign(ui.destinationHref);
      } else {
        window.open(ui.destinationHref, target, "noopener");
      }
    },
  });

  scheduleBillboardRuntimeFallback({
    onChange: () => {
      if (image) {
        image.src = assetPath("wholeSquare.png");
      }
    },
  });

  // Touch UX is handled in billboard-core-events.js:
  // first tap previews (tooltip), second tap activates.

  // Wire up reset button to core billboard reset
  if (resetButton) {
    resetButton.addEventListener("click", () => billboard.reset());
  }

  // Leaving modal integration with unified URI gating
  function handleLinkClick(event) {
    if (billboard.panZoom && billboard.panZoom.hasPanned && billboard.panZoom.hasPanned()) {
      event.preventDefault();
      return;
    }

    if (!linkAnchor) return;

    const href = linkAnchor.getAttribute("href");
    if (!href || href === "#") return;

    const modal = window.SuLeavingModal;

    // Use unified gateLinkNavigation if available (handles all URI types)
    if (modal && typeof modal.gateLinkNavigation === "function") {
      const target = linkAnchor.getAttribute("target") || "_self";
      modal.gateLinkNavigation(href, event, target);
      return;
    }

    // Fallback to legacy behavior
    if (!modal || typeof modal.shouldWarnForUrl !== "function" || typeof modal.show !== "function") {
      return;
    }

    let destination;
    try {
      destination = new URL(href, window.location.href);
    } catch {
      return;
    }

    if (!modal.shouldWarnForUrl(destination)) return;

    event.preventDefault();
    modal.show(destination, linkAnchor.getAttribute("target") || "_self");
  }

  if (linkAnchor) {
    linkAnchor.addEventListener("click", handleLinkClick);
  }

  // Global keyboard navigation (when grid is NOT focused) — preserves your old behavior
  function handleDocumentKeydown(event) {
    const grid = billboard.elements.grid;
    if (grid && event.target && grid.contains(event.target)) return;

    const key = event.key.toLowerCase();
    let nextSquare = null;

    if (key === "w" || key === "," || key === "arrowup") {
      if (positionSquareNumber > GRID_DIMENSION) nextSquare = positionSquareNumber - GRID_DIMENSION;
      event.preventDefault();
    } else if (key === "a" || key === "arrowleft") {
      if (positionSquareNumber % GRID_DIMENSION !== 1) nextSquare = positionSquareNumber - 1;
    } else if (key === "s" || key === "o" || key === "arrowdown") {
      if (positionSquareNumber <= GRID_DIMENSION * (GRID_DIMENSION - 1)) nextSquare = positionSquareNumber + GRID_DIMENSION;
      event.preventDefault();
    } else if (key === "d" || key === "e" || key === "arrowright") {
      if (positionSquareNumber % GRID_DIMENSION !== 0) nextSquare = positionSquareNumber + 1;
    } else if (key === "enter") {
      billboard.activateSquare(positionSquareNumber, event);
      return;
    } else {
      return;
    }

    if (nextSquare) {
      positionSquareNumber = nextSquare;
      billboard.setSquare(nextSquare);
    }
  }

  document.addEventListener("keydown", handleDocumentKeydown);

  // Electric fence animation (unchanged)
  function lightUpFence(edge) {
    // Clean up previous edge
    litUpEdge.forEach((s) => {
      const element = document.getElementById(`electric-fence-${s}`);
      if (element && element.parentNode) {
        element.parentNode.removeChild(element);
      }
    });
    litUpEdge.clear();

    const nextEdge = new Set();

    edge.forEach((square) => {
      wasEverLitUp.add(square);

      const element = document.createElement("div");
      element.id = `electric-fence-${square}`;
      element.style.pointerEvents = "none";
      element.style.position = "absolute";
      element.style.left = `${(square - 1) % GRID_DIMENSION}%`;
      element.style.top = `${Math.floor((square - 1) / GRID_DIMENSION)}%`;
      element.style.width = "1%";
      element.style.height = "1%";
      element.style.background = "#ffd700";
      element.style.opacity = "0.25";
      fenceContainer.appendChild(element);

      if (squarePersonalizations[square - 1] !== null) {
        litUpEdge.add(square);

        if (square > GRID_DIMENSION && !wasEverLitUp.has(square - GRID_DIMENSION)) {
          nextEdge.add(square - GRID_DIMENSION);
        }
        if (square <= GRID_DIMENSION * (GRID_DIMENSION - 1) && !wasEverLitUp.has(square + GRID_DIMENSION)) {
          nextEdge.add(square + GRID_DIMENSION);
        }
        if (square % GRID_DIMENSION !== 1 && !wasEverLitUp.has(square - 1)) {
          nextEdge.add(square - 1);
        }
        if (square % GRID_DIMENSION !== 0 && !wasEverLitUp.has(square + 1)) {
          nextEdge.add(square + 1);
        }
      } else {
        fence.add(square);
      }
    });

    if (nextEdge.size > 0) {
      setTimeout(() => lightUpFence(nextEdge), 25);
    }
  }

  return {
    async setData(personalizations, _extra) {
      squarePersonalizations = personalizations || [];
    },

    startFenceAnimation() {
      lightUpFence(new Set([1]));
    },

    setPosition(squareNumber) {
      positionSquareNumber = squareNumber;
      billboard.setSquare(squareNumber);
    },

    clearSelection() {
      billboard.clearSelection();
    },

    get currentSquare() {
      return positionSquareNumber;
    },

    panZoom: billboard.panZoom,
    grid: billboard.elements.grid,
    cells: billboard.elements.cells,
  };
}
