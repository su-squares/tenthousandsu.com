import type { Meta, StoryObj } from "@storybook/html";
import "@assets/css/main.css";
import "@assets/css/personalize.css";
import "@assets/css/personalize-modern/base.css";
import "@assets/css/personalize-modern/billboard.css";
import "@assets/billboard/billboard.css";
import { createPersonalizeStore } from "@assets/js/personalize-modern/store.js";
import { initPersonalizeBillboardUi } from "@assets/js/personalize-modern/billboard/index.js";

interface BillboardStoryArgs {
  selectionColor: string;
  selectedSquares: string;
  staticHighlights: boolean;
}

type Story = StoryObj<BillboardStoryArgs>;

const meta: Meta<BillboardStoryArgs> = {
  title: "Personalize Modern/Billboard",
  tags: ["autodocs"],
  args: {
    selectionColor: "#4aa3ff",
    selectedSquares: "128, 256, 512",
    staticHighlights: false,
  },
  argTypes: {
    selectionColor: {
      control: { type: "color" },
      description: "Glow color for selected squares.",
    },
    selectedSquares: {
      control: { type: "text" },
      description: "Comma-separated list of square IDs to highlight as selected.",
    },
    staticHighlights: {
      control: { type: "boolean" },
      description: "Toggle the static X fallback highlight instead of glow.",
    },
  },
  parameters: {
    layout: "fullscreen",
  },
};

export default meta;

const ROOT_ID = "sb-personalize-billboard-root";
const PREVIEW_SVG = encodeURIComponent(
  "<svg xmlns='http://www.w3.org/2000/svg' width='10' height='10'><rect width='10' height='10' fill='#ffd700'/></svg>"
);
const PREVIEW_URL = `data:image/svg+xml;utf8,${PREVIEW_SVG}`;

let billboardHandle: ReturnType<typeof initPersonalizeBillboardUi> | null = null;
let billboardStore: ReturnType<typeof createPersonalizeStore> | null = null;
let currentRoot: HTMLDivElement | null = null;

function renderBillboard() {
  return `
    <div
      id="${ROOT_ID}"
      class="personalize-page personalize-modern-page"
      style="padding: 2rem 1.5rem; min-height: 100vh;"
    >
      <section class="personalize-billboard">
        <div class="personalize-billboard__controls">
          <div class="personalize-billboard__controls-left">
            <button type="button" class="btn personalize-billboard__show-owned" id="billboard-show-owned">
              Show my Squares
            </button>
            <button type="button" class="btn personalize-billboard__update is-invisible" id="billboard-update" hidden disabled>
              Update
            </button>
          </div>
          <div class="personalize-billboard__controls-center">
            <button type="button" class="btn personalize-billboard__reset-all" id="billboard-reset-all">
              Reset all
            </button>
          </div>
          <div class="personalize-billboard__controls-right">
            <button type="button" class="btn personalize-billboard__cancel" id="billboard-cancel" hidden>
              Cancel
            </button>
            <button type="button" class="btn personalize-billboard__upload" id="billboard-upload">
              Upload Image
            </button>
          </div>
        </div>
        <div class="personalize-billboard__placement-panel" id="personalize-placement-controls" hidden>
          <div class="personalize-billboard__placement-coords">
            <div>Top-left: <span id="placement-top-left">--</span></div>
            <div>Top-right: <span id="placement-top-right">--</span></div>
            <div>Bottom-left: <span id="placement-bottom-left">--</span></div>
            <div>Bottom-right: <span id="placement-bottom-right">--</span></div>
          </div>
          <div class="personalize-billboard__placement-resize">
            <span>Resize:</span>
            <button type="button" class="personalize-billboard__resize-btn" id="placement-resize-minus" aria-label="Shrink image">
              -
            </button>
            <button type="button" class="personalize-billboard__resize-btn" id="placement-resize-plus" aria-label="Enlarge image">
              +
            </button>
          </div>
          <div class="personalize-billboard__placement-actions">
            <button type="button" class="btn" id="placement-accept" disabled>Accept</button>
            <button type="button" class="btn" id="placement-cancel">Cancel</button>
          </div>
        </div>
        <input type="file" id="placement-image-input" accept="image/*" hidden>
        <div class="personalize-billboard__view">
          <div id="personalize-billboard"></div>
          <div class="personalize-billboard__loading" id="placement-loading" hidden>
            <div class="personalize-billboard__loading-text" aria-live="polite">
              Adding images to table<span class="personalize-billboard__loading-dots" aria-hidden="true">...</span>
            </div>
          </div>
          <div class="personalize-billboard__loading" id="ownership-loading" hidden>
            <div class="personalize-billboard__loading-text" aria-live="polite">
              Fetching Squares<span class="personalize-billboard__loading-dots" aria-hidden="true">...</span>
              <span class="personalize-billboard__loading-count" id="ownership-loading-count"></span>
            </div>
          </div>
          <button type="button" class="personalize-billboard__locator-btn" id="billboard-locator-hide" hidden>
            <img src="/assets/images/dr.png" alt="" aria-hidden="true">
            Hide
          </button>
        </div>
        <button type="button" class="billboard__reset-btn personalize-billboard__reset" id="personalize-billboard-reset">
          Reset zoom
        </button>
        <div class="personalize-billboard__mode-row">
          <div class="personalize-billboard__mode" role="group" aria-label="Billboard mode">
            <button type="button" class="personalize-billboard__mode-btn is-active" data-mode="owned" aria-pressed="true">
              Owned
            </button>
            <button type="button" class="personalize-billboard__mode-btn" data-mode="preview" aria-pressed="false">
              Preview
            </button>
          </div>
          <label class="personalize-billboard__toggle" id="preview-tooltips-toggle-label">
            <input type="checkbox" id="preview-tooltips-toggle">
            <span class="personalize-billboard__toggle-box" aria-hidden="true"></span>
            <span class="personalize-billboard__toggle-text">Preview Tooltips</span>
          </label>
        </div>
        <p class="billboard__mobile-hint personalize-billboard__hint">Pinch to zoom, drag to pan.</p>
      </section>
    </div>
  `;
}

