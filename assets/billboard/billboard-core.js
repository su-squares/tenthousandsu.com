/**
 * Billboard core - orchestrator + rendering + public API
 * Split into:
 * - billboard-core.js (this file): DOM creation/mounting, rendering, API
 * - billboard-core-events.js: event listeners + nav behavior
 * - billboard-core-blocklists.js: core blocklists load/check/apply
 */

import { createPanZoom } from "../js/pan-zoom.js";
import {
  TOTAL_SQUARES,
  getCellSize,
  describeSquareStatus,
  isTouchDevice,
  GRID_DIMENSION,
} from "./billboard-utils.js";
import {
  createGrid,
  createHighlight,
  createTooltip,
  updateGridSelection,
  clearGridSelection,
  showSquare,
  hideSquare,
} from "./billboard-view.js";
import { createSquareOverrideManager } from "./square-override.js";
import { attachBillboardEvents } from "./billboard-core-events.js";
import {
  coreBlocklistsReady,
  loadCoreBlocklistsOnce,
  applyCoreSquareBlocklistOverrides,
  isCoreSquareBlocked,
  isCoreHrefBlocked,
  isCoreSquareTextHidden,
} from "./billboard-core-blocklists.js";

/**
 * Extract first token from class string.
 * @param {string} className
 * @returns {string}
 */
function primaryClass(className) {
  if (!className || typeof className !== "string") return "";
  return className.trim().split(/\s+/)[0] || "";
}

const TEXT_SILENCED_TOOLTIP = (squareNumber) =>
  `Square #${squareNumber} — Personalization text hidden for your safety.`;

function normalizeFilterResult(result) {
  if (result && typeof result === "object") {
    const allowed = Boolean(result.allowed);
    const showDisabledTooltip =
      result.showDisabledTooltip !== undefined
        ? Boolean(result.showDisabledTooltip)
        : !allowed;
    const reason = typeof result.reason === "string" ? result.reason : null;
    return { allowed, showDisabledTooltip, reason };
  }

  if (typeof result === "boolean") {
    return { allowed: result, showDisabledTooltip: !result, reason: null };
  }

  const coerced = Boolean(result);
  return { allowed: coerced, showDisabledTooltip: !coerced, reason: null };
}

/**
 * Default href resolver (best-effort) for domain-block checks.
 * Supports:
 * - personalization as [label, href]
 * - personalization as { href }
 * @param {number} _squareNumber
 * @param {Object} ctx
 * @returns {string|null}
 */
function defaultGetHref(_squareNumber, ctx) {
  const p = ctx?.personalization;
  if (!p) return null;

  if (Array.isArray(p)) {
    const href = p[1];
    return typeof href === "string" && href.trim() ? href.trim() : null;
  }

  if (typeof p === "object" && p) {
    const href = p.href;
    return typeof href === "string" && href.trim() ? href.trim() : null;
  }

  return null;
}

/**
 * Create an interactive billboard component
 * @param {HTMLElement} container
 * @param {Object} options
 * @returns {Object} Billboard controller
 */
