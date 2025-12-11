/**
 * Billboard modal chooser wrapper
 * Used by square-lookup for visual square selection
 */

import { loadSquareData } from "../../js/square-data.js";
import { assetPath } from "../../js/asset-base.js";
import { createBillboard, createResetButton, createMobileHint, isTouchDevice } from "../billboard-core.js";

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

  function focusBillboardGrid() {
    const grid = billboard?.elements?.grid;
    if (!grid) return;
    const tabStop =
      grid.querySelector(".su-billboard__cell[tabindex='0']") ||
      grid.querySelector(".su-billboard__cell");
    if (tabStop instanceof HTMLElement) {
      tabStop.focus();
    }
  }

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
    billboardContainer.className = "su-billboard";

    // Create billboard
    billboard = createBillboard(billboardContainer, {
      mode: "interactive",
      enableGrid: true,
      enableKeyboard: true,
      imageSrc: assetPath("wholeSquare.png"),
      imageAlt: "All Su Squares",
      gridTestId: "billboard-modal-grid",
      classPrefix: "su-billboard",
      filter: (squareNumber, ctx) => filter(squareNumber, ctx),
      getPersonalization: (squareNumber) => {
        if (!data || !data.personalizations) return null;
        return data.personalizations[squareNumber - 1];
      },
      getExtra: (squareNumber) => {
        if (!data || !data.extra) return null;
        return data.extra[squareNumber - 1];
      },
      onSquareActivate: (squareNumber) => {
        const ctx = {
          personalization: data?.personalizations?.[squareNumber - 1],
          extra: data?.extra?.[squareNumber - 1],
        };
        if (filter(squareNumber, ctx)) {
          handleSelect(squareNumber);
        }
      },
    });

    // Reset button (touch devices only)
    let resetBtn = null;
    if (isTouchDevice()) {
      resetBtn = createResetButton({
        className: "su-billboard__reset-btn",
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
