import { loadSquareData } from "./square-data.stub";

export interface ListChooserFilterContext {
  personalization: unknown;
  extra: unknown;
}

export interface AttachListChooserOptions {
  input: HTMLInputElement | null;
  trigger: HTMLElement | null;
  filter?: (id: number, ctx: ListChooserFilterContext) => boolean;
  onSelect?: (id: number) => void;
  title?: string;
  description?: string;
  updateInput?: boolean;
}

interface InternalSquare {
  id: number;
  personalization: unknown;
  extra: unknown;
}

// ---- Module-level singleton state so Storybook controls can reconfigure it ----

let backdrop: HTMLDivElement | null = null;
let grid: HTMLDivElement | null = null;
let cachedSquares: InternalSquare[] | null = null;

let currentInput: HTMLInputElement | null = null;
let currentOnSelect: (id: number) => void = () => {};
let currentUpdateInput = true;
let currentTitle = "Choose a Square (stub data)";
let currentDescription = "";

let currentFilter: (id: number, ctx: ListChooserFilterContext) => boolean = () => true;

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
  grid.className = "su-chooser__grid";
  grid.setAttribute("role", "grid");

  const headerRow = document.createElement("div");
  headerRow.className = "su-chooser__header";
  headerRow.appendChild(heading);
  headerRow.appendChild(closeButton);

  modal.appendChild(headerRow);
  if (currentDescription) {
    modal.appendChild(helper);
  }
  modal.appendChild(grid);
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
    cell.className = "su-chooser__cell";
    cell.textContent = `#${sq.id}`;
    cell.addEventListener("click", () => {
      if (currentUpdateInput && currentInput) {
        currentInput.value = String(sq.id);
        currentInput.dispatchEvent(new Event("input", { bubbles: true }));
      }
      currentOnSelect(sq.id);
      closeModal();
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

export function attachListChooserWithStubData(options: AttachListChooserOptions) {
  const { input, trigger } = options;
  if (!input || !trigger) {
    return;
  }

  currentInput = input;
  currentOnSelect = options.onSelect ?? (() => {});
  currentUpdateInput =
    typeof options.updateInput === "boolean" ? options.updateInput : true;
  currentTitle = options.title ?? "Choose a Square (stub data)";
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
    }
  };
}
