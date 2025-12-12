/**
 * Billboard view functions - DOM creation and updates
 */

import {
  TOTAL_SQUARES,
  calculateHighlightPosition,
  calculateTooltipPosition,
} from "./billboard-utils.js";

/**
 * Create the 100x100 grid overlay with ARIA support
 * @param {Object} options
 * @param {string} [options.gridClassName="billboard__grid"]
 * @param {string} [options.cellClassName="billboard__cell"]
 * @param {string} [options.ariaLabel="Billboard squares"]
 * @param {string} [options.testId]
 * @returns {{ grid: HTMLElement, cells: HTMLElement[] }}
 */
export function createGrid(options = {}) {
  const {
    gridClassName = "billboard__grid",
    cellClassName = "billboard__cell",
    ariaLabel = "Billboard squares",
    testId,
  } = options;

  const grid = document.createElement("div");
  grid.className = gridClassName;
  grid.setAttribute("role", "grid");
  grid.setAttribute("aria-label", ariaLabel);
  if (testId) {
    grid.dataset.testid = testId;
  }

  const cells = [];
  const fragment = document.createDocumentFragment();

  for (let i = 1; i <= TOTAL_SQUARES; i++) {
    const cell = document.createElement("div");
    cell.className = cellClassName;
    cell.dataset.square = i;
    cell.setAttribute("role", "gridcell");
    cell.setAttribute("aria-label", `Square #${i}`);
    cell.setAttribute("aria-selected", "false");
    cell.tabIndex = -1;
    fragment.appendChild(cell);
    cells[i - 1] = cell;
  }

  // First cell is the initial tab stop
  if (cells[0]) {
    cells[0].tabIndex = 0;
  }

  grid.appendChild(fragment);

  return { grid, cells };
}

/**
 * Create highlight element
 * @param {string} [className="billboard__highlight"]
 * @returns {HTMLElement}
 */
export function createHighlight(className = "billboard__highlight") {
  const highlight = document.createElement("div");
  highlight.className = className;
  return highlight;
}

/**
 * Create tooltip element
 * @param {string} [className="billboard__tooltip"]
 * @returns {HTMLElement}
 */
export function createTooltip(className = "billboard__tooltip") {
  const tooltip = document.createElement("div");
  tooltip.className = className;
  return tooltip;
}

/**
 * Create reset zoom button
 * @param {Object} options
 * @param {string} [options.className="billboard__reset-btn"]
 * @param {string} [options.text="Reset zoom"]
 * @param {Function} [options.onClick]
 * @returns {HTMLElement}
 */
export function createResetButton(options = {}) {
  const {
    className = "billboard__reset-btn",
    text = "Reset zoom",
    onClick,
  } = options;

  const button = document.createElement("button");
  button.type = "button";
  button.className = className;
  button.textContent = text;

  if (onClick) {
    button.addEventListener("click", onClick);
  }

  return button;
}

/**
 * Create mobile hint element
 * @param {string} [text="Pinch to zoom, drag to pan."]
 * @param {string} [className="billboard__mobile-hint"]
 * @returns {HTMLElement}
 */
export function createMobileHint(text = "Pinch to zoom, drag to pan.", className = "billboard__mobile-hint") {
  const hint = document.createElement("p");
  hint.className = className;
  hint.textContent = text;
  return hint;
}

/**
 * Update highlight element position and visibility
 * @param {HTMLElement} element
 * @param {Object} position
 * @param {number} position.left
 * @param {number} position.top
 * @param {number} position.width
 * @param {number} position.height
 * @param {boolean} [position.visible=true]
 */
export function updateHighlight(element, position) {
  const { left, top, width, height, visible = true } = position;
  element.style.display = visible ? "block" : "none";
  element.style.left = `${left}px`;
  element.style.top = `${top}px`;
  element.style.width = `${width}px`;
  element.style.height = `${height}px`;
}

/**
 * Update tooltip element
 * @param {HTMLElement} element
 * @param {Object} options
 * @param {string} options.content
 * @param {Object} options.position - From calculateTooltipPosition
 * @param {boolean} [options.visible=true]
 * @param {boolean} [options.disabled=false]
 * @param {string} [options.cssClass] - Additional CSS class for styling
 */
