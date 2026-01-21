/**
 * Personalize billboard wrapper
 * Owns tooltip copy, overlays, and blocklist visuals for personalize-modern.
 */

import { createBillboard } from "../billboard-core.js";
import {
  describeSquareStatus,
  squareToCoords,
  getQuadrant,
} from "../billboard-utils.js";
import { SquareBlocklist } from "../blocklist/blocklist-squares.js";
import { DomainBlocklist } from "../../blocklist/blocklist-domains.js";
import { loadSquareData } from "../../js/square-data.js";
import { assetPath } from "../../js/asset-base.js";
import { extractScheme, isBlockedScheme } from "../../js/link-utils.js";
import { shouldHideUriLabel } from "./link-label-utils.js";
import { createPersonalizeGlowCanvas } from "../overlays/personalize-glow-canvas.js";
import { scheduleBillboardRuntimeFallback } from "../runtime-fallback.js";

const TEXT_SILENCED_TOOLTIP = (squareNumber) =>
  `Square #${squareNumber} Personalization text hidden for your safety.`;

function getRowPersonalization(row) {
  if (!row) return null;
  const title = row.title || "";
  const uri = row.uri || "";
  if (!title && !uri) return ["", ""];
  return [title, uri];
}

function uniqueErrors(errors) {
  if (!errors) return [];
  const list = Array.isArray(errors) ? errors : [errors];
  return Array.from(new Set(list.filter(Boolean)));
}

