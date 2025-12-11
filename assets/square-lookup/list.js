import { loadSquareData } from "../js/square-data.js";

let chooserIdCounter = 0;

/**
 * Attach a list-style chooser modal to a trigger/input pair.
 * @param {Object} options
 * @param {HTMLInputElement} options.input Element to receive the chosen number.
 * @param {HTMLElement} options.trigger Element that opens the modal when clicked.
 * @param {(id: number, ctx: {personalization: any, extra: any}) => boolean} [options.filter] Filter function.
 * @param {(id: number) => void} [options.onSelect] Callback when a square is chosen.
 * @param {string} [options.title] Title text for the modal.
 * @param {string} [options.description] Helper text inside the modal.
 * @param {boolean} [options.updateInput] Whether to write the selection into the input (default true).
 */
export function attachListChooser({
  input,
  trigger,
  filter = () => true,
  onSelect = () => {},
  title = "Choose a Square",
  description = "",
  updateInput = true,
}) {
  if (!input || !trigger) {
    return;
  }

  const instanceId = ++chooserIdCounter;

  let backdrop;
  let modal;
  let grid;
  let cachedSquares;
  let lastFocusedElement = null;

  // Announce that the trigger opens a dialog
  trigger.setAttribute("aria-haspopup", "dialog");
  trigger.setAttribute("aria-expanded", "false");

  function closeModal() {
    if (backdrop) {
      backdrop.classList.remove("is-open");
      document.removeEventListener("keydown", handleEscape);
      trigger.setAttribute("aria-expanded", "false");
    }

    // Restore focus to what had focus before, or back to the trigger
    if (lastFocusedElement && document.contains(lastFocusedElement)) {
      lastFocusedElement.focus();
    } else if (trigger && document.contains(trigger)) {
      trigger.focus();
    }
  }

  function handleEscape(event) {
    if (event.key === "Escape") {
      event.preventDefault();
      closeModal();
    }
  }

  function ensureModal() {
    if (backdrop) return;

    const titleId = `su-chooser-title-${instanceId}`;
    const helperId = description ? `su-chooser-helper-${instanceId}` : null;

    backdrop = document.createElement("div");
    backdrop.className = "su-chooser-backdrop";
    backdrop.addEventListener("click", (event) => {
      if (event.target === backdrop) {
        closeModal();
      }
    });

    modal = document.createElement("div");
    modal.className = "su-chooser";
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    modal.setAttribute("aria-labelledby", titleId);
    if (helperId) {
      modal.setAttribute("aria-describedby", helperId);
    }

    const heading = document.createElement("h3");
    heading.className = "su-chooser__title";
    heading.textContent = title;
    heading.id = titleId;

    let helper = null;
    if (description) {
      helper = document.createElement("p");
      helper.className = "su-chooser__helper";
      helper.textContent = description;
      helper.id = helperId;
    }

    const closeButton = document.createElement("button");
    closeButton.type = "button";
    closeButton.className = "su-chooser__close";
    closeButton.textContent = "×";
    closeButton.setAttribute("aria-label", "Close chooser");
    closeButton.addEventListener("click", closeModal);

    grid = document.createElement("div");
    grid.className = "su-chooser__grid";
    grid.setAttribute("role", "grid");
    grid.setAttribute("aria-labelledby", titleId);
    if (helperId) {
      grid.setAttribute("aria-describedby", helperId);
    }
    grid.addEventListener("keydown", handleGridKeydown);

    const headerRow = document.createElement("div");
    headerRow.className = "su-chooser__header";
    headerRow.appendChild(heading);
    headerRow.appendChild(closeButton);

    modal.appendChild(headerRow);
    if (helper) {
      modal.appendChild(helper);
    }
    modal.appendChild(grid);
    backdrop.appendChild(modal);
    document.body.appendChild(backdrop);
  }

  function renderGrid(squares) {
    if (!grid) return;
    grid.innerHTML = "";

    if (!squares.length) {
      const empty = document.createElement("p");
      empty.className = "su-chooser__empty";
      empty.textContent = "No squares found for this filter.";
      grid.appendChild(empty);
      return;
    }

    const fragment = document.createDocumentFragment();
    let isFirst = true;

    squares.forEach(({ id }) => {
      const cell = document.createElement("button");
      cell.type = "button";
      cell.className = "su-chooser__cell";

      // Visible text and accessible name
      cell.textContent = `#${id}`;
      cell.setAttribute("aria-label", `Square ${id}`);

      // Roving tabindex: only one tabbable cell in the grid
      cell.setAttribute("tabindex", isFirst ? "0" : "-1");
      isFirst = false;

      cell.addEventListener("click", () => {
        if (updateInput && input) {
          input.value = id;
          input.dispatchEvent(new Event("input", { bubbles: true }));
        }
        onSelect(id);
        closeModal();
      });

      fragment.appendChild(cell);
    });

    grid.appendChild(fragment);
  }

  async function getSquares() {
    if (cachedSquares) return cachedSquares;
    const { personalizations, extra } = await loadSquareData();
    const squares = [];
    for (let i = 1; i <= personalizations.length; i++) {
      const ctx = {
        personalization: personalizations[i - 1],
        extra: extra[i - 1],
      };
      if (filter(i, ctx)) {
        squares.push({ id: i, ...ctx });
      }
    }
    cachedSquares = squares;
    return squares;
  }

  async function openModal() {
    try {
      lastFocusedElement =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;

      const squares = await getSquares();
      ensureModal();
      renderGrid(squares);

      backdrop.classList.add("is-open");
      trigger.setAttribute("aria-expanded", "true");
      document.addEventListener("keydown", handleEscape);

      // Put focus on the first cell in the grid
      if (grid) {
        const firstCell = grid.querySelector(".su-chooser__cell");
        if (firstCell instanceof HTMLElement) {
          firstCell.focus();
        }
      }
    } catch (error) {
      alert(error.message || "Failed to load squares");
    }
  }

  trigger.addEventListener("click", openModal);

  return { open: openModal, close: closeModal };
}

