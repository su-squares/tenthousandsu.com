/**
 * Embed Billboard Wrapper
 *
 * Wrapper around createBillboard() for the embed page.
 * Handles URL parameter configuration, blocklist application,
 * and contained leaving modal integration.
 */

import { createBillboard, GRID_DIMENSION } from "../billboard-core.js";
import { coreBlocklistsReady } from "../billboard-core-blocklists.js";
import { SquareBlocklist } from "../blocklist/blocklist-squares.js";
import { DomainBlocklist } from "../../blocklist/blocklist-domains.js";
import { createContainedLeavingModal } from "../../modals/leaving-modal/leaving-modal-contained.js";
import {
  DEFAULT_CONFIG,
  GRADIENT_BACKGROUND,
  parseEmbedConfigFromUrl,
  HEADER_OPTIONS,
  parseRangeString,
} from "../embed-builder/embed-config.js";

function getHeaderFontSize(config) {
  const defaultSize = `${DEFAULT_CONFIG.headerSizeValue}${DEFAULT_CONFIG.headerSizeUnit}`;
  if (!config || typeof config !== "object") return defaultSize;

  const valueRaw = typeof config.headerSizeValue === "string" ? config.headerSizeValue.trim() : "";
  const unit = typeof config.headerSizeUnit === "string" ? config.headerSizeUnit : "";

  if (!valueRaw || !unit) {
    return defaultSize;
  }

  const numericValue = Number(valueRaw);
  if (Number.isNaN(numericValue)) {
    return defaultSize;
  }

  return `${numericValue}${unit}`;
}

/**
 * Initialize the embed billboard
 * @param {Object} options
 * @param {HTMLElement} options.container - The embed container element
 * @param {HTMLElement} [options.header] - Optional header element
 * @param {HTMLElement} [options.headerTitle] - Header title element to update
 * @param {string} options.baseurl - Site base URL
 * @param {Function} [options.normalizeHref] - URL normalization function
 * @param {Function} [options.onReady] - Callback when billboard is ready
 * @returns {Object|null} Controller object or null on error
 */