export function createBillboard(container, options = {}) {
  const {
    mode = "interactive",
    enableGrid = mode === "interactive",
    enableKeyboard = mode === "interactive",
    enablePanZoom = isTouchDevice(),
    enableCoreBlocklists = true,
    allowBlockedSelection = false,

    onSquareHover,
    onSquareSelect,
    onSquareActivate,
    onClearSelection,

    filter = () => true,
    getPersonalization = () => null,
    getExtra = () => null,
    getHref = defaultGetHref,
    isTextHidden,

    getTooltipContent,
    getTooltipCssClass,
    shouldShowDisabledTooltip,
    allowWrapperTooltipOverride = false,
    missingLinkTooltipSuffix = null,
    missingTextTooltipSuffix = null,
    missingLinkFilterReason = "invalid-href",

    imageSrc,
    imageAlt = "All Su Squares",

    gridTestId,
    classPrefix = "billboard",
    gridClassName,
    cellClassName,
    ariaLabel = "Billboard squares",
    blockedTooltipCssClass = "billboard__tooltip--blocked",

    mount = null,
  } = options;

  const mountObj = mount && typeof mount === "object" ? mount : {};
  const wrapperProvided = Boolean(mountObj.wrapper);
  const missingLinkSuffixResolver =
    typeof missingLinkTooltipSuffix === "function"
      ? missingLinkTooltipSuffix
      : missingLinkTooltipSuffix
      ? () => missingLinkTooltipSuffix
      : null;
  const missingTextSuffixResolver =
    typeof missingTextTooltipSuffix === "function"
      ? missingTextTooltipSuffix
      : missingTextTooltipSuffix
      ? () => missingTextTooltipSuffix
      : null;

  function appendTooltipSuffix(base, suffix) {
    if (!suffix) return base;
    const suffixStr = String(suffix);
    if (!suffixStr) return base;
    const needsSpace = base && !/\s$/.test(base) && !/^\s/.test(suffixStr);
    return `${base}${needsSpace ? " " : ""}${suffixStr}`;
  }

  // State
  let currentSquare = null;
  const gridState = {
    activeCell: null,
    tabStopCell: null,
  };

  // Wrapper
  const wrapper = mountObj.wrapper || document.createElement("div");
  if (!wrapperProvided) {
    wrapper.className = `${classPrefix}__wrapper`;
  }

  // Image
  let image = mountObj.image || null;
  if (!image) {
    if (!imageSrc) {
      throw new Error("[BillboardCore] imageSrc is required when not mounting an existing image element.");
    }
    image = document.createElement("img");
    image.className = `${classPrefix}__image`;
    image.src = imageSrc;
    image.alt = imageAlt;
    wrapper.appendChild(image);
  } else {
    if (!wrapper.contains(image)) {
      wrapper.appendChild(image);
    }
  }

  // Grid
  const effectiveGridClassName = gridClassName || `${classPrefix}__grid`;
  const effectiveCellClassName = cellClassName || `${classPrefix}__cell`;

  const cellClosestClass = primaryClass(effectiveCellClassName);
  const cellClosestSelector = cellClosestClass ? `.${cellClosestClass}` : null;

  let grid = null;
  let cells = [];
  let overrideManager = null;

  if (enableGrid) {
    if (mountObj.grid && Array.isArray(mountObj.cells) && mountObj.cells.length) {
      grid = mountObj.grid;
      cells = mountObj.cells;
    } else {
      const gridResult = createGrid({
        gridClassName: effectiveGridClassName,
        cellClassName: effectiveCellClassName,
        ariaLabel,
        testId: gridTestId,
      });
      grid = gridResult.grid;
      cells = gridResult.cells;
      wrapper.appendChild(grid);
    }

    gridState.tabStopCell = cells[0] || null;
    overrideManager = createSquareOverrideManager(cells);
  }

  // Highlight + Tooltip
  const highlightProvided = Boolean(mountObj.highlight);
  const tooltipProvided = Boolean(mountObj.tooltip);

  const highlight = mountObj.highlight || createHighlight(`${classPrefix}__highlight`);
  const tooltip = mountObj.tooltip || createTooltip(`${classPrefix}__tooltip`);

  if (!highlightProvided && highlight && !wrapper.contains(highlight)) {
    wrapper.appendChild(highlight);
  }
  if (!tooltipProvided && tooltip && !wrapper.contains(tooltip)) {
    wrapper.appendChild(tooltip);
  }

  // Pan-zoom
  let panZoom = null;
  if (enablePanZoom) {
    panZoom = createPanZoom(wrapper);
  }

  // Mount wrapper if we created it
  if (!wrapperProvided) {
    container.appendChild(wrapper);
  }

  // Start loading blocklists immediately
  if (enableCoreBlocklists) {
    loadCoreBlocklistsOnce();
  }

  // Apply core square block overlays once we have an override manager
  if (enableCoreBlocklists && overrideManager) {
    applyCoreSquareBlocklistOverrides(overrideManager, {
      style: { background: "#000" },
      tooltipCssClass: blockedTooltipCssClass,
      tooltipText: (n) => `Square #${n} — For your protection, this square is disabled`,
    }).then(() => {
      if (currentSquare) setSquare(currentSquare);
    });
  }

  function getEffectiveWidth() {
    if (panZoom && panZoom.isActive) {
      return wrapper.offsetWidth || wrapper.clientWidth;
    }
    const rect = image.getBoundingClientRect();
    return rect.width || wrapper.offsetWidth || wrapper.clientWidth;
  }

  function getSquareContext(squareNumber) {
    const personalization = getPersonalization(squareNumber);
    const extra = getExtra(squareNumber);
    return { personalization, extra };
  }

  function resolveHref(squareNumber, ctx) {
    try {
      const href = getHref(squareNumber, ctx);
      return typeof href === "string" && href.trim() ? href.trim() : null;
    } catch {
      return null;
    }
  }

  function computeCoreBlockInfo(squareNumber, ctx) {
    const href = resolveHref(squareNumber, ctx);
    const isSquareBlocked = enableCoreBlocklists ? isCoreSquareBlocked(squareNumber) : false;
    const isDomainBlocked =
      enableCoreBlocklists && href ? isCoreHrefBlocked(href) : false;
    const isTextSilencedCore = enableCoreBlocklists
      ? isCoreSquareTextHidden(squareNumber)
      : false;
    const isTextSilencedWrapper =
      typeof isTextHidden === "function" ? Boolean(isTextHidden(squareNumber, ctx)) : false;

    return {
      href,
      isSquareBlocked,
      isDomainBlocked,
      isTextSilenced: isTextSilencedCore || isTextSilencedWrapper,
    };
  }

  function setSquare(squareNumber) {
    if (!squareNumber || squareNumber < 1 || squareNumber > TOTAL_SQUARES) return;

    currentSquare = squareNumber;

    const ctx = getSquareContext(squareNumber);
    const personalization = ctx.personalization;
    const hasPersonalizationArray = Array.isArray(personalization);
    const personalizationLabel = hasPersonalizationArray ? personalization[0] : null;
    const personalizationHref = hasPersonalizationArray ? personalization[1] : null;
    const isMintedEmpty =
      hasPersonalizationArray && !personalizationLabel && !personalizationHref;
    const status = describeSquareStatus(ctx.personalization, ctx.extra);
    const coreInfo = computeCoreBlockInfo(squareNumber, ctx);

    const filterResult = normalizeFilterResult(
      typeof filter === "function" ? filter(squareNumber, ctx) : true
    );
    const filterAllowed = filterResult.allowed;

    const override = overrideManager ? overrideManager.get(squareNumber) : null;
    const overrideClickable = override ? override.clickable !== false : true;

    const preventedByCore = coreInfo.isSquareBlocked || coreInfo.isDomainBlocked;
    const preventedByOverride = !overrideClickable;
    const preventedByFilter = !filterAllowed;

    const allowed =
      filterAllowed &&
      overrideClickable &&
      !coreInfo.isSquareBlocked &&
      !coreInfo.isDomainBlocked;

    let shouldShowDisabled =
      preventedByCore ||
      preventedByOverride ||
      coreInfo.isTextSilenced ||
      (preventedByFilter && filterResult.showDisabledTooltip);

    const info = {
      status,
      allowed,
      override,
      filter: filterResult,
      ...coreInfo,
    };

    let tooltipContent = `#${squareNumber} — ${status.label}`;
    let tooltipCssClass = null;

    // When allowWrapperTooltipOverride is true, wrapper's getTooltipContent takes priority
    // but we sanitize ctx for blocked/silenced squares to avoid exposing unsafe content
    if (allowWrapperTooltipOverride && typeof getTooltipContent === "function") {
      const needsSanitization =
        coreInfo.isSquareBlocked || coreInfo.isDomainBlocked || coreInfo.isTextSilenced;
      const safeCtx = needsSanitization ? { ...ctx, personalization: null } : ctx;
      try {
        tooltipContent = getTooltipContent(squareNumber, safeCtx, info);
      } catch {
        // fallback to default priority chain below
        if (coreInfo.isTextSilenced) {
          tooltipContent = TEXT_SILENCED_TOOLTIP(squareNumber);
        } else if (override && override.tooltip && override.tooltip.text) {
          tooltipContent = override.tooltip.text;
        }
      }
    } else if (coreInfo.isTextSilenced) {
      tooltipContent = TEXT_SILENCED_TOOLTIP(squareNumber);
    } else if (override && override.tooltip && override.tooltip.text) {
      tooltipContent = override.tooltip.text;
    } else if (typeof getTooltipContent === "function") {
      try {
        tooltipContent = getTooltipContent(squareNumber, ctx, info);
      } catch {
        // ignore
      }
    }

    // When allowWrapperTooltipOverride is true, wrapper's getTooltipCssClass takes priority
    if (allowWrapperTooltipOverride && typeof getTooltipCssClass === "function") {
      try {
        tooltipCssClass = getTooltipCssClass(squareNumber, ctx, info);
      } catch {
        // fallback to default priority chain below
        if (override && override.tooltip && override.tooltip.cssClass) {
          tooltipCssClass = override.tooltip.cssClass;
        } else if (coreInfo.isDomainBlocked) {
          tooltipCssClass = blockedTooltipCssClass;
        }
      }
    } else if (override && override.tooltip && override.tooltip.cssClass) {
      tooltipCssClass = override.tooltip.cssClass;
    } else {
      if (typeof getTooltipCssClass === "function") {
        try {
          tooltipCssClass = getTooltipCssClass(squareNumber, ctx, info);
        } catch {
          // ignore
        }
      } else if (coreInfo.isDomainBlocked) {
        tooltipCssClass = blockedTooltipCssClass;
      }
    }

    let missingLinkSuffixApplied = false;

    if (
      missingTextSuffixResolver &&
      hasPersonalizationArray &&
      !isMintedEmpty &&
      !personalizationLabel
    ) {
      const suffix = missingTextSuffixResolver(squareNumber, ctx, info);
      if (suffix) {
        tooltipContent = appendTooltipSuffix(tooltipContent, suffix);
      }
    }

    if (
      missingLinkSuffixResolver &&
      filterResult.reason === missingLinkFilterReason &&
      !isMintedEmpty
    ) {
      const suffix = missingLinkSuffixResolver(squareNumber, ctx, info);
      if (suffix) {
        tooltipContent = appendTooltipSuffix(tooltipContent, suffix);
        missingLinkSuffixApplied = true;
      }
    }

    if (typeof shouldShowDisabledTooltip === "function") {
      try {
        const disabledOverride = shouldShowDisabledTooltip(squareNumber, ctx, info);
        if (typeof disabledOverride === "boolean") {
          shouldShowDisabled = disabledOverride;
        }
      } catch {
        // ignore
      }
    }

    if (missingLinkSuffixApplied) {
      shouldShowDisabled = false;
    }

    const effectiveWidth = getEffectiveWidth();
    const cellSize = getCellSize(effectiveWidth);
    const scale = panZoom && panZoom.isActive ? panZoom.scale : 1;

    showSquare({ highlight, tooltip }, squareNumber, {
      cellSize,
      scale,
      tooltipContent,
      tooltipCssClass,
      disabled: shouldShowDisabled,
    });

    if (enableGrid) {
      updateGridSelection(cells, squareNumber, gridState);
    }

    if (typeof onSquareHover === "function") {
      onSquareHover(squareNumber, ctx, info);
    }
  }

  function clearSelection() {
    currentSquare = null;
    hideSquare({ highlight, tooltip });

    if (enableGrid) {
      clearGridSelection(gridState);
    }

    if (typeof onClearSelection === "function") {
      onClearSelection();
    }
  }

  function activateSquare(squareNumber, event) {
    if (!squareNumber) return false;

    const ctx = getSquareContext(squareNumber);
    const coreInfo = computeCoreBlockInfo(squareNumber, ctx);

    const filterResult = normalizeFilterResult(
      typeof filter === "function" ? filter(squareNumber, ctx) : true
    );
    const filterAllowed = filterResult.allowed;

    const override = overrideManager ? overrideManager.get(squareNumber) : null;
    const overrideClickable = override ? override.clickable !== false : true;

    const allowed =
      filterAllowed &&
      overrideClickable &&
      !coreInfo.isSquareBlocked &&
      !coreInfo.isDomainBlocked;

    const preventedByCore = coreInfo.isSquareBlocked || coreInfo.isDomainBlocked;
    const preventedByOverride = !overrideClickable;

    const allowCoreBypass =
      allowBlockedSelection &&
      preventedByCore &&
      filterAllowed;

    const activationAllowed = allowed || allowCoreBypass;

    if (!activationAllowed) {
      if (override && typeof override.onActivate === "function") {
        override.onActivate(squareNumber, event);
      }
      return false;
    }

    const status = describeSquareStatus(ctx.personalization, ctx.extra);
    const info = {
      status,
      allowed,
      override,
      filter: filterResult,
      ...coreInfo,
    };

    if (typeof onSquareSelect === "function") {
      onSquareSelect(squareNumber, ctx, info);
    }
    if (typeof onSquareActivate === "function") {
      onSquareActivate(squareNumber, event, ctx, info);
    }

    return true;
  }

  const events = attachBillboardEvents({
    enableGrid,
    enableKeyboard,
    elements: { wrapper, image, grid, cells },
    panZoom,
    cellClosestSelector,
    gridState,
    getCurrentSquare: () => currentSquare,
    setSquare,
    clearSelection,
    activateSquare,
  });

  function reset() {
    if (panZoom) panZoom.reset();
  }

  function destroy() {
    events.destroy();
    if (panZoom) panZoom.destroy();
  }

  return {
    get currentSquare() {
      return currentSquare;
    },
    setSquare,
    clearSelection,
    reset,
    destroy,
    activateSquare,
    elements: {
      wrapper,
      image,
      grid,
      cells,
      highlight,
      tooltip,
    },
    panZoom,
    gridState,
    overrideManager,
  };
}

// Re-export utilities for convenience (you can stop using these in wrappers if you want strict ownership imports)
export { createResetButton, createMobileHint } from "./billboard-view.js";
export { isTouchDevice, GRID_DIMENSION, TOTAL_SQUARES } from "./billboard-utils.js";

// Re-export core blocklist hooks (optional external use)
export {
  loadCoreBlocklistsOnce,
  coreBlocklistsReady,
  isCoreSquareBlocked,
  isCoreHrefBlocked,
  isCoreSquareTextHidden,
  applyCoreSquareBlocklistOverrides,
} from "./billboard-core-blocklists.js";
