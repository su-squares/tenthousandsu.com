import { loadSquareData } from "../square-data.js";
import { assetPath } from "../asset-base.js";

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
  onSelect = () => {},
  title = "Choose square from canvas",
  updateInput = true,
}) {
  if (!trigger) return;

  let backdrop;
  let highlight;
  let tooltip;
  let image;
  let wrapper;
  let data;
  let currentSquare;
  let suppressTooltip = false;

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
    const cellWidth = rect.width / GRID_DIMENSION;
    const cellHeight = rect.height / GRID_DIMENSION;
    const xIndex = clamp(Math.floor((clientX - rect.left) / cellWidth), 0, GRID_DIMENSION - 1);
    const yIndex = clamp(Math.floor((clientY - rect.top) / cellHeight), 0, GRID_DIMENSION - 1);
    return yIndex * GRID_DIMENSION + xIndex + 1;
  }

  function closeModal() {
    if (backdrop) {
      backdrop.classList.remove("is-open");
      document.removeEventListener("keydown", handleEscape);
      currentSquare = null;
    }
  }

  function handleEscape(event) {
    if (event.key === "Escape") {
      closeModal();
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
    mobileHint.textContent = "On mobile, zoom in and scroll.";

    wrapper = document.createElement("div");
    wrapper.className = "su-canvas";

    const imgWrapper = document.createElement("div");
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

    modal.appendChild(headerRow);
    modal.appendChild(mobileHint);
    modal.appendChild(wrapper);
    backdrop.appendChild(modal);
    document.body.appendChild(backdrop);
  }

  function positionTooltip(event) {
    if (!tooltip || !wrapper) return;
    const rect = wrapper.getBoundingClientRect();
    const x = clamp(event.clientX - rect.left, 0, rect.width);
    const y = clamp(event.clientY - rect.top, 0, rect.height);
    tooltip.style.left = `${x}px`;
    tooltip.style.top = `${y}px`;
  }

  function showSquare(squareNumber) {
    if (!image || !highlight || !tooltip) return;
    if (suppressTooltip) {
      currentSquare = squareNumber;
      return;
    }
    currentSquare = squareNumber;
    const { personalizations, extra } = data || {};
    const ctx = {
      personalization: personalizations ? personalizations[squareNumber - 1] : null,
      extra: extra ? extra[squareNumber - 1] : null,
    };
    const status = describeStatus(ctx.personalization, ctx.extra);
    const allowed = filter(squareNumber, ctx);

    const rect = image.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const cellWidth = rect.width / GRID_DIMENSION;
    const cellHeight = rect.height / GRID_DIMENSION;
    const col = (squareNumber - 1) % GRID_DIMENSION;
    const row = Math.floor((squareNumber - 1) / GRID_DIMENSION);

    highlight.style.display = "block";
    highlight.style.width = `${cellWidth}px`;
    highlight.style.height = `${cellHeight}px`;
    highlight.style.left = `${col * cellWidth}px`;
    highlight.style.top = `${row * cellHeight}px`;

    tooltip.style.display = "block";
    tooltip.textContent = `#${squareNumber} — ${status.label}`;
    tooltip.dataset.disabled = allowed ? "false" : "true";
  }

  function handlePointerMove(event) {
    suppressTooltip = event.pointerType === "touch";
    const squareNumber = getSquareFromEvent(event);
    if (!squareNumber) {
      clearHover();
      return;
    }
    showSquare(squareNumber);
    if (!suppressTooltip) {
      positionTooltip(event);
    }
  }

  function handleClick(event) {
    suppressTooltip = false;
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
      suppressTooltip = false;
      clearHover();
      backdrop.classList.add("is-open");
      document.addEventListener("keydown", handleEscape);
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