export function initEmbedBillboard(options) {
  const {
    container,
    header,
    headerTitle,
    baseurl = "",
    normalizeHref = (href) => href,
    onReady,
  } = options;

  if (!container) {
    console.error("[EmbedBillboard] Missing container element");
    return null;
  }

  // Parse configuration from URL
  const config = parseEmbedConfigFromUrl();
  const panzoomEnabled = config.panzoom !== false;
  const gradientBackgroundEnabled = config.useGradientBackground !== false;
  const headerColor = config.headerColor || DEFAULT_CONFIG.headerColor;
  const hintColor = config.hintColor || DEFAULT_CONFIG.hintColor;
  const resetButtonColor = config.resetButtonColor || DEFAULT_CONFIG.resetButtonColor;

  // Apply background color
  if (gradientBackgroundEnabled) {
    document.body.style.setProperty("--embed-bg", GRADIENT_BACKGROUND);
    document.body.setAttribute("data-bg", "gradient");
  } else if (config.bg && config.bg !== "transparent") {
    document.body.style.setProperty("--embed-bg", config.bg);
    document.body.setAttribute("data-bg", config.bg);
  } else {
    document.body.style.removeProperty("--embed-bg");
    document.body.setAttribute("data-bg", "transparent");
  }

  const headerFontSize = getHeaderFontSize(config);
  const headerText = HEADER_OPTIONS[config.header] || "";

  // Apply header text
  if (header && headerTitle) {
    headerTitle.style.fontSize = headerFontSize;
    headerTitle.style.color = headerColor;
    if (headerText) {
      headerTitle.textContent = headerText;
      header.classList.remove("embed-header--hidden");
    } else {
      header.classList.add("embed-header--hidden");
    }
  }

  const shouldUseFullBleed = !headerText && !panzoomEnabled;
  document.body.setAttribute("data-fullbleed", shouldUseFullBleed ? "true" : "false");

  // Apply URL-based blocklists after core lists finish loading so they don't get overwritten
  const wantsUrlBlocklists =
    Boolean(config.blockSquares) ||
    Boolean(config.silenceSquares) ||
    (Array.isArray(config.blockDomains) && config.blockDomains.length > 0);

  if (wantsUrlBlocklists) {
    coreBlocklistsReady.then(() => {
      if (config.blockSquares) {
        SquareBlocklist.addRange(config.blockSquares);
      }

      if (config.silenceSquares) {
        const silencedSet = parseRangeString(config.silenceSquares);
        for (const sq of silencedSet) {
          SquareBlocklist.addTextSilencedSquare(sq);
        }
      }

      if (config.blockDomains && config.blockDomains.length > 0) {
        DomainBlocklist.addDomains(config.blockDomains);
      }
    });
  }

  // Create billboard DOM elements
  const billboardWrapper = document.createElement("div");
  billboardWrapper.className = "embed-billboard";

  const image = document.createElement("img");
  image.className = "embed-billboard__image";
  image.src = baseurl + "/build/wholeSquare.png";
  image.alt = "Su Squares Billboard";
  image.draggable = false;

  const highlight = document.createElement("div");
  highlight.className = "billboard__highlight";

  const tooltip = document.createElement("div");
  tooltip.className = "billboard__tooltip";

  billboardWrapper.appendChild(image);
  billboardWrapper.appendChild(highlight);
  billboardWrapper.appendChild(tooltip);
  container.appendChild(billboardWrapper);

  // Data state
  let squarePersonalizations = [];

  // Create contained leaving modal
  const modal = createContainedLeavingModal(container, {
    blocklist: config.blockDomains,
  });

  /**
   * Build UI model for a square
   */
  function getSquareUi(squareNumber, ctx, info) {
    const personalization = ctx?.personalization;
    const pLabel = Array.isArray(personalization) ? personalization[0] : null;
    const pHrefRaw = Array.isArray(personalization) ? personalization[1] : null;

    const isSquareBlocked = Boolean(info?.isSquareBlocked);
    const isDomainBlocked = Boolean(info?.isDomainBlocked);
    const isBlockedAny = isSquareBlocked || isDomainBlocked;

    // Destination logic
    let destinationHref = null;

    if (isBlockedAny) {
      destinationHref = null;
    } else if (!personalization) {
      // Available for sale - link to buy page
      destinationHref = `${baseurl}/buy?square=${squareNumber}`;
    } else if (!pLabel && !pHrefRaw) {
      // Minted but not personalized
      destinationHref = null;
    } else {
      const normalized = normalizeHref(pHrefRaw);
      destinationHref = normalized || null;
    }

    // Tooltip text
    let tooltipText = `#${squareNumber}`;

    if (isBlockedAny) {
      tooltipText = `Square #${squareNumber} — For your protection, this square is disabled`;
    } else if (!personalization) {
      tooltipText = `Square #${squareNumber} is available for sale`;
    } else if (!pLabel && !pHrefRaw) {
      tooltipText = `Square #${squareNumber} — Purchased but not yet personalized`;
    } else {
      tooltipText = pLabel ? `Square #${squareNumber} — ${pLabel}` : `Square #${squareNumber}`;
    }

    // Cursor
    let cursor = "not-allowed";
    if (!isBlockedAny) {
      if (!personalization) cursor = "pointer";
      else if (!pLabel && !pHrefRaw) cursor = "not-allowed";
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
   * Create the billboard
   */
  const billboard = createBillboard(billboardWrapper, {
    mode: "interactive",
    enableGrid: true,
    enableKeyboard: true,
    enablePanZoom: panzoomEnabled,
    enableCoreBlocklists: true,

    // Embed-specific classes
    gridClassName: "embed-billboard__grid",
    cellClassName: "embed-billboard__cell",
    ariaLabel: "Su Squares billboard embed",
    gridTestId: "embed-billboard-grid",

    // Prevent core blocked tooltip styling
    blockedTooltipCssClass: "",
    missingLinkTooltipSuffix: "(Square has no link)",
    missingTextTooltipSuffix: "(Square has no text)",

    // Mount existing elements
    mount: {
      wrapper: billboardWrapper,
      image,
      highlight,
      tooltip,
    },

    getPersonalization(squareNumber) {
      return squarePersonalizations[squareNumber - 1] ?? null;
    },

    getHref(squareNumber, ctx) {
      const p = ctx?.personalization;
      if (!p || !Array.isArray(p)) return null;
      const raw = p[1];
      const normalized = normalizeHref(raw);
      return normalized || null;
    },

    filter(squareNumber, ctx) {
      const personalization = ctx?.personalization;

      if (!personalization) return true;

      if (Array.isArray(personalization)) {
        const label = personalization[0];
        const hrefRaw = personalization[1];

        if (!label && !hrefRaw) {
          return {
            allowed: false,
            showDisabledTooltip: false,
            reason: "minted-empty",
          };
        }

        const normalized = normalizeHref(hrefRaw);
        if (!normalized) {
          return {
            allowed: false,
            showDisabledTooltip: true,
            reason: "invalid-href",
          };
        }

        return true;
      }

      return false;
    },

    getTooltipContent(squareNumber, ctx, info) {
      const ui = getSquareUi(squareNumber, ctx, info);
      return ui.tooltipText;
    },

    getTooltipCssClass() {
      return null;
    },

    onSquareHover(squareNumber, ctx, info) {
      const ui = getSquareUi(squareNumber, ctx, info);
      if (image) {
        image.style.cursor = ui.cursor;
      }
    },

    onClearSelection() {
      if (image) {
        image.style.cursor = "";
      }
    },

    onSquareActivate(squareNumber, event, ctx, info) {
      const ui = getSquareUi(squareNumber, ctx, info);
      if (!ui.destinationHref) return;

      // Check if modal should intercept
      let destination;
      try {
        destination = new URL(ui.destinationHref, window.location.href);
      } catch {
        return;
      }

      // Check if URL is blocked
      if (modal && modal.isUrlBlocked(destination)) {
        return;
      }

      // Check if we should show warning
      if (modal && modal.shouldWarnForUrl(destination)) {
        modal.show(destination, "_blank");
        return;
      }

      // Navigate directly
      window.open(destination.href, "_blank", "noopener");
    },
  });

  const shouldShowPanzoomUi = panzoomEnabled && billboard.panZoom && billboard.panZoom.isActive;
  if (shouldShowPanzoomUi) {
    const parent = container.parentElement;

    const hint = document.createElement("p");
    hint.className = "billboard__mobile-hint";
    hint.textContent = "Pinch to zoom, drag to pan.";
    hint.style.color = hintColor;
    hint.style.marginBottom = "5px";
    if (parent) {
      parent.insertBefore(hint, container);
    } else {
      container.prepend(hint);
    }

    const resetButton = document.createElement("button");
    resetButton.type = "button";
    resetButton.className = "billboard__reset-btn";
    resetButton.textContent = "Reset zoom";
    resetButton.addEventListener("click", () => billboard.reset());
    resetButton.style.color = resetButtonColor;
    resetButton.style.borderColor = resetButtonColor;
    if (parent) {
      parent.appendChild(resetButton);
    } else {
      container.appendChild(resetButton);
    }
  }

  // Load square data
  async function loadData() {
    try {
      const response = await fetch(baseurl + "/build/squarePersonalizations.json");
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      squarePersonalizations = data || [];
      if (onReady) onReady();
    } catch (error) {
      console.error("[EmbedBillboard] Failed to load data:", error);
    }
  }

  loadData();

  // Return controller
  return {
    billboard,
    modal,
    config,

    setData(personalizations) {
      squarePersonalizations = personalizations || [];
    },

    setSquare(squareNumber) {
      billboard.setSquare(squareNumber);
    },

    clearSelection() {
      billboard.clearSelection();
    },

    get currentSquare() {
      return billboard.currentSquare;
    },

    destroy() {
      billboard.destroy();
      if (modal) modal.destroy();
    },
  };
}