export function initPersonalizeBillboard(options) {
  const {
    container,
    baseurl = "",
    onSquareActivate = () => {},
  } = options;

  if (!container) return null;

  const state = {
    mode: "owned",
    previewTooltips: true,
    ownershipStatus: "idle",
    ownedSquares: null,
    selectedSquares: new Set(),
    previewRows: new Map(),
    errorMap: new Map(),
    locatorSquare: null,
  };

  let personalizations = [];
  let extra = [];
  let blockedSquares = new Set();
  let blockedReady = false;
  let dataReady = false;

  const billboard = createBillboard(container, {
    mode: "interactive",
    enableGrid: true,
    enableKeyboard: true,
    enablePanZoom: true,
    enableCoreBlocklists: false,
    allowBlockedSelection: true,
    imageSrc: assetPath("wholeSquare.png"),
    imageAlt: "Su Squares billboard",
    gridClassName: "personalize-billboard__grid",
    cellClassName: "personalize-billboard__cell",
    ariaLabel: "Personalize billboard",
    gridTestId: "personalize-billboard-grid",
    filter: () => true,
    getPersonalization(squareNumber) {
      return personalizations[squareNumber - 1] ?? null;
    },
    getExtra(squareNumber) {
      return extra[squareNumber - 1] ?? null;
    },
    getTooltipContent(squareNumber) {
      return getTooltipContent(squareNumber);
    },
    onSquareActivate(squareNumber, event, ctx, info) {
      onSquareActivate(squareNumber, event, ctx, info);
    },
  });

  const { cells } = billboard.elements;
  const applied = new Map();
  const glowCanvas = createPersonalizeGlowCanvas({
    wrapper: billboard.elements.wrapper,
    pulseTarget: document.querySelector(".personalize-billboard__map"),
  });
  const arrowBasePath = `${baseurl || ""}/assets/images`;
  const locatorArrow = document.createElement("img");
  locatorArrow.className = "personalize-billboard__locator-arrow";
  locatorArrow.alt = "";
  locatorArrow.setAttribute("aria-hidden", "true");
  locatorArrow.hidden = true;
  billboard.elements.wrapper.appendChild(locatorArrow);
  const glowColors = {
    selected: "",
    "owned-unpersonalized": "",
    "owned-personalized": "",
    error: "",
  };
  const staticColors = {
    selected: { bg: "", x: "" },
    "owned-unpersonalized": { bg: "", x: "" },
    "owned-personalized": { bg: "", x: "" },
    error: { bg: "", x: "" },
  };
  let glowEnabled = true;

  function resolveGlowColors() {
    const styles = getComputedStyle(document.documentElement);
    glowColors.selected =
      styles.getPropertyValue("--billboard-glow-selected").trim() || "#4aa3ff";
    glowColors["owned-unpersonalized"] =
      styles.getPropertyValue("--billboard-glow-owned-unpersonalized").trim() ||
      "#ffd700";
    glowColors["owned-personalized"] =
      styles.getPropertyValue("--billboard-glow-owned-personalized").trim() ||
      "#39ff14";
    glowColors.error =
      styles.getPropertyValue("--billboard-glow-error").trim() || "#ff2d2d";

    // Static colors: background is the glow color, X color based on contrast
    staticColors.selected = { bg: glowColors.selected, x: "#000" };
    staticColors["owned-unpersonalized"] = { bg: glowColors["owned-unpersonalized"], x: "#000" };
    staticColors["owned-personalized"] = { bg: glowColors["owned-personalized"], x: "#000" };
    staticColors.error = { bg: glowColors.error, x: "#fff" };
  }

  resolveGlowColors();

  function refreshGlowColors() {
    resolveGlowColors();
    syncOverlays();
  }

  function refreshCurrentTooltip() {
    if (billboard.currentSquare) {
      billboard.setSquare(billboard.currentSquare);
    }
  }

  function updateLocatorPosition() {
    const squareNumber = state.locatorSquare;
    if (!squareNumber) {
      locatorArrow.hidden = true;
      return;
    }

    const { row, col } = squareToCoords(squareNumber);
    const { isLeftHalf, isTopHalf } = getQuadrant(squareNumber);
    const wrapper = billboard.elements.wrapper;
    const actualWidth = wrapper.offsetWidth || wrapper.clientWidth || 0;
    if (!actualWidth) return;

    const scale = actualWidth / 1000;
    const scalePosition = (value) => `${value * scale}px`;
    const arrowSize = 100 * scale;

    locatorArrow.style.width = `${arrowSize}px`;
    locatorArrow.style.height = `${arrowSize}px`;

    let arrowSrc;
    let topPx;
    let leftPx;

    if (isTopHalf) {
      if (isLeftHalf) {
        arrowSrc = "ul";
        topPx = row * 10 + 10;
        leftPx = col * 10 + 10;
      } else {
        arrowSrc = "ur";
        topPx = row * 10 + 10;
        leftPx = col * 10 - 100;
      }
    } else {
      if (isLeftHalf) {
        arrowSrc = "dl";
        topPx = row * 10 - 100;
        leftPx = col * 10 + 10;
      } else {
        arrowSrc = "dr";
        topPx = row * 10 - 100;
        leftPx = col * 10 - 100;
      }
    }

    locatorArrow.src = `${arrowBasePath}/${arrowSrc}.png`;
    locatorArrow.style.top = scalePosition(topPx);
    locatorArrow.style.left = scalePosition(leftPx);
    locatorArrow.hidden = false;
  }

  function isOwned(squareNumber) {
    return Boolean(state.ownedSquares && state.ownedSquares.has(squareNumber));
  }

  function getPersonalizedStatus(squareNumber) {
    if (!dataReady) return false;
    const personalization = personalizations[squareNumber - 1] ?? null;
    const extraRow = extra[squareNumber - 1] ?? null;
    const status = describeSquareStatus(personalization, extraRow);
    return Boolean(status.personalized);
  }

  function getErrorText(squareNumber) {
    const error = state.errorMap.get(squareNumber);
    if (!error) return "";
    if (state.ownershipStatus === "ready" && state.ownedSquares) {
      if (!state.ownedSquares.has(squareNumber)) return "";
    }
    const errors = uniqueErrors(error);
    if (errors.length === 0) return "";
    return errors.join(" ");
  }

  function getOwnedTooltip(squareNumber) {
    if (state.ownershipStatus !== "ready" || !state.ownedSquares) {
      return `Square #${squareNumber}`;
    }

    const errorText = getErrorText(squareNumber);
    if (errorText) {
      return `Square #${squareNumber} ${errorText}`;
    }

    if (state.selectedSquares.has(squareNumber)) {
      return `Square #${squareNumber} is selected.`;
    }

    if (!state.ownedSquares.has(squareNumber)) {
      return `Square #${squareNumber} is not owned.`;
    }

    const personalized = getPersonalizedStatus(squareNumber);
    if (personalized) {
      return `Square #${squareNumber} is owned and personalized.`;
    }

    return `Square #${squareNumber} is owned but not personalized.`;
  }

  function getIndexTooltip(squareNumber, personalization, options = {}) {
    const { ignoreSquareBlock = false } = options;
    const pLabel = Array.isArray(personalization) ? personalization[0] : null;
    const pHrefRaw = Array.isArray(personalization) ? personalization[1] : null;
    const mintedEmpty = !pLabel && !pHrefRaw;

    const isSquareBlocked =
      !ignoreSquareBlock && SquareBlocklist.isSquareBlocked(squareNumber);
    const isTextSilenced =
      !ignoreSquareBlock && SquareBlocklist.isSquareTextSilenced(squareNumber);

    if (isTextSilenced) {
      return TEXT_SILENCED_TOOLTIP(squareNumber);
    }

    const hrefRawString = typeof pHrefRaw === "string" ? pHrefRaw.trim() : "";
    const scheme = hrefRawString ? extractScheme(hrefRawString) : null;
    const isBlockedUriScheme = Boolean(scheme && isBlockedScheme(scheme));
    const isDomainBlocked = hrefRawString
      ? DomainBlocklist.isDomainBlockedByHref(hrefRawString)
      : false;

    if (isSquareBlocked || isDomainBlocked) {
      return `Square #${squareNumber} For your protection, this square is disabled.`;
    }

    if (!personalization) {
      return `Square #${squareNumber} is available for sale, click to buy.`;
    }

    if (mintedEmpty) {
      return `Square #${squareNumber} WAS PURCHASED BUT NOT YET PERSONALIZED`;
    }

    if (isBlockedUriScheme) {
      return `Square #${squareNumber} Link blocked for your protection`;
    }

    const hideUriLabel = shouldHideUriLabel(pLabel, hrefRawString, baseurl);
    if (hideUriLabel) {
      return `Square #${squareNumber} Personalized link available`;
    }

    return pLabel ? `Square #${squareNumber} ${pLabel}` : `Square #${squareNumber}`;
  }

  function getPreviewTooltip(squareNumber) {
    const previewRow = state.previewRows.get(squareNumber) || null;
    const previewPersonalization = getRowPersonalization(previewRow);
    const shouldUsePreview = Boolean(previewRow);
    const personalization = shouldUsePreview
      ? previewPersonalization
      : personalizations[squareNumber - 1] ?? null;

    const errorText = getErrorText(squareNumber);
    if (errorText) {
      return `Square #${squareNumber} ${errorText}`;
    }

    const ignoreSquareBlock = shouldUsePreview;
    return getIndexTooltip(squareNumber, personalization, { ignoreSquareBlock });
  }

  function getTooltipContent(squareNumber) {
    if (state.mode === "preview") {
      return state.previewTooltips
        ? getPreviewTooltip(squareNumber)
        : getOwnedTooltip(squareNumber);
    }
    return getOwnedTooltip(squareNumber);
  }

  function applyBlockedSquares() {
    if (!blockedReady) return;
    blockedSquares.forEach((squareNumber) => {
      const cell = cells[squareNumber - 1];
      if (!cell) return;
      cell.dataset.blocked = "true";
    });
  }

  function clearSquareVisual(squareNumber) {
    const cell = cells[squareNumber - 1];
    if (!cell) return;
    delete cell.dataset.glow;
    delete cell.dataset.preview;
    cell.style.removeProperty("--preview-image");
    cell.style.removeProperty("--glow-color");
  }

  function applySquareVisual(squareNumber, config) {
    const cell = cells[squareNumber - 1];
    if (!cell) return;
    if (config.previewUrl) {
      cell.dataset.preview = "true";
      cell.style.setProperty("--preview-image", `url("${config.previewUrl}")`);
    } else {
      delete cell.dataset.preview;
      cell.style.removeProperty("--preview-image");
    }
    delete cell.dataset.glow;
    cell.style.removeProperty("--glow-color");
  }

  function syncOverlays() {
    const next = new Map();
    const highlights = [];
    const staticHighlightsList = [];
    const selected = state.selectedSquares || new Set();
    const ownedReady = state.ownershipStatus === "ready" && state.ownedSquares;

    state.errorMap.forEach((_error, squareNumber) => {
      if (ownedReady && !isOwned(squareNumber)) {
        return;
      }
      next.set(squareNumber, { glow: "error" });
    });

    if (state.mode === "preview") {
      state.previewRows.forEach((row, squareNumber) => {
        const entry = next.get(squareNumber) || {};
        if (row && row.imagePreviewUrl) {
          entry.previewUrl = row.imagePreviewUrl;
        }
        if (entry.previewUrl || entry.glow) {
          next.set(squareNumber, entry);
        }
      });
    } else {
      selected.forEach((squareNumber) => {
        if (!next.has(squareNumber)) {
          next.set(squareNumber, { glow: "selected" });
        }
      });

      if (ownedReady && state.ownedSquares) {
        state.ownedSquares.forEach((squareNumber) => {
          if (next.has(squareNumber)) return;
          const personalized = getPersonalizedStatus(squareNumber);
          next.set(squareNumber, {
            glow: personalized ? "owned-personalized" : "owned-unpersonalized",
          });
        });
      }
    }

    applied.forEach((_value, squareNumber) => {
      if (!next.has(squareNumber)) {
        clearSquareVisual(squareNumber);
        applied.delete(squareNumber);
      }
    });

    // Count highlights to report back
    let highlightCount = 0;
    next.forEach((config) => {
      if (config.glow) highlightCount++;
    });

    next.forEach((config, squareNumber) => {
      applySquareVisual(squareNumber, config);
      applied.set(squareNumber, config);
      if (config.glow) {
        if (glowEnabled) {
          const color = glowColors[config.glow] || "#fff";
          highlights.push({ squareNumber, color });
        } else {
          const colors = staticColors[config.glow];
          if (colors) {
            staticHighlightsList.push({
              squareNumber,
              bgColor: colors.bg,
              xColor: colors.x,
            });
          }
        }
      }
    });

    if (glowCanvas) {
      if (glowEnabled) {
        glowCanvas.setHighlights(highlights);
      } else {
        glowCanvas.setStaticHighlights(staticHighlightsList);
      }
    }

    return { highlightCount };
  }

  function setState(nextState) {
    if (!nextState || typeof nextState !== "object") return;
    Object.assign(state, nextState);
    const result = syncOverlays();
    refreshCurrentTooltip();
    updateLocatorPosition();
    return result;
  }

  function setGlowEnabled(enabled) {
    const wasEnabled = glowEnabled;
    glowEnabled = Boolean(enabled);
    if (wasEnabled !== glowEnabled) {
      syncOverlays();
    }
  }

  function isGlowEnabled() {
    return glowEnabled;
  }

  function applySquareData(data) {
    personalizations = data.personalizations || [];
    extra = data.extra || [];
    dataReady = true;
    syncOverlays();
    refreshCurrentTooltip();
  }

  loadSquareData()
    .then((data) => {
      applySquareData(data);
    })
    .catch((error) => {
      console.error("[PersonalizeBillboard] Failed to load square data:", error);
    });

  const stopRuntimeFallback = scheduleBillboardRuntimeFallback({
    onChange: () => {
      if (billboard?.elements?.image) {
        billboard.elements.image.src = assetPath("wholeSquare.png");
      }
    },
  });

  SquareBlocklist.loadOnce()
    .then(() => {
      blockedSquares = SquareBlocklist.getBlockedSquares();
      blockedReady = true;
      applyBlockedSquares();
    })
    .catch(() => {});

  DomainBlocklist.loadOnce().catch(() => {});

  const handleResize = () => updateLocatorPosition();
  window.addEventListener("resize", handleResize);

  return {
    billboard,
    setState,
    setGlowEnabled,
    isGlowEnabled,
    refreshGlowColors,
    destroy() {
      if (glowCanvas) {
        glowCanvas.destroy();
      }
      stopRuntimeFallback();
      window.removeEventListener("resize", handleResize);
      billboard.destroy();
    },
  };
}