export function updateTooltip(element, options) {
  const { content, position, visible = true, disabled = false, cssClass = null } = options;

  element.style.display = visible ? "block" : "none";
  element.textContent = content;
  element.dataset.disabled = disabled ? "true" : "false";

  // Handle custom CSS class
  // Remove any previous custom class (stored in data attribute)
  const prevClass = element.dataset.customClass;
  if (prevClass) {
    element.classList.remove(prevClass);
    delete element.dataset.customClass;
  }

  // Add new custom class if provided
  if (cssClass) {
    element.classList.add(cssClass);
    element.dataset.customClass = cssClass;
  }

  if (position) {
    element.style.left = position.left;
    element.style.right = position.right;
    element.style.top = position.top;
    element.style.transform = position.transform;
    element.style.transformOrigin = position.transformOrigin;
  }
}

/**
 * Update grid selection state (ARIA and focus)
 * @param {HTMLElement[]} cells
 * @param {number} squareNumber
 * @param {Object} state - Mutable state object to track active/tabstop cells
 * @param {Object} options
 * @param {boolean} [options.focusCell=false]
 * @param {boolean} [options.updateTabStop=false]
 */
export function updateGridSelection(cells, squareNumber, state, options = {}) {
  const { focusCell = false, updateTabStop = false } = options;

  if (!cells.length || squareNumber < 1 || squareNumber > TOTAL_SQUARES) {
    return;
  }

  const nextCell = cells[squareNumber - 1];
  if (!nextCell) return;

  // Clear previous selection
  if (state.activeCell && state.activeCell !== nextCell) {
    state.activeCell.setAttribute("aria-selected", "false");
  }

  // Set new selection
  state.activeCell = nextCell;
  state.activeCell.setAttribute("aria-selected", "true");

  // Update tab stop
  if (updateTabStop && state.tabStopCell !== nextCell) {
    if (state.tabStopCell) {
      state.tabStopCell.tabIndex = -1;
    }
    nextCell.tabIndex = 0;
    state.tabStopCell = nextCell;
  }

  // Focus if requested
  if (focusCell) {
    nextCell.focus();
  }
}

/**
 * Clear grid selection
 * @param {Object} state - Mutable state object
 */
export function clearGridSelection(state) {
  if (state.activeCell) {
    state.activeCell.setAttribute("aria-selected", "false");
    state.activeCell = null;
  }
}

/**
 * Get square number from a cell element
 * @param {HTMLElement|null} element
 * @returns {number|null}
 */
export function getSquareFromCell(element) {
  if (!element) return null;
  const square = Number(element.dataset.square);
  if (Number.isNaN(square) || square < 1) {
    return null;
  }
  return square;
}

/**
 * Show a square with highlight and tooltip
 * @param {Object} elements - { highlight, tooltip }
 * @param {number} squareNumber
 * @param {Object} options
 * @param {number} options.cellSize
 * @param {number} [options.scale=1]
 * @param {string} options.tooltipContent
 * @param {string} [options.tooltipCssClass] - Additional CSS class for tooltip
 * @param {boolean} [options.disabled=false]
 */
export function showSquare(elements, squareNumber, options) {
  const { highlight, tooltip } = elements;
  const { cellSize, scale = 1, tooltipContent, tooltipCssClass = null, disabled = false } = options;

  // Update highlight
  const highlightPos = calculateHighlightPosition(squareNumber, cellSize);
  updateHighlight(highlight, { ...highlightPos, visible: true });

  // Update tooltip
  const tooltipPos = calculateTooltipPosition(squareNumber, cellSize, { scale });
  updateTooltip(tooltip, {
    content: tooltipContent,
    position: tooltipPos,
    visible: true,
    disabled,
    cssClass: tooltipCssClass,
  });
}

/**
 * Hide highlight and tooltip
 * @param {Object} elements - { highlight, tooltip }
 */
export function hideSquare(elements) {
  const { highlight, tooltip } = elements;
  if (highlight) highlight.style.display = "none";
  if (tooltip) tooltip.style.display = "none";
}
