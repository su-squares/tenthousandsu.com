import { loadSquareData } from "./square-data.js";

/**
 * Attach a chooser modal to a trigger/input pair.
 * @param {Object} options
 * @param {HTMLInputElement} options.input Element to receive the chosen number.
 * @param {HTMLElement} options.trigger Element that opens the modal when clicked.
 * @param {(id: number, ctx: {personalization: any, extra: any}) => boolean} [options.filter] Filter function.
 * @param {(id: number) => void} [options.onSelect] Callback when a square is chosen.
 * @param {string} [options.title] Title text for the modal.
 * @param {string} [options.description] Helper text inside the modal.
 * @param {boolean} [options.updateInput] Whether to write the selection into the input (default true).
 */
export function attachSquareChooser({
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

  let backdrop;
  let grid;
  let cachedSquares;

  function closeModal() {
    if (backdrop) {
      backdrop.classList.remove("is-open");
      document.removeEventListener("keydown", handleEscape);
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
    modal.className = "su-chooser";

    const heading = document.createElement("h3");
    heading.className = "su-chooser__title";
    heading.textContent = title;

    const helper = document.createElement("p");
    helper.className = "su-chooser__helper";
    helper.textContent = description;

    const closeButton = document.createElement("button");
    closeButton.type = "button";
    closeButton.className = "su-chooser__close";
    closeButton.textContent = "×";
    closeButton.setAttribute("aria-label", "Close chooser");
    closeButton.addEventListener("click", closeModal);

    grid = document.createElement("div");
    grid.className = "su-chooser__grid";
    grid.setAttribute("role", "grid");

    const headerRow = document.createElement("div");
    headerRow.className = "su-chooser__header";
    headerRow.appendChild(heading);
    headerRow.appendChild(closeButton);

    modal.appendChild(headerRow);
    if (description) {
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
    squares.forEach(({ id }) => {
      const cell = document.createElement("button");
      cell.type = "button";
      cell.className = "su-chooser__cell";
      cell.textContent = `#${id}`;
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
      const squares = await getSquares();
      ensureModal();
      renderGrid(squares);
      backdrop.classList.add("is-open");
      document.addEventListener("keydown", handleEscape);
    } catch (error) {
      alert(error.message || "Failed to load squares");
    }
  }

  trigger.addEventListener("click", openModal);

  return { open: openModal, close: closeModal };
}
