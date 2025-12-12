/**
 * Billboard modal chooser wrapper
 * Used by square-lookup for visual square selection
 */

import { loadSquareData } from "../../js/square-data.js";
import { assetPath } from "../../js/asset-base.js";
import { createBillboard } from "../billboard-core.js";
import { createResetButton, createMobileHint } from "../billboard-view.js";
import { isTouchDevice } from "../billboard-utils.js";

const TOOLTIP_PROFILES = {
  lookup: {
    getTooltipContent(squareNumber, _ctx, info) {
      if (!info?.status?.minted) {
        return `Square #${squareNumber} is unminted.`;
      }
      if (info.status.personalized) {
        return `Square #${squareNumber} is minted and personalized.`;
      }
      return `Square #${squareNumber} is minted but not yet personalized.`;
    },
    getTooltipCssClass: () => null, // Bypass blocked CSS class
    shouldShowDisabledTooltip(_squareNumber, _ctx, info) {
      // Disabled style for unminted, regular for minted
      if (!info?.filter) return !info?.status?.minted;
      if (!info.filter.allowed) return true;
      return !info.status?.minted;
    },
  },
  buy: {
    getTooltipContent(squareNumber, _ctx, info) {
      if (!info?.status?.minted) {
        return `Square #${squareNumber} is available to mint.`;
      }
      if (info.status.personalized) {
        return `Square #${squareNumber} is already minted and personalized.`;
      }
      return `Square #${squareNumber} is minted but not personalized.`;
    },
    getTooltipCssClass: () => null, // Bypass blocked CSS class
    shouldShowDisabledTooltip(_squareNumber, _ctx, info) {
      // Disabled style for minted, regular for unminted
      if (!info?.filter) return Boolean(info?.status?.minted);
      if (!info.filter.allowed) return true;
      return Boolean(info.status?.minted);
    },
  },
  plain: {
    getTooltipContent(squareNumber, _ctx, info) {
      // Show category regardless of blocked status
      if (!info?.status?.minted) {
        return `Square #${squareNumber} is unminted.`;
      }
      if (info.status.personalized) {
        return `Square #${squareNumber} is minted and personalized.`;
      }
      return `Square #${squareNumber} is minted but not yet personalized.`;
    },
    getTooltipCssClass: () => null, // Never use blocked CSS class
    shouldShowDisabledTooltip: () => false, // Never show disabled styling
  },
};

function resolveTooltipProfile(mode) {
  if (!mode) return TOOLTIP_PROFILES.lookup;
  if (typeof mode === "string") {
    return TOOLTIP_PROFILES[mode] || TOOLTIP_PROFILES.lookup;
  }
  if (typeof mode === "object") {
    return {
      getTooltipContent:
        typeof mode.getTooltipContent === "function"
          ? mode.getTooltipContent
          : TOOLTIP_PROFILES.lookup.getTooltipContent,
      getTooltipCssClass:
        typeof mode.getTooltipCssClass === "function"
          ? mode.getTooltipCssClass
          : null,
      shouldShowDisabledTooltip:
        typeof mode.shouldShowDisabledTooltip === "function"
          ? mode.shouldShowDisabledTooltip
          : TOOLTIP_PROFILES.lookup.shouldShowDisabledTooltip,
    };
  }
  return TOOLTIP_PROFILES.lookup;
}

/**
 * Attach a billboard chooser modal to a trigger element
 * @param {Object} options
 * @param {HTMLElement} options.trigger - Element that opens the modal when clicked
 * @param {HTMLInputElement} [options.input] - Element to receive the chosen number
 * @param {(id: number, ctx: Object) => boolean} [options.filter] - Filter function
 * @param {(id: number) => void} [options.onSelect] - Callback when a square is chosen
 * @param {string} [options.title="Choose square from billboard"] - Title text for the modal
 * @param {boolean} [options.updateInput=true] - Whether to write selection into input
 * @returns {{ open: () => Promise<void>, close: () => void }}
 */
