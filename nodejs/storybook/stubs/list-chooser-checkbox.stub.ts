import { loadSquareData } from "./square-data.stub";

export interface CheckboxListChooserFilterContext {
  personalization: unknown;
  extra: unknown;
}

export interface AttachCheckboxListChooserOptions {
  input: HTMLInputElement | null;
  trigger: HTMLElement | null;
  filter?: (id: number, ctx: CheckboxListChooserFilterContext) => boolean;
  onSelectionChange?: (ids: number[]) => void;
  title?: string;
  description?: string;
}

interface InternalSquare {
  id: number;
  personalization: unknown;
  extra: unknown;
}

// ---- Module-level singleton state ----

let backdrop: HTMLDivElement | null = null;
let grid: HTMLDivElement | null = null;
let cachedSquares: InternalSquare[] | null = null;

// Persistent selection state - survives open/close
const checkedIds = new Set<number>();

let currentOnSelectionChange: (ids: number[]) => void = () => {};
let currentTitle = "Select Squares then press okay";
let currentDescription = "";
let currentFilter: (id: number, ctx: CheckboxListChooserFilterContext) => boolean = () => true;

const triggerHandlers = new WeakMap<HTMLElement, (event: MouseEvent) => void>();

// ---- Core helpers ----

function closeModal() {
  if (backdrop) {
    backdrop.classList.remove("is-open");
    document.removeEventListener("keydown", handleEscape);
  }
}

function handleEscape(event: KeyboardEvent) {
  if (event.key === "Escape") {
    closeModal();
  }
}

function notifySelectionChange() {
  currentOnSelectionChange(Array.from(checkedIds).sort((a, b) => a - b));
}

function toggleCheckbox(id: number, checkboxEl: HTMLSpanElement, cellEl: HTMLButtonElement) {
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
  heading.textContent = currentTitle;

  const helper = document.createElement("p");
  helper.className = "su-chooser__helper";
  helper.textContent = currentDescription;

  const closeButton = document.createElement("button");
  closeButton.type = "button";
  closeButton.className = "su-chooser__close";
  closeButton.textContent = "×";
  closeButton.setAttribute("aria-label", "Close chooser");
  closeButton.addEventListener("click", closeModal);

  grid = document.createElement("div");
  grid.className = "su-chooser__grid su-chooser__grid--checkbox";
  grid.setAttribute("role", "grid");

  const footer = document.createElement("div");
  footer.className = "su-chooser__footer";

  const okayButton = document.createElement("button");
  okayButton.type = "button";
  okayButton.className = "su-chooser__okay-btn";
  okayButton.textContent = "Okay";
  okayButton.addEventListener("click", closeModal);
  footer.appendChild(okayButton);

  const headerRow = document.createElement("div");
  headerRow.className = "su-chooser__header";
  headerRow.appendChild(heading);
  headerRow.appendChild(closeButton);

  modal.appendChild(headerRow);
  if (currentDescription) {
    modal.appendChild(helper);
  }
  modal.appendChild(grid);
  modal.appendChild(footer);
  backdrop.appendChild(modal);
  document.body.appendChild(backdrop);
}

function renderGrid(allSquares: InternalSquare[]) {
  if (!grid) return;

  grid.innerHTML = "";

  const filtered = allSquares.filter((sq) =>
    currentFilter(sq.id, {
      personalization: sq.personalization,
      extra: sq.extra
    })
  );

  if (!filtered.length) {
    const empty = document.createElement("p");
    empty.className = "su-chooser__empty";
    empty.textContent = "No squares found for this filter.";
    grid.appendChild(empty);
    return;
  }

  const fragment = document.createDocumentFragment();
  filtered.forEach((sq) => {
    const cell = document.createElement("button");
    cell.type = "button";
    cell.className = "su-chooser__cell su-chooser__cell--checkbox";

    const checkbox = document.createElement("span");
    checkbox.className = "su-chooser__checkbox";
    if (checkedIds.has(sq.id)) {
      checkbox.classList.add("su-chooser__checkbox--checked");
      cell.classList.add("su-chooser__cell--checked");
    }

    const label = document.createElement("span");
    label.textContent = `#${sq.id}`;

    cell.appendChild(checkbox);
    cell.appendChild(label);

    cell.addEventListener("click", () => {
      toggleCheckbox(sq.id, checkbox, cell);
    });

    fragment.appendChild(cell);
  });

  grid.appendChild(fragment);
}

async function getSquares(): Promise<InternalSquare[]> {
  if (cachedSquares) return cachedSquares;

  const { personalizations, extra } = await loadSquareData();
  const squares: InternalSquare[] = [];
  const length = personalizations.length;

  for (let i = 1; i <= length; i++) {
    squares.push({
      id: i,
      personalization: personalizations[i - 1],
      extra: extra[i - 1]
    });
  }

  cachedSquares = squares;
  return squares;
}

async function openModal() {
  try {
    const squares = await getSquares();
    ensureModal();
    // Update title/description in case they changed with a new config
    if (backdrop && grid) {
      const titleNode = backdrop.querySelector<HTMLHeadingElement>(
        ".su-chooser__title"
      );
      const helperNode = backdrop.querySelector<HTMLParagraphElement>(
        ".su-chooser__helper"
      );

      if (titleNode) {
        titleNode.textContent = currentTitle;
      }
      if (helperNode) {
        helperNode.textContent = currentDescription;
      }
    }
    renderGrid(squares);
    if (backdrop) {
      backdrop.classList.add("is-open");
    }
    document.addEventListener("keydown", handleEscape);
  } catch (error: unknown) {
    const message =
      error && typeof error === "object" && "message" in error
        ? (error as { message?: string }).message || "Failed to load squares"
        : "Failed to load squares";
    alert(message);
  }
}

// ---- Public Storybook-only entry point ----

export function attachCheckboxListChooserWithStubData(options: AttachCheckboxListChooserOptions) {
  const { input, trigger } = options;
  if (!trigger) {
    return;
  }

  currentOnSelectionChange = options.onSelectionChange ?? (() => {});
  currentTitle = options.title ?? "Select squares then press okay";
  currentDescription = options.description ?? "";

  currentFilter =
    options.filter ??
    (() => {
      return true;
    });

  // Rebind click handler so changing Storybook controls reconfigures behavior
  const previousHandler = triggerHandlers.get(trigger);
  if (previousHandler) {
    trigger.removeEventListener("click", previousHandler);
  }

  const handler = () => {
    void openModal();
  };

  triggerHandlers.set(trigger, handler);
  trigger.addEventListener("click", handler);

  return {
    open: () => {
      void openModal();
    },
    close: () => {
      closeModal();
    },
    getSelectedIds: () => Array.from(checkedIds).sort((a, b) => a - b),
    clearSelection: () => {
      checkedIds.clear();
      notifySelectionChange();
    }
  };
}
