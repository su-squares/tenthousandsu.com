/**
 * Square location view wrapper
 * Simple arrow-based location indicator (no grid)
 */

import { createPanZoom } from "../../js/pan-zoom.js";
import { squareToCoords, getQuadrant } from "../billboard-utils.js";
import { SquareBlocklist } from "../blocklist/blocklist-squares.js";

/**
 * Initialize the square location view
 * @param {Object} options
 * @param {HTMLElement} options.canvas - The .square-location__canvas element
 * @param {HTMLImageElement} options.image - The billboard image element
 * @param {HTMLImageElement} options.arrow - The arrow indicator element
 * @param {HTMLButtonElement} [options.resetButton] - Optional reset zoom button
 * @param {number} options.squareNumber - The square to highlight
 * @param {string} [options.arrowBasePath="assets/images"] - Path to arrow images
 * @returns {Object} Controller with methods
 */
export function initSquareLocation(options) {
  const {
    canvas,
    image,
    arrow,
    resetButton,
    squareNumber,
    arrowBasePath = "assets/images",
  } = options;

  if (!canvas || !image || !arrow) {
    console.error("Square location: missing required elements");
    return null;
  }

  let currentSquare = squareNumber;
  let blockedOverlaysRendered = false;

  // Initialize pan-zoom
  const panZoom = createPanZoom(canvas);

  /**
   * Render blocked square overlays
   */
  async function renderBlockedOverlays() {
    if (blockedOverlaysRendered) return;
    blockedOverlaysRendered = true;

    await SquareBlocklist.loadOnce();
    const blockedSquares = SquareBlocklist.getBlockedSquares();

    if (blockedSquares.size === 0) return;

    // Create container for overlays
    const overlayContainer = document.createElement("div");
    overlayContainer.className = "square-location__blocked-container";
    canvas.appendChild(overlayContainer);

    // Create overlay for each blocked square
    for (const sq of blockedSquares) {
      const { row, col } = squareToCoords(sq);
      const overlay = document.createElement("div");
      overlay.className = "square-location__blocked";
      // Position: each square is 10x10 in original 1000x1000 image, use percentage
      overlay.style.top = `${row}%`;
      overlay.style.left = `${col}%`;
      overlayContainer.appendChild(overlay);
    }
  }

  // Load and render blocked overlays
  renderBlockedOverlays();

  // Show reset button if touch device
  if (panZoom && panZoom.isActive && resetButton) {
    resetButton.style.display = "block";
    resetButton.addEventListener("click", () => panZoom.reset());
  }

  /**
   * Update arrow position based on square and container size
   */
  function updateArrowPosition() {
    if (!currentSquare) return;

    const { row, col } = squareToCoords(currentSquare);
    const { isLeftHalf, isTopHalf } = getQuadrant(currentSquare);

    // Get actual rendered size and calculate scale factor
    const actualWidth = canvas.offsetWidth;
    const originalSize = 1000; // Original image is 1000x1000px
    const dynamicScale = actualWidth / originalSize;

    const scalePosition = (value) => `${value * dynamicScale}px`;

    // Set arrow size (100px in original, scaled)
    arrow.style.width = `${100 * dynamicScale}px`;
    arrow.style.height = `${100 * dynamicScale}px`;

    // Determine arrow image and position based on quadrant
    let arrowSrc;
    let topPx;
    let leftPx;

    if (isTopHalf) {
      if (isLeftHalf) {
        // Top-left: arrow points down-right
        arrowSrc = `${arrowBasePath}/ul.png`;
        topPx = row * 10 + 10;
        leftPx = col * 10 + 10;
      } else {
        // Top-right: arrow points down-left
        arrowSrc = `${arrowBasePath}/ur.png`;
        topPx = row * 10 + 10;
        leftPx = col * 10 - 100;
      }
    } else {
      if (isLeftHalf) {
        // Bottom-left: arrow points up-right
        arrowSrc = `${arrowBasePath}/dl.png`;
        topPx = row * 10 - 100;
        leftPx = col * 10 + 10;
      } else {
        // Bottom-right: arrow points up-left
        arrowSrc = `${arrowBasePath}/dr.png`;
        topPx = row * 10 - 100;
        leftPx = col * 10 - 100;
      }
    }

    arrow.src = arrowSrc;
    arrow.style.top = scalePosition(topPx);
    arrow.style.left = scalePosition(leftPx);
  }

  // Initial positioning
  updateArrowPosition();

  // Update on window resize
  window.addEventListener("resize", updateArrowPosition);

  // Return controller
  return {
    /**
     * Update the displayed square
     * @param {number} newSquareNumber
     */
    setSquare(newSquareNumber) {
      currentSquare = newSquareNumber;
      updateArrowPosition();
    },

    get currentSquare() {
      return currentSquare;
    },

    panZoom,

    destroy() {
      window.removeEventListener("resize", updateArrowPosition);
      if (panZoom) {
        panZoom.destroy();
      }
    },
  };
}