export function attachBillboardChooser({
  trigger,
  input,
  filter = () => true,
  onSelect = () => {},
  title = "Choose square from billboard",
  updateInput = true,
  tooltipMode = "lookup",
}) {
  if (!trigger) return { open: () => Promise.resolve(), close: () => {} };

  let backdrop = null;
  let billboard = null;
  let data = null;
  let returnFocusElement = null;

  function closeModal() {
    if (backdrop) {
      backdrop.classList.remove("is-open");
      document.removeEventListener("keydown", handleKeydown);
      if (billboard) {
        billboard.reset();
        billboard.clearSelection();
      }
      if (returnFocusElement && typeof returnFocusElement.focus === "function") {
        returnFocusElement.focus();
      }
    }
  }

  function handleKeydown(event) {
    if (event.key === "Escape") {
      closeModal();
    }
  }

  function handleSelect(squareNumber) {
    if (updateInput && input) {
      input.value = squareNumber;
      input.dispatchEvent(new Event("input", { bubbles: true }));
    }
    onSelect(squareNumber);
    closeModal();
  }

  function filterAllowsSelection(squareNumber, ctx) {
    const result = filter(squareNumber, ctx);
    if (result && typeof result === "object") {
      return Boolean(result.allowed);
    }
    return Boolean(result);
  }

  function focusBillboardGrid() {
    const grid = billboard?.elements?.grid;
    if (!grid) return;
    const tabStop =
      grid.querySelector(".billboard__cell[tabindex='0']") ||
      grid.querySelector(".billboard__cell");
    if (tabStop instanceof HTMLElement) {
      tabStop.focus();
    }
  }

  const tooltipProfile = resolveTooltipProfile(tooltipMode);

  function ensureModal() {
    if (backdrop) return;

    // Create backdrop
    backdrop = document.createElement("div");
    backdrop.className = "su-chooser-backdrop";
    backdrop.addEventListener("click", (event) => {
      if (event.target === backdrop) {
        closeModal();
      }
    });

    // Create modal container
    const modal = document.createElement("div");
    modal.className = "su-chooser su-chooser--billboard";

    // Header
    const headerRow = document.createElement("div");
    headerRow.className = "su-chooser__header";

    const heading = document.createElement("h3");
    heading.className = "su-chooser__title";
    heading.textContent = title;

    const closeButton = document.createElement("button");
    closeButton.type = "button";
    closeButton.className = "su-chooser__close";
    closeButton.textContent = "×";
    closeButton.setAttribute("aria-label", "Close chooser");
    closeButton.addEventListener("click", closeModal);

    headerRow.appendChild(heading);
    headerRow.appendChild(closeButton);

    // Mobile hint (uses chooser styling, not billboard)
    const mobileHint = createMobileHint("Pinch to zoom, drag to pan.", "su-chooser__mobile-hint");

    // Billboard container
    const billboardContainer = document.createElement("div");
    billboardContainer.className = "billboard";

    // Create billboard
    billboard = createBillboard(billboardContainer, {
      mode: "interactive",
      enableGrid: true,
      enableKeyboard: true,
      allowBlockedSelection: true,
      imageSrc: assetPath("wholeSquare.png"),
      imageAlt: "All Su Squares",
      gridTestId: "billboard-modal-grid",
      filter: (squareNumber, ctx) => filter(squareNumber, ctx),
      getPersonalization: (squareNumber) => {
        if (!data || !data.personalizations) return null;
        return data.personalizations[squareNumber - 1];
      },
      getExtra: (squareNumber) => {
        if (!data || !data.extra) return null;
        return data.extra[squareNumber - 1];
      },
      getTooltipContent: (squareNumber, ctx, info) =>
        tooltipProfile.getTooltipContent(squareNumber, ctx, info),
      getTooltipCssClass:
        typeof tooltipProfile.getTooltipCssClass === "function"
          ? (squareNumber, ctx, info) =>
              tooltipProfile.getTooltipCssClass(squareNumber, ctx, info)
          : undefined,
      shouldShowDisabledTooltip: (squareNumber, ctx, info) =>
        tooltipProfile.shouldShowDisabledTooltip(squareNumber, ctx, info),
      allowWrapperTooltipOverride: true,
      onSquareActivate: (squareNumber) => {
        const ctx = {
          personalization: data?.personalizations?.[squareNumber - 1],
          extra: data?.extra?.[squareNumber - 1],
        };
        if (filterAllowsSelection(squareNumber, ctx)) {
          handleSelect(squareNumber);
        }
      },
    });

    // Reset button (touch devices only)
    let resetBtn = null;
    if (isTouchDevice()) {
      resetBtn = createResetButton({
        text: "Reset zoom",
        onClick: () => billboard.reset(),
      });
      // Force display since we're in modal context
      resetBtn.style.display = "block";
    }

    // Assemble modal
    modal.appendChild(headerRow);
    modal.appendChild(mobileHint);
    modal.appendChild(billboardContainer);
    if (resetBtn) {
      modal.appendChild(resetBtn);
    }
    backdrop.appendChild(modal);
    document.body.appendChild(backdrop);
  }

  async function openModal() {
    try {
      data = await loadSquareData();
      ensureModal();
      if (billboard) {
        billboard.clearSelection();
      }
      returnFocusElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      backdrop.classList.add("is-open");
      document.addEventListener("keydown", handleKeydown);
      if (!isTouchDevice()) {
        requestAnimationFrame(() => {
          focusBillboardGrid();
        });
      }
    } catch (error) {
      alert(error.message || "Failed to load squares");
    }
  }

  trigger.addEventListener("click", openModal);

  return {
    open: openModal,
    close: closeModal,
  };
}
