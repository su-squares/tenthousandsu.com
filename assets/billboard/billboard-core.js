/**
 * Billboard core - state management and event handling
 */

import { createPanZoom } from "../js/pan-zoom.js";
import {
  GRID_DIMENSION,
  TOTAL_SQUARES,
  getCellSize,
  getSquareFromPosition,
  describeSquareStatus,
  isTouchDevice,
} from "./billboard-utils.js";
import {
  createGrid,
  createHighlight,
  createTooltip,
  updateGridSelection,
  clearGridSelection,
  getSquareFromCell,
  showSquare,
  hideSquare,
} from "./billboard-view.js";

/**
 * Create an interactive billboard component
 * @param {HTMLElement} container - Container element to append billboard to
 * @param {Object} options
 * @param {"interactive"|"location-only"} [options.mode="interactive"]
 * @param {boolean} [options.enableGrid=true] - Create 10k cell grid overlay
 * @param {boolean} [options.enableKeyboard=true] - Enable keyboard navigation
 * @param {boolean} [options.enablePanZoom=true] - Enable touch pan-zoom
 * @param {(squareNumber: number) => void} [options.onSquareHover]
 * @param {(squareNumber: number) => void} [options.onSquareSelect]
 * @param {(squareNumber: number, event: Event) => void} [options.onSquareActivate]
 * @param {(squareNumber: number, ctx: Object) => boolean} [options.filter]
 * @param {(squareNumber: number) => any} [options.getPersonalization]
 * @param {(squareNumber: number) => any} [options.getExtra]
 * @param {string} options.imageSrc
 * @param {string} [options.imageAlt="All Su Squares"]
 * @param {string} [options.gridTestId]
 * @param {string} [options.classPrefix="billboard"]
 * @returns {Object} Billboard controller
 */
