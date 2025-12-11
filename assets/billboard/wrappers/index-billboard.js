/**
 * Homepage billboard wrapper
 * Electric fence animation, link handling, leaving-modal integration
 */

import { createPanZoom } from "../../js/pan-zoom.js";
import {
  GRID_DIMENSION,
  squareToCoords,
} from "../billboard-utils.js";
import {
  createGrid,
  updateGridSelection,
  clearGridSelection,
  getSquareFromCell,
} from "../billboard-view.js";

/**
 * Initialize the homepage billboard
 * @param {Object} options
 * @param {HTMLElement} options.mapWrapper - The .map-wrapper element
 * @param {HTMLImageElement} options.image - The billboard image element
 * @param {HTMLElement} options.positionDiv - The highlight/position indicator
 * @param {HTMLElement} options.tooltipDiv - The tooltip element
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

  if (!mapWrapper || !image) {
    console.error("Homepage billboard: missing required elements");
    return null;
  }

  // State
  let squarePersonalizations = [];
  let positionSquareNumber = 1;
  let hasActiveSelection = false;
  const gridState = {
    activeCell: null,
    tabStopCell: null,
  };

  // Electric fence state
  const fence = new Set();
  let litUpEdge = new Set();
  const wasEverLitUp = new Set();

  // Initialize pan-zoom
  const panZoom = createPanZoom(mapWrapper);

  // Create grid
  const { grid, cells } = createGrid({
    gridClassName: "map-grid",
    cellClassName: "map-grid__cell",
    ariaLabel: "Su Squares billboard",
    testId: "billboard-grid",
  });

  if (cells[0]) {
    gridState.tabStopCell = cells[0];
  }
  mapWrapper.appendChild(grid);

  // Wire up reset button
  if (resetButton && panZoom) {
    resetButton.addEventListener("click", () => panZoom.reset());
  }

  // Remove initial href from link anchor
  if (linkAnchor) {
    linkAnchor.removeAttribute("href");
  }

  // Helper: get effective cell size
  function getEffectiveCellSize() {
    if (panZoom && panZoom.isActive) {
      return mapWrapper.offsetWidth / GRID_DIMENSION;
    }
    const rect = image.getBoundingClientRect();
    return rect.width ? rect.width / GRID_DIMENSION : 10;
  }

  // Set position/highlight for a square
  function setPosition(squareNumber) {
    positionSquareNumber = squareNumber;
    hasActiveSelection = true;

    if (!linkAnchor) return;

    const cellSize = getEffectiveCellSize();
    const { row, col } = squareToCoords(squareNumber);
    const personalization = squarePersonalizations[squareNumber - 1];
    const normalizedHref = normalizeHref(personalization?.[1]);

    // Update cursor and tooltip based on square state
    if (!personalization) {
      // Available for sale
      image.style.cursor = "pointer";
      tooltipDiv.textContent = `Square #${squareNumber} is available for sale, click to buy.`;
      linkAnchor.href = `${baseurl}/buy?square=${squareNumber}`;
    } else if (!personalization[0] && !personalization[1]) {
      // Minted but not personalized
      image.style.cursor = "not-allowed";
      tooltipDiv.textContent = `Square #${squareNumber} WAS PURCHASED BUT NOT YET PERSONALIZED`;
      linkAnchor.removeAttribute("href");
    } else {
      // Personalized
      image.style.cursor = "pointer";
      tooltipDiv.textContent = `Square #${squareNumber} ${personalization[0]}`;
      if (normalizedHref) {
        linkAnchor.href = normalizedHref;
      } else {
        linkAnchor.removeAttribute("href");
      }
    }

    // Position highlight
    positionDiv.style.width = `${cellSize}px`;
    positionDiv.style.height = `${cellSize}px`;
    positionDiv.style.left = `${col * cellSize}px`;
    positionDiv.style.top = `${row * cellSize}px`;
    positionDiv.style.display = "block";

    // Position tooltip with axis-flipping
    const isLeftHalf = col < GRID_DIMENSION / 2;
    const isTopHalf = row < GRID_DIMENSION / 2;

    if (isLeftHalf) {
      tooltipDiv.style.left = `${col * cellSize + cellSize * 1.5}px`;
      tooltipDiv.style.right = "auto";
    } else {
      tooltipDiv.style.left = "auto";
      tooltipDiv.style.right = `${(GRID_DIMENSION - col - 1) * cellSize + cellSize * 1.5}px`;
    }

    if (isTopHalf) {
      tooltipDiv.style.top = `${(row + 1) * cellSize}px`;
      tooltipDiv.style.transformOrigin = `${isLeftHalf ? "left" : "right"} top`;
    } else {
      tooltipDiv.style.top = `${row * cellSize}px`;
      tooltipDiv.style.transformOrigin = `${isLeftHalf ? "left" : "right"} bottom`;
    }

    // Scale tooltip with pan-zoom
    const yTransform = isTopHalf ? "" : "translateY(-100%)";
    if (panZoom && panZoom.isActive && panZoom.scale) {
      tooltipDiv.style.transform = `${yTransform} scale(${1 / panZoom.scale})`;
    } else {
      tooltipDiv.style.transform = yTransform;
    }

    tooltipDiv.style.display = "block";
    updateGridSelection(cells, squareNumber, gridState);
  }

  // Clear selection
  function clearSelection() {
    if (grid && grid.contains(document.activeElement)) {
      return;
    }
    positionDiv.style.display = "none";
    tooltipDiv.style.display = "none";
    hasActiveSelection = false;
    if (linkAnchor) {
      linkAnchor.removeAttribute("href");
    }
    clearGridSelection(gridState);
  }

  // Activate a square (trigger navigation)
  function activateSquare(squareNumber) {
    setPosition(squareNumber);
    if (!linkAnchor) return;

    const href = linkAnchor.getAttribute("href");
    if (!href || href === "#") return;

    linkAnchor.click();
  }

  // Event handlers
  function handleGridPointerMove(event) {
    if (event.pointerType === "touch") return;

    const cell = event.target.closest(".map-grid__cell");
    const squareNumber = getSquareFromCell(cell);
    if (!squareNumber) return;

    setPosition(squareNumber);
  }

  function handleGridPointerLeave() {
    if (grid && grid.contains(document.activeElement)) return;
    clearSelection();
  }

  function handleGridClick(event) {
    if (panZoom && panZoom.hasPanned && panZoom.hasPanned()) return;

    const cell = event.target.closest(".map-grid__cell");
    const squareNumber = getSquareFromCell(cell);
    if (!squareNumber) return;

    updateGridSelection(cells, squareNumber, gridState, {
      focusCell: true,
      updateTabStop: true,
    });
    activateSquare(squareNumber);
  }

  function handleGridFocus(event) {
    const cell = event.target.closest(".map-grid__cell");
    const squareNumber = getSquareFromCell(cell);
    if (!squareNumber) return;

    updateGridSelection(cells, squareNumber, gridState, { updateTabStop: true });
    setPosition(squareNumber);
  }

  function handleGridKeydown(event) {
    const cell = event.target.closest(".map-grid__cell");
    if (!cell) return;

    const squareNumber = getSquareFromCell(cell);
    if (!squareNumber) return;

    const key = event.key.toLowerCase();
    let nextSquare = null;

    if (key === "w" || key === "," || key === "arrowup") {
      if (squareNumber > GRID_DIMENSION) nextSquare = squareNumber - GRID_DIMENSION;
    } else if (key === "a" || key === "arrowleft") {
      if ((squareNumber - 1) % GRID_DIMENSION !== 0) nextSquare = squareNumber - 1;
    } else if (key === "s" || key === "o" || key === "arrowdown") {
      if (squareNumber <= GRID_DIMENSION * (GRID_DIMENSION - 1)) nextSquare = squareNumber + GRID_DIMENSION;
    } else if (key === "d" || key === "e" || key === "arrowright") {
      if (squareNumber % GRID_DIMENSION !== 0) nextSquare = squareNumber + 1;
    } else if (key === "enter" || key === " " || key === "spacebar") {
      event.preventDefault();
      event.stopPropagation();
      activateSquare(squareNumber);
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
      setPosition(nextSquare);
    }
  }

  function handleGridFocusOut(event) {
    const nextFocus = event.relatedTarget;
    if (!nextFocus || !grid.contains(nextFocus)) {
      clearSelection();
    }
  }

  // Global keyboard navigation (when grid not focused)
  function handleDocumentKeydown(event) {
    if (grid && event.target && grid.contains(event.target)) return;

    const key = event.key.toLowerCase();

    if (key === "w" || key === "," || key === "arrowup") {
      if (positionSquareNumber > GRID_DIMENSION) setPosition(positionSquareNumber - GRID_DIMENSION);
      event.preventDefault();
    } else if (key === "a" || key === "arrowleft") {
      if (positionSquareNumber % GRID_DIMENSION !== 1) setPosition(positionSquareNumber - 1);
    } else if (key === "s" || key === "o" || key === "arrowdown") {
      if (positionSquareNumber <= GRID_DIMENSION * (GRID_DIMENSION - 1)) setPosition(positionSquareNumber + GRID_DIMENSION);
      event.preventDefault();
    } else if (key === "d" || key === "e" || key === "arrowright") {
      if (positionSquareNumber % GRID_DIMENSION !== 0) setPosition(positionSquareNumber + 1);
    } else if (key === "enter") {
      if (hasActiveSelection && linkAnchor && linkAnchor.hasAttribute("href")) {
        linkAnchor.click();
      }
    }

    updateGridSelection(cells, positionSquareNumber, gridState);
  }

  // Leaving modal integration
  function handleLinkClick(event) {
    if (panZoom && panZoom.hasPanned && panZoom.hasPanned()) {
      event.preventDefault();
      return;
    }

    if (!linkAnchor) return;

    const href = linkAnchor.getAttribute("href");
    if (!href || href === "#") return;

    const modal = window.SuLeavingModal;
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

  // Electric fence animation
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

        // Add adjacent squares to next edge
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

  // Attach event listeners
  grid.addEventListener("pointermove", handleGridPointerMove);
  grid.addEventListener("pointerdown", handleGridPointerMove);
  grid.addEventListener("pointerleave", handleGridPointerLeave);
  grid.addEventListener("click", handleGridClick);
  grid.addEventListener("focusin", handleGridFocus);
  grid.addEventListener("keydown", handleGridKeydown);
  grid.addEventListener("focusout", handleGridFocusOut);

  mapWrapper.addEventListener("pointerleave", handleGridPointerLeave);
  document.addEventListener("keydown", handleDocumentKeydown);

  if (linkAnchor) {
    linkAnchor.addEventListener("click", handleLinkClick);
  }

  // Resize handler
  window.addEventListener("resize", () => {
    if (tooltipDiv.style.display === "block") {
      setPosition(positionSquareNumber);
    }
  });

  // Return controller
  return {
    setData(personalizations, _extra) {
      squarePersonalizations = personalizations;
      // extra data available if needed for future features
    },

    startFenceAnimation() {
      lightUpFence(new Set([1]));
    },

    setPosition,
    clearSelection,

    get currentSquare() {
      return positionSquareNumber;
    },

    panZoom,
    grid,
    cells,
  };
}
