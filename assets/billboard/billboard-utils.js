/**
 * Billboard utility functions - pure math and helpers
 * No DOM dependencies, suitable for testing
 */

export const GRID_DIMENSION = 100;
export const TOTAL_SQUARES = GRID_DIMENSION * GRID_DIMENSION;

/**
 * Clamp a value between min and max
 * @param {number} value
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

/**
 * Convert square number (1-indexed) to row/col (0-indexed)
 * @param {number} squareNumber - 1 to 10000
 * @returns {{ row: number, col: number }}
 */
export function squareToCoords(squareNumber) {
  const index = squareNumber - 1;
  return {
    row: Math.floor(index / GRID_DIMENSION),
    col: index % GRID_DIMENSION,
  };
}

/**
 * Convert row/col (0-indexed) to square number (1-indexed)
 * @param {number} row - 0 to 99
 * @param {number} col - 0 to 99
 * @returns {number} - 1 to 10000
 */
export function coordsToSquare(row, col) {
  return row * GRID_DIMENSION + col + 1;
}

/**
 * Get cell size based on container width
 * @param {number} containerWidth
 * @returns {number}
 */
export function getCellSize(containerWidth) {
  return containerWidth / GRID_DIMENSION;
}

/**
 * Determine which quadrant a square is in (for tooltip positioning)
 * @param {number} squareNumber
 * @returns {{ isLeftHalf: boolean, isTopHalf: boolean }}
 */
export function getQuadrant(squareNumber) {
  const { row, col } = squareToCoords(squareNumber);
  return {
    isLeftHalf: col < GRID_DIMENSION / 2,
    isTopHalf: row < GRID_DIMENSION / 2,
  };
}

/**
 * Get square number from x/y position within container
 * @param {number} x - X position in container
 * @param {number} y - Y position in container
 * @param {number} containerWidth - Width of container
 * @returns {number|null} - Square number (1-10000) or null if out of bounds
 */
export function getSquareFromPosition(x, y, containerWidth) {
  const cellSize = getCellSize(containerWidth);
  const col = clamp(Math.floor(x / cellSize), 0, GRID_DIMENSION - 1);
  const row = clamp(Math.floor(y / cellSize), 0, GRID_DIMENSION - 1);

  if (x < 0 || y < 0 || x > containerWidth || y > containerWidth) {
    return null;
  }

  return coordsToSquare(row, col);
}

/**
 * Calculate highlight box position
 * @param {number} squareNumber
 * @param {number} cellSize
 * @returns {{ left: number, top: number, width: number, height: number }}
 */
export function calculateHighlightPosition(squareNumber, cellSize) {
  const { row, col } = squareToCoords(squareNumber);
  return {
    left: col * cellSize,
    top: row * cellSize,
    width: cellSize,
    height: cellSize,
  };
}

/**
 * Calculate tooltip position with axis-flipping to avoid edge overflow
 * @param {number} squareNumber
 * @param {number} cellSize
 * @param {Object} options
 * @param {number} [options.scale=1] - Current pan-zoom scale
 * @returns {{ left: string, right: string, top: string, transform: string, transformOrigin: string }}
 */
export function calculateTooltipPosition(squareNumber, cellSize, options = {}) {
  const { scale = 1 } = options;
  const { row, col } = squareToCoords(squareNumber);
  const { isLeftHalf, isTopHalf } = getQuadrant(squareNumber);

  const result = {
    left: "auto",
    right: "auto",
    top: "",
    transform: "",
    transformOrigin: "",
  };

  // Horizontal positioning
  if (isLeftHalf) {
    result.left = `${col * cellSize + cellSize * 1.5}px`;
  } else {
    result.right = `${(GRID_DIMENSION - col - 1) * cellSize + cellSize * 1.5}px`;
  }

  // Vertical positioning
  if (isTopHalf) {
    result.top = `${(row + 1) * cellSize}px`;
    result.transformOrigin = `${isLeftHalf ? "left" : "right"} top`;
  } else {
    result.top = `${row * cellSize}px`;
    result.transformOrigin = `${isLeftHalf ? "left" : "right"} bottom`;
  }

  // Transform with optional inverse scale for zoom compensation
  const yTransform = isTopHalf ? "" : "translateY(-100%)";
  if (scale !== 1) {
    result.transform = `${yTransform} scale(${1 / scale})`.trim();
  } else {
    result.transform = yTransform;
  }

  return result;
}

/**
 * Describe square status based on personalization and extra data
 * @param {Array|null} personalization - [title, href] or null
 * @param {Array|null} extra - [mintedBlock, updatedBlock, mainIsPersonalized, version] or null
 * @returns {{ label: string, minted: boolean, personalized: boolean }}
 */
export function describeSquareStatus(personalization, extra) {
  if (!extra) {
    return { label: "unminted", minted: false, personalized: false };
  }

  const hasPersonalization = Boolean(
    (personalization && (personalization[0] || personalization[1])) ||
    (extra && extra[2])
  );

  if (hasPersonalization) {
    return { label: "minted and personalized", minted: true, personalized: true };
  }

  return { label: "minted but not personalized", minted: true, personalized: false };
}

/**
 * Calculate arrow position for location view (quadrant-based)
 * @param {number} squareNumber
 * @param {number} containerWidth
 * @returns {{ quadrant: string, top: number, left: number }}
 */
export function calculateArrowPosition(squareNumber, containerWidth) {
  const { row, col } = squareToCoords(squareNumber);
  const { isLeftHalf, isTopHalf } = getQuadrant(squareNumber);

  // Arrow image based on quadrant
  let quadrant;
  if (isTopHalf && isLeftHalf) quadrant = "ul";
  else if (isTopHalf && !isLeftHalf) quadrant = "ur";
  else if (!isTopHalf && isLeftHalf) quadrant = "dl";
  else quadrant = "dr";

  // Position calculation (scale to container)
  const scale = containerWidth / 1000; // Original image is 1000x1000
  const cellSize = 10 * scale; // Each cell is 10px in original

  return {
    quadrant,
    top: row * cellSize,
    left: col * cellSize,
  };
}

/**
 * Check if device supports touch
 * @returns {boolean}
 */
export function isTouchDevice() {
  return "ontouchstart" in window || navigator.maxTouchPoints > 0;
}