export function createBillboard(container, options = {}) {
  const {
    mode = "interactive",
    enableGrid = mode === "interactive",
    enableKeyboard = mode === "interactive",
    enablePanZoom = isTouchDevice(),
    onSquareHover,
    onSquareSelect,
    onSquareActivate,
    filter = () => true,
    getPersonalization = () => null,
    getExtra = () => null,
    imageSrc,
    imageAlt = "All Su Squares",
    gridTestId,
    classPrefix = "billboard",
  } = options;

  // State
  let currentSquare = null;
  const gridState = {
    activeCell: null,
    tabStopCell: null,
  };

  // Create wrapper
  const wrapper = document.createElement("div");
  wrapper.className = `${classPrefix}__wrapper`;

  // Create image
  const image = document.createElement("img");
  image.className = `${classPrefix}__image`;
  image.src = imageSrc;
  image.alt = imageAlt;
  wrapper.appendChild(image);

  // Create grid if enabled
  let grid = null;
  let cells = [];
  if (enableGrid) {
    const gridResult = createGrid({
      gridClassName: `${classPrefix}__grid`,
      cellClassName: `${classPrefix}__cell`,
      testId: gridTestId,
    });
    grid = gridResult.grid;
    cells = gridResult.cells;
    gridState.tabStopCell = cells[0] || null;
    wrapper.appendChild(grid);
  }

  // Create highlight and tooltip
  const highlight = createHighlight(`${classPrefix}__highlight`);
  const tooltip = createTooltip(`${classPrefix}__tooltip`);
  wrapper.appendChild(highlight);
  wrapper.appendChild(tooltip);

  // Initialize pan-zoom
  let panZoom = null;
  if (enablePanZoom) {
    panZoom = createPanZoom(wrapper);
  }

  // Append wrapper to container
  container.appendChild(wrapper);

  // Helper: get effective container width
  function getEffectiveWidth() {
    if (panZoom && panZoom.isActive) {
      return wrapper.offsetWidth || wrapper.clientWidth;
    }
    const rect = image.getBoundingClientRect();
    return rect.width || wrapper.offsetWidth;
  }

  // Helper: get square context
  function getSquareContext(squareNumber) {
    const personalization = getPersonalization(squareNumber);
    const extra = getExtra(squareNumber);
    return { personalization, extra };
  }

  // Helper: get square from pointer event
  function getSquareFromEvent(event) {
    let clientX = event.clientX;
    let clientY = event.clientY;

    if (event.touches && event.touches[0]) {
      clientX = event.touches[0].clientX;
      clientY = event.touches[0].clientY;
    } else if (event.changedTouches && event.changedTouches[0]) {
      clientX = event.changedTouches[0].clientX;
      clientY = event.changedTouches[0].clientY;
    }

    let x, y, effectiveWidth;
    if (panZoom && panZoom.isActive) {
      const canvasCoords = panZoom.screenToCanvas(clientX, clientY);
      x = canvasCoords.x;
      y = canvasCoords.y;
      effectiveWidth = wrapper.offsetWidth || wrapper.clientWidth;
    } else {
      const rect = image.getBoundingClientRect();
      x = clientX - rect.left;
      y = clientY - rect.top;
      effectiveWidth = rect.width;
    }

    return getSquareFromPosition(x, y, effectiveWidth);
  }

  // Helper: get square from event or cell
  function getSquareFromEventOrCell(event) {
    if (event && event.target && typeof event.target.closest === "function") {
      const cell = event.target.closest(`.${classPrefix}__cell`);
      if (cell) {
        return getSquareFromCell(cell);
      }
    }
    return getSquareFromEvent(event);
  }

  // Show square highlight and tooltip
  function setSquare(squareNumber) {
    if (!squareNumber || squareNumber < 1 || squareNumber > TOTAL_SQUARES) {
      return;
    }

    currentSquare = squareNumber;
    const ctx = getSquareContext(squareNumber);
    const status = describeSquareStatus(ctx.personalization, ctx.extra);
    const allowed = filter(squareNumber, ctx);

    const effectiveWidth = getEffectiveWidth();
    const cellSize = getCellSize(effectiveWidth);
    const scale = panZoom && panZoom.isActive ? panZoom.scale : 1;

    showSquare(
      { highlight, tooltip },
      squareNumber,
      {
        cellSize,
        scale,
        tooltipContent: `#${squareNumber} — ${status.label}`,
        disabled: !allowed,
      }
    );

    if (enableGrid) {
      updateGridSelection(cells, squareNumber, gridState);
    }

    if (onSquareHover) {
      onSquareHover(squareNumber);
    }
  }

  // Clear selection
  function clearSelection() {
    currentSquare = null;
    hideSquare({ highlight, tooltip });
    if (enableGrid) {
      clearGridSelection(gridState);
    }
  }

  // Activate (select) a square
  function activateSquare(squareNumber, event) {
    if (!squareNumber) return false;

    const ctx = getSquareContext(squareNumber);
    const allowed = filter(squareNumber, ctx);

    if (!allowed) return false;

    if (onSquareSelect) {
      onSquareSelect(squareNumber);
    }
    if (onSquareActivate) {
      onSquareActivate(squareNumber, event);
    }

    return true;
  }

  // Event handlers
  function handlePointerMove(event) {
    if (event && "pointerType" in event && event.pointerType === "touch") {
      return;
    }
    const squareNumber = getSquareFromEventOrCell(event);
    if (!squareNumber) {
      if (!grid || !grid.contains(document.activeElement)) {
        clearSelection();
      }
      return;
    }
    setSquare(squareNumber);
  }

  function handlePointerLeave() {
    if (grid && grid.contains(document.activeElement)) {
      return;
    }
    clearSelection();
  }

  function handleClick(event) {
    if (panZoom && panZoom.hasPanned && panZoom.hasPanned()) {
      return;
    }
    const squareNumber = currentSquare || getSquareFromEventOrCell(event);
    if (squareNumber && enableGrid) {
      const cell = event.target.closest(`.${classPrefix}__cell`);
      if (cell) {
        updateGridSelection(cells, squareNumber, gridState, {
          focusCell: true,
          updateTabStop: true,
        });
      }
    }
    activateSquare(squareNumber, event);
  }

  function handleGridFocus(event) {
    const cell = event.target.closest(`.${classPrefix}__cell`);
    const squareNumber = getSquareFromCell(cell);
    if (!squareNumber) return;
    updateGridSelection(cells, squareNumber, gridState, { updateTabStop: true });
    setSquare(squareNumber);
  }

  function handleGridFocusOut(event) {
    const nextFocus = event.relatedTarget;
    if (!nextFocus || !grid || !grid.contains(nextFocus)) {
      clearSelection();
    }
  }

  function handleGridKeydown(event) {
    const cell = event.target.closest(`.${classPrefix}__cell`);
    if (!cell) return;

    const squareNumber = getSquareFromCell(cell);
    if (!squareNumber) return;

    const key = event.key.toLowerCase();
    let nextSquare = null;

    // Navigation keys
    if (key === "w" || key === "," || key === "arrowup") {
      if (squareNumber > GRID_DIMENSION) {
        nextSquare = squareNumber - GRID_DIMENSION;
      }
    } else if (key === "a" || key === "arrowleft") {
      if ((squareNumber - 1) % GRID_DIMENSION !== 0) {
        nextSquare = squareNumber - 1;
      }
    } else if (key === "s" || key === "o" || key === "arrowdown") {
      if (squareNumber <= GRID_DIMENSION * (GRID_DIMENSION - 1)) {
        nextSquare = squareNumber + GRID_DIMENSION;
      }
    } else if (key === "d" || key === "e" || key === "arrowright") {
      if (squareNumber % GRID_DIMENSION !== 0) {
        nextSquare = squareNumber + 1;
      }
    } else if (key === "enter" || key === " " || key === "spacebar") {
      event.preventDefault();
      event.stopPropagation();
      activateSquare(squareNumber, event);
      return;
    } else {
      return;
    }

    if (nextSquare) {
      event.preventDefault();
      event.stopPropagation();
      updateGridSelection(cells, nextSquare, gridState, {
        focusCell: true,
        updateTabStop: true,
      });
      setSquare(nextSquare);
    }
  }

  // Attach event listeners
  const pointerSurface = grid || image;
  pointerSurface.addEventListener("pointermove", handlePointerMove);
  pointerSurface.addEventListener("pointerdown", handlePointerMove);
  pointerSurface.addEventListener("pointerleave", handlePointerLeave);
  pointerSurface.addEventListener("click", handleClick);
  pointerSurface.addEventListener("pointerup", handleClick);
  pointerSurface.addEventListener("touchend", handleClick);

  if (grid && enableKeyboard) {
    grid.addEventListener("focusin", handleGridFocus);
    grid.addEventListener("focusout", handleGridFocusOut);
    grid.addEventListener("keydown", handleGridKeydown);
  }

  wrapper.addEventListener("pointerleave", handlePointerLeave);

  // Resize handler
  function handleResize() {
    if (currentSquare) {
      setSquare(currentSquare);
    }
  }
  window.addEventListener("resize", handleResize);

  // Reset pan-zoom
  function reset() {
    if (panZoom) {
      panZoom.reset();
    }
  }

  // Cleanup
  function destroy() {
    pointerSurface.removeEventListener("pointermove", handlePointerMove);
    pointerSurface.removeEventListener("pointerdown", handlePointerMove);
    pointerSurface.removeEventListener("pointerleave", handlePointerLeave);
    pointerSurface.removeEventListener("click", handleClick);
    pointerSurface.removeEventListener("pointerup", handleClick);
    pointerSurface.removeEventListener("touchend", handleClick);

    if (grid && enableKeyboard) {
      grid.removeEventListener("focusin", handleGridFocus);
      grid.removeEventListener("focusout", handleGridFocusOut);
      grid.removeEventListener("keydown", handleGridKeydown);
    }

    wrapper.removeEventListener("pointerleave", handlePointerLeave);
    window.removeEventListener("resize", handleResize);

    if (panZoom) {
      panZoom.destroy();
    }
  }

  // Return controller
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
  };
}

// Re-export utilities for convenience
export { createResetButton, createMobileHint } from "./billboard-view.js";
export { isTouchDevice, GRID_DIMENSION, TOTAL_SQUARES } from "./billboard-utils.js";