function getColumnCount(container, sampleCell) {
  if (!container || !sampleCell) return 1;
  const cellWidth = sampleCell.offsetWidth || 1;
  if (cellWidth <= 0) return 1;
  const columns = Math.floor(container.clientWidth / cellWidth);
  return Math.max(columns, 1);
}

function moveFocus(cells, nextIndex) {
  if (!cells.length) return;
  const target = cells[nextIndex];
  if (!target) return;

  // Update roving tabindex so only the focused cell is tabbable
  cells.forEach((cell, index) => {
    if (cell instanceof HTMLElement) {
      cell.setAttribute("tabindex", index === nextIndex ? "0" : "-1");
    }
  });

  target.focus();
}

function handleGridKeydown(event) {
  const grid = event.currentTarget;
  if (!(grid instanceof HTMLElement)) return;

  const cells = Array.from(grid.querySelectorAll(".su-chooser__cell"));
  if (!cells.length) return;

  const currentElement = document.activeElement;
  const currentIndex = cells.indexOf(currentElement);
  if (currentIndex === -1) return;

  const key = event.key ? event.key.toLowerCase() : "";
  const columns = getColumnCount(grid, cells[0]);
  let nextIndex = null;

  switch (key) {
    case "enter":
    case " ":
      // Activate the current cell via keyboard
      event.preventDefault();
      cells[currentIndex].click();
      return;

    case "arrowright":
    case "d":
    case "e":
      nextIndex = Math.min(currentIndex + 1, cells.length - 1);
      break;

    case "arrowleft":
    case "a":
    case "q":
      nextIndex = Math.max(currentIndex - 1, 0);
      break;

    case "arrowdown":
    case "s":
    case "o":
      nextIndex =
        currentIndex + columns < cells.length
          ? currentIndex + columns
          : cells.length - 1;
      break;

    case "arrowup":
    case "w":
    case "i":
      nextIndex =
        currentIndex - columns >= 0 ? currentIndex - columns : 0;
      break;

    case "home":
      nextIndex = 0;
      break;

    case "end":
      nextIndex = cells.length - 1;
      break;

    default:
      return;
  }

  if (nextIndex === null || nextIndex === currentIndex) {
    return;
  }

  event.preventDefault();
  moveFocus(cells, nextIndex);
}
