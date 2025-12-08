import { loadSquareData } from "../square-data.js";
import { assetPath } from "../asset-base.js";
import { createPanZoom } from "../pan-zoom.js";

const GRID_DIMENSION = 100;

function describeStatus(personalization, extra) {
  if (!extra) return { label: "unminted", minted: false, personalized: false };
  const hasPersonalization = Boolean(
    (personalization && (personalization[0] || personalization[1])) || (extra && extra[2])
  );
  if (hasPersonalization) {
    return { label: "minted and personalized", minted: true, personalized: true };
  }
  return { label: "minted but not personalized", minted: true, personalized: false };
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

/**
 * Attach a canvas chooser modal to a trigger/input pair.
 * @param {Object} options
 * @param {HTMLElement} options.trigger Element that opens the modal when clicked.
 * @param {HTMLInputElement} [options.input] Element to receive the chosen number.
 * @param {(id: number, ctx: {personalization: any, extra: any}) => boolean} [options.filter] Filter function.
 * @param {(id: number) => void} [options.onSelect] Callback when a square is chosen.
 * @param {string} [options.title] Title text for the modal.
 * @param {boolean} [options.updateInput] Whether to write the selection into the input (default true).
 */
export function attachCanvasChooser({
  trigger,
  input,
  filter = () => true,
  onSelect = () => { },
  title = "Choose square from canvas",
  updateInput = true,
}) {
  if (!trigger) return;

  let backdrop;
  let highlight;
  let tooltip;
  let image;
  let wrapper;
  let imgWrapper;
  let data;
  let currentSquare;
  let panZoom = null;

  function getSquareFromEvent(event) {
    if (!image) return null;
    const rect = image.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    let clientX = event.clientX;
    let clientY = event.clientY;
    if (event.touches && event.touches[0]) {
      clientX = event.touches[0].clientX;
      clientY = event.touches[0].clientY;
    } else if (event.changedTouches && event.changedTouches[0]) {
      clientX = event.changedTouches[0].clientX;
      clientY = event.changedTouches[0].clientY;
    }

    // Convert screen coords to canvas coords if pan-zoom is active
    let x, y;
    let effectiveWidth, effectiveHeight;
    if (panZoom && panZoom.isActive) {
      const canvasCoords = panZoom.screenToCanvas(clientX, clientY);
      x = canvasCoords.x;
      y = canvasCoords.y;
      // Use wrapper dimensions when panning (these are the "canvas" coords)
      effectiveWidth = imgWrapper ? imgWrapper.offsetWidth : rect.width;
      effectiveHeight = imgWrapper ? imgWrapper.offsetHeight : rect.height;
    } else {
      // Desktop: use image's actual rendered dimensions
      x = clientX - rect.left;
      y = clientY - rect.top;
      effectiveWidth = rect.width;
      effectiveHeight = rect.height;
    }

    const cellWidth = effectiveWidth / GRID_DIMENSION;
    const cellHeight = effectiveHeight / GRID_DIMENSION;
    const xIndex = clamp(Math.floor(x / cellWidth), 0, GRID_DIMENSION - 1);
    const yIndex = clamp(Math.floor(y / cellHeight), 0, GRID_DIMENSION - 1);
    return yIndex * GRID_DIMENSION + xIndex + 1;
  }

  function closeModal() {
    if (backdrop) {
      backdrop.classList.remove("is-open");
      document.removeEventListener("keydown", handleKeydown);
      currentSquare = null;
      if (panZoom) {
        panZoom.reset();
      }
    }
  }

  function handleKeydown(event) {
    const key = event.key.toLowerCase();
    if (key === "escape") {
      closeModal();
      return;
    }

    // Arrow key navigation
    const square = currentSquare || 1;
    if (key === "w" || key === "," || key === "arrowup") {
      if (square > GRID_DIMENSION) {
        showSquare(square - GRID_DIMENSION);
        event.preventDefault();
      }
    } else if (key === "a" || key === "arrowleft") {
      if (square % GRID_DIMENSION !== 1) {
        showSquare(square - 1);
        event.preventDefault();
      }
    } else if (key === "s" || key === "o" || key === "arrowdown") {
      if (square <= GRID_DIMENSION * (GRID_DIMENSION - 1)) {
        showSquare(square + GRID_DIMENSION);
        event.preventDefault();
      }
    } else if (key === "d" || key === "e" || key === "arrowright") {
      if (square % GRID_DIMENSION !== 0) {
        showSquare(square + 1);
        event.preventDefault();
      }
    } else if (key === "enter") {
      if (currentSquare && data) {
        const { personalizations, extra } = data;
        const ctx = {
          personalization: personalizations[currentSquare - 1],
          extra: extra[currentSquare - 1],
        };
        const allowed = filter(currentSquare, ctx);
        if (allowed) {
          if (updateInput && input) {
            input.value = currentSquare;
            input.dispatchEvent(new Event("input", { bubbles: true }));
          }
          onSelect(currentSquare);
          closeModal();
        }
      }
    }
  }

  function ensureModal() {
    if (backdrop) return;
    backdrop = document.createElement("div");
    backdrop.className = "su-chooser-backdrop";
    backdrop.addEventListener("click", (event) => {
      if (event.target === backdrop) {
        closeModal();
      }
    });

    const modal = document.createElement("div");
    modal.className = "su-chooser su-chooser--canvas";

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

    const mobileHint = document.createElement("p");
    mobileHint.className = "su-chooser__mobile-hint";
    mobileHint.textContent = "Pinch to zoom, drag to pan.";

    wrapper = document.createElement("div");
    wrapper.className = "su-canvas";

    imgWrapper = document.createElement("div");
    imgWrapper.className = "su-canvas__wrapper";

    image = document.createElement("img");
    image.src = assetPath("wholeSquare.png");
    image.alt = "All Su Squares";
    image.className = "su-canvas__image";

    highlight = document.createElement("div");
    highlight.className = "su-canvas__highlight";

    tooltip = document.createElement("div");
    tooltip.className = "su-canvas__tooltip";

    imgWrapper.appendChild(image);
    imgWrapper.appendChild(highlight);
    imgWrapper.appendChild(tooltip);
    wrapper.appendChild(imgWrapper);

    // Reset zoom button - only shown on touch devices
    const isTouchDevice = "ontouchstart" in window || navigator.maxTouchPoints > 0;
    let resetBtn = null;
    if (isTouchDevice) {
      resetBtn = document.createElement("button");
      resetBtn.type = "button";
      resetBtn.className = "su-canvas__reset-btn";
      resetBtn.textContent = "Reset zoom";
      resetBtn.addEventListener("click", () => {
        if (panZoom) {
          panZoom.reset();
        }
      });
    }

    modal.appendChild(headerRow);
    modal.appendChild(mobileHint);
    modal.appendChild(wrapper);
    if (resetBtn) {
      modal.appendChild(resetBtn);
    }
    backdrop.appendChild(modal);
    document.body.appendChild(backdrop);

    // Initialize pan-zoom on the image wrapper
    panZoom = createPanZoom(imgWrapper);
  }

  function showSquare(squareNumber) {
    if (!image || !highlight || !tooltip) return;
    currentSquare = squareNumber;
    const { personalizations, extra } = data || {};
    const ctx = {
      personalization: personalizations ? personalizations[squareNumber - 1] : null,
      extra: extra ? extra[squareNumber - 1] : null,
    };
    const status = describeStatus(ctx.personalization, ctx.extra);
    const allowed = filter(squareNumber, ctx);

    // Use image's actual rendered dimensions for positioning
    // On desktop, image may be contained smaller than wrapper due to modal height constraints
    const imageRect = image.getBoundingClientRect();
    let effectiveWidth, effectiveHeight;
    if (panZoom && panZoom.isActive) {
      // Mobile: use wrapper dimensions (coordinates are in wrapper space)
      effectiveWidth = imgWrapper ? imgWrapper.offsetWidth : imageRect.width;
      effectiveHeight = imgWrapper ? imgWrapper.offsetHeight : imageRect.height;
    } else {
      // Desktop: use actual rendered image size
      effectiveWidth = imageRect.width;
      effectiveHeight = imageRect.height;
    }
    if (!effectiveWidth || !effectiveHeight) return;
    const cellWidth = effectiveWidth / GRID_DIMENSION;
    const cellHeight = effectiveHeight / GRID_DIMENSION;
    const col = (squareNumber - 1) % GRID_DIMENSION;
    const row = Math.floor((squareNumber - 1) / GRID_DIMENSION);

    // Position highlight
    highlight.style.display = "block";
    highlight.style.width = `${cellWidth}px`;
    highlight.style.height = `${cellHeight}px`;
    highlight.style.left = `${col * cellWidth}px`;
    highlight.style.top = `${row * cellHeight}px`;

    // Position tooltip beside the highlighted square (axis-flipping like index.html)
    // Left half (columns 0-49): tooltip appears to the right
    // Right half (columns 50-99): tooltip appears to the left
    const isLeftHalf = col < GRID_DIMENSION / 2;
    if (isLeftHalf) {
      tooltip.style.left = `${col * cellWidth + cellWidth * 1.5}px`;
      tooltip.style.right = "auto";
    } else {
      tooltip.style.left = "auto";
      tooltip.style.right = `${(GRID_DIMENSION - col - 1) * cellWidth + cellWidth * 1.5}px`;
    }

    // Vertical positioning based on row to prevent edge overflow
    // Top 5000 squares (rows 0-49): tooltip appears below the square
    // Bottom 5000 squares (rows 50-99): tooltip appears above the square
    const isTopHalf = row < GRID_DIMENSION / 2;
    if (isTopHalf) {
      tooltip.style.top = `${(row + 1) * cellHeight}px`;
      tooltip.style.transformOrigin = `${isLeftHalf ? "left" : "right"} top`;
    } else {
      tooltip.style.top = `${row * cellHeight}px`;
      tooltip.style.transformOrigin = `${isLeftHalf ? "left" : "right"} bottom`;
    }

    // Scale tooltip inversely with pan-zoom so it stays readable when zoomed in
    const yTransform = isTopHalf ? "" : "translateY(-100%)";
    if (panZoom && panZoom.isActive && panZoom.scale) {
      tooltip.style.transform = `${yTransform} scale(${1 / panZoom.scale})`;
    } else {
      tooltip.style.transform = yTransform;
    }

    tooltip.style.display = "block";
    tooltip.textContent = `#${squareNumber} — ${status.label}`;
    tooltip.dataset.disabled = allowed ? "false" : "true";
  }

  function handlePointerMove(event) {
    const squareNumber = getSquareFromEvent(event);
    if (!squareNumber) {
      clearHover();
      return;
    }
    showSquare(squareNumber);
  }

  function handleClick(event) {
    // Suppress click if user was panning/zooming
    if (panZoom && panZoom.hasPanned && panZoom.hasPanned()) {
      return;
    }
    const squareNumber = currentSquare || getSquareFromEvent(event);
    if (!squareNumber || !data) return;
    const { personalizations, extra } = data;
    const ctx = {
      personalization: personalizations[squareNumber - 1],
      extra: extra[squareNumber - 1],
    };
    const allowed = filter(squareNumber, ctx);
    if (!allowed) {
      return;
    }
    if (updateInput && input) {
      input.value = squareNumber;
      input.dispatchEvent(new Event("input", { bubbles: true }));
    }
    onSelect(squareNumber);
    closeModal();
  }

  function clearHover() {
    if (highlight) highlight.style.display = "none";
    if (tooltip) tooltip.style.display = "none";
    currentSquare = null;
  }

  async function openModal() {
    try {
      data = await loadSquareData();
      ensureModal();
      clearHover();
      backdrop.classList.add("is-open");
      document.addEventListener("keydown", handleKeydown);
    } catch (error) {
      alert(error.message || "Failed to load squares");
    }
  }

  trigger.addEventListener("click", openModal);

  function attachListeners() {
    if (!image || !wrapper) return;
    image.addEventListener("pointermove", handlePointerMove);
    image.addEventListener("pointerdown", handlePointerMove);
    image.addEventListener("pointerup", handleClick);
    image.addEventListener("click", handleClick);
    image.addEventListener("pointerleave", clearHover);
    image.addEventListener("touchend", handleClick);
    wrapper.addEventListener("pointerleave", clearHover);
    window.addEventListener("resize", () => {
      if (currentSquare) {
        // reposition highlight on resize
        showSquare(currentSquare);
      }
    });
  }

  // Ensure listeners are set up when the modal is first created
  ensureModal();
  attachListeners();

  return { open: openModal, close: closeModal };
}
