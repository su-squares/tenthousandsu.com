let chooserIdCounter = 0;

/**
 * Attach a checkbox list chooser modal for personalization.
 * @param {Object} options
 * @param {HTMLElement} options.trigger Element that opens the modal.
 * @param {() => Promise<number[]>} options.getSquares Async getter for available square IDs.
 * @param {() => number[]} options.getSelectedIds Getter for currently selected IDs.
 * @param {(ids: number[]) => void} [options.onSelectionChange] Callback on toggle.
 * @param {(ids: number[]) => void} [options.onConfirm] Callback when user presses Okay.
 * @param {() => void} [options.onOpen] Callback when modal opens.
 * @param {() => void} [options.onClose] Callback when modal closes.
 * @param {string} [options.title]
 * @param {string} [options.description]
 */
export function attachListChooserPersonalize(options) {
  const { trigger } = options;
  if (!trigger) return;

  const instanceId = ++chooserIdCounter;

  let backdrop = null;
  let grid = null;
  let checkedIds = new Set();
  let currentSquares = [];

  const getSquares = options.getSquares;
  const getSelectedIds = options.getSelectedIds;
  const onSelectionChange = options.onSelectionChange || (() => {});
  const onConfirm = options.onConfirm || (() => {});
  const onOpen = options.onOpen || (() => {});
  const onClose = options.onClose || (() => {});
  const title = options.title || "Select squares then press okay";
  const description = options.description || "";

  trigger.setAttribute("aria-haspopup", "dialog");
  trigger.setAttribute("aria-expanded", "false");

  function closeModal() {
    if (backdrop) {
      backdrop.classList.remove("is-open");
      document.removeEventListener("keydown", handleEscape);
      trigger.setAttribute("aria-expanded", "false");
      onClose();
    }
  }

  function handleEscape(event) {
    if (event.key === "Escape") {
      event.preventDefault();
      closeModal();
    }
  }

  function notifySelectionChange() {
    onSelectionChange(Array.from(checkedIds).sort((a, b) => a - b));
  }

  function toggleCheckbox(id, checkboxEl, cellEl) {
    if (checkedIds.has(id)) {
      checkedIds.delete(id);
      checkboxEl.classList.remove("su-chooser__checkbox--checked");
      cellEl.classList.remove("su-chooser__cell--checked");
    } else {
      checkedIds.add(id);
      checkboxEl.classList.add("su-chooser__checkbox--checked");
      cellEl.classList.add("su-chooser__cell--checked");
    }
    notifySelectionChange();
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

    const modal = document.createElement("div");
    modal.className = "su-chooser";
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    modal.setAttribute("aria-labelledby", titleId);
    if (helperId) {
      modal.setAttribute("aria-describedby", helperId);
    }

    const headerRow = document.createElement("div");
    headerRow.className = "su-chooser__header";

    const heading = document.createElement("h3");
    heading.className = "su-chooser__title";
    heading.textContent = title;
    heading.id = titleId;

    const closeButton = document.createElement("button");
    closeButton.type = "button";
    closeButton.className = "su-chooser__close";
    closeButton.textContent = "\u2715";
    closeButton.setAttribute("aria-label", "Close chooser");
    closeButton.addEventListener("click", closeModal);

    headerRow.appendChild(heading);
    headerRow.appendChild(closeButton);

    grid = document.createElement("div");
    grid.className = "su-chooser__grid su-chooser__grid--checkbox";
    grid.setAttribute("role", "grid");
    grid.setAttribute("aria-labelledby", titleId);
    if (helperId) {
      grid.setAttribute("aria-describedby", helperId);
    }

    const footer = document.createElement("div");
    footer.className = "su-chooser__footer";

    const okayButton = document.createElement("button");
    okayButton.type = "button";
    okayButton.className = "su-chooser__okay-btn";
    okayButton.textContent = "Okay";
    okayButton.addEventListener("click", () => {
      onConfirm(Array.from(checkedIds).sort((a, b) => a - b));
      closeModal();
    });

    footer.appendChild(okayButton);

    modal.appendChild(headerRow);
    if (description) {
      const helper = document.createElement("p");
      helper.className = "su-chooser__helper";
      helper.textContent = description;
      helper.id = helperId;
      modal.appendChild(helper);
    }
    modal.appendChild(grid);
    modal.appendChild(footer);
    backdrop.appendChild(modal);
    document.body.appendChild(backdrop);
  }

  function renderGrid() {
    if (!grid) return;

    grid.innerHTML = "";

    if (!currentSquares.length) {
      const empty = document.createElement("p");
      empty.className = "su-chooser__empty";
      empty.textContent = "No squares found for this filter.";
      grid.appendChild(empty);
      return;
    }

    const fragment = document.createDocumentFragment();
    currentSquares.forEach((id) => {
      const cell = document.createElement("button");
      cell.type = "button";
      cell.className = "su-chooser__cell su-chooser__cell--checkbox";

      const checkbox = document.createElement("span");
      checkbox.className = "su-chooser__checkbox";
      if (checkedIds.has(id)) {
        checkbox.classList.add("su-chooser__checkbox--checked");
        cell.classList.add("su-chooser__cell--checked");
      }

      const label = document.createElement("span");
      label.textContent = `#${id}`;

      cell.appendChild(checkbox);
      cell.appendChild(label);

      cell.addEventListener("click", () => {
        toggleCheckbox(id, checkbox, cell);
      });

      fragment.appendChild(cell);
    });

    grid.appendChild(fragment);
  }

  async function openModal() {
    try {
      const squares = await getSquares();
      currentSquares = Array.from(new Set(squares)).sort((a, b) => a - b);
      checkedIds = new Set((getSelectedIds && getSelectedIds()) || []);

      ensureModal();
      renderGrid();

      if (backdrop) {
        backdrop.classList.add("is-open");
        trigger.setAttribute("aria-expanded", "true");
      }
      document.addEventListener("keydown", handleEscape);
      onOpen();
    } catch (error) {
      alert(error?.message || "Failed to load squares");
    }
  }

  trigger.addEventListener("click", (event) => {
    event.preventDefault();
    openModal();
  });

  return {
    open: openModal,
    close: closeModal,
    getSelectedIds: () => Array.from(checkedIds).sort((a, b) => a - b),
  };
}