function seedStore(store: ReturnType<typeof createPersonalizeStore>) {
  const rows = store.getState().rows;
  if (rows[0]) {
    store.updateRow(rows[0].id, {
      squareId: 128,
      title: "Golden Hour",
      uri: "https://example.com",
      imagePreviewUrl: PREVIEW_URL,
      imagePixelsHex: "0x",
    });
  }
  if (rows[1]) {
    store.updateRow(rows[1].id, {
      squareId: 256,
      title: "Soft Gradient",
      uri: "",
    });
  }
  if (rows[2]) {
    store.updateRow(rows[2].id, {
      squareId: 512,
      title: "Needs Review",
      uri: "https://example.com/review",
    });
    store.setRowError(rows[2].id, "title", "Title is too long.");
  }

  if (rows[1]) {
    store.setLocatorRow(rows[1].id);
  }
}

function parseSelectedSquares(value: string) {
  if (!value) return [];
  const ids = value
    .split(/[^0-9]+/)
    .map((token) => Number.parseInt(token, 10))
    .filter((id) => Number.isInteger(id) && id >= 1 && id <= 10000);
  return Array.from(new Set(ids));
}

function applySelectedSquares(
  store: ReturnType<typeof createPersonalizeStore>,
  squares: number[]
) {
  const desiredCount = Math.max(1, squares.length);

  store.batch(() => {
    while (store.getState().rows.length < desiredCount) {
      store.addRow();
    }
    while (store.getState().rows.length > desiredCount) {
      const rows = store.getState().rows;
      const rowToRemove = rows[rows.length - 1];
      if (!rowToRemove) break;
      store.removeRow(rowToRemove.id);
    }

    const rows = store.getState().rows;
    rows.forEach((row, index) => {
      const squareId = squares[index] ?? null;
      store.updateRow(row.id, { squareId });
      store.clearRowErrors(row.id);
    });
  });
}

function applySelectionColor(color: string) {
  if (typeof document === "undefined") return;
  const next = color?.trim() || "#4aa3ff";
  document.documentElement.style.setProperty("--billboard-glow-selected", next);
}

function applyStaticMode(enabled: boolean) {
  billboardHandle?.controller?.setGlowEnabled?.(!enabled);
}

function ensureInitialized(root: HTMLDivElement) {
  if (billboardHandle && billboardStore && currentRoot === root) return;

  billboardHandle?.controller?.destroy?.();
  billboardHandle = null;
  billboardStore = createPersonalizeStore({ initialRows: 3 });
  seedStore(billboardStore);
  currentRoot = root;

  billboardHandle = initPersonalizeBillboardUi({
    store: billboardStore,
    validateSquareErrors: () => {},
    clearOverLimitFlags: () => {},
    onResetAll: () => billboardStore?.resetRowsKeepFirst(),
    alertFn: (message) => {
      // eslint-disable-next-line no-console
      console.log("Billboard story alert:", message);
    },
  });
}

export const Default: Story = {
  render: (args) => {
    const container = document.createElement("div");
    container.innerHTML = renderBillboard();
    const root = container.querySelector<HTMLDivElement>(`#${ROOT_ID}`);

    if (root) {
      requestAnimationFrame(() => {
        if (!root.isConnected) return;

        if (typeof window !== "undefined") {
          window.SITE_BASEURL = window.SITE_BASEURL || "";
        }

        applySelectionColor(args.selectionColor);
        ensureInitialized(root);
        billboardHandle?.controller?.refreshGlowColors?.();
        applyStaticMode(args.staticHighlights);

        if (billboardStore) {
          applySelectedSquares(
            billboardStore,
            parseSelectedSquares(args.selectedSquares)
          );
        }
      });
    }

    return container;
  },
};
