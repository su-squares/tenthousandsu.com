import type { Meta, StoryObj } from "@storybook/html";
import "@assets/css/main.css";
import "@assets/css/personalize.css";
import "@assets/css/personalize-modern/base.css";
import "@assets/css/personalize-modern/table.css";
import {
  createPersonalizeStore,
  isValidSquareId,
} from "@assets/js/personalize-modern/store.js";
import { createPersonalizeTable } from "@assets/js/personalize-modern/table/index.js";
import { parseSquareInput } from "@assets/js/personalize-modern/utils.js";

type Story = StoryObj;

const meta: Meta = {
  title: "Personalize Modern/Table",
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
  },
};

export default meta;

type PersonalizeTableArgs = {
  store: ReturnType<typeof createPersonalizeStore>;
  tableBody: HTMLTableSectionElement;
  gutterBody: HTMLDivElement;
  wrapper: HTMLDivElement;
  onFieldInput?: (rowId: string, field: string, value: string) => void;
  onFieldBlur?: (rowId: string, field: string, value: string) => void;
  onRowDelete?: (rowId: string) => void;
  onRowLocate?: (rowId: string) => void;
};

const createPersonalizeTableTyped = createPersonalizeTable as unknown as (
  args: PersonalizeTableArgs
) => ReturnType<typeof createPersonalizeTable>;

const ROOT_ID = "sb-personalize-table-root";
const PREVIEW_SVG = encodeURIComponent(
  "<svg xmlns='http://www.w3.org/2000/svg' width='10' height='10'><rect width='10' height='10' fill='#39ff14'/></svg>"
);
const PREVIEW_URL = `data:image/svg+xml;utf8,${PREVIEW_SVG}`;

function renderTable() {
  return `
    <div
      id="${ROOT_ID}"
      class="personalize-page personalize-modern-page"
      style="padding: 2rem 1.5rem; min-height: 100vh;"
    >
      <section class="personalize-table-section">
        <div class="personalize-table__wrapper" style="max-width: 1000px; margin: 0 auto;">
          <div class="personalize-table__gutter" aria-hidden="true">
            <div class="personalize-table__gutter-header"></div>
            <div class="personalize-table__gutter-body" id="personalize-table-gutter"></div>
          </div>
          <table class="personalize-table__grid" id="personalize-table">
            <colgroup>
              <col style="width: 125px">
              <col>
              <col>
              <col>
            </colgroup>
            <thead>
              <tr>
                <th>Square #</th>
                <th>Title</th>
                <th>URI</th>
                <th>Image</th>
              </tr>
            </thead>
            <tbody id="personalize-table-body"></tbody>
          </table>
        </div>
      </section>
    </div>
  `;
}

function seedStore(store: ReturnType<typeof createPersonalizeStore>) {
  const rows = store.getState().rows;
  if (rows[0]) {
    store.updateRow(rows[0].id, {
      squareId: 101,
      title: "Dawn",
      uri: "https://example.com",
      imagePreviewUrl: PREVIEW_URL,
      imagePixelsHex: "0x",
    });
  }
  if (rows[1]) {
    store.updateRow(rows[1].id, {
      squareId: 202,
      title: "Longer Title Example",
      uri: "https://example.com/path",
    });
    store.setRowError(rows[1].id, "uri", "URI is too long.");
  }
  if (rows[2]) {
    store.updateRow(rows[2].id, {
      squareId: 303,
      title: "Needs Fix",
      uri: "",
    });
    store.setRowError(rows[2].id, "square", "Enter a square you own.");
  }

  if (rows[1]) {
    store.highlightRow(rows[1].id);
  }
  if (rows[0]) {
    store.setLocatorRow(rows[0].id);
  }
}

export const Default: Story = {
  render: () => renderTable(),
  play: async ({ canvasElement }) => {
    const root = canvasElement.querySelector<HTMLDivElement>(`#${ROOT_ID}`);
    if (!root) return;
    if (root.dataset.initialized === "true") return;
    root.dataset.initialized = "true";

    if (typeof window !== "undefined") {
      window.SITE_BASEURL = window.SITE_BASEURL || "";
    }

    const tableBody =
      canvasElement.querySelector<HTMLTableSectionElement>("#personalize-table-body");
    const gutterBody =
      canvasElement.querySelector<HTMLDivElement>("#personalize-table-gutter");
    const wrapper =
      canvasElement.querySelector<HTMLDivElement>(".personalize-table__wrapper");

    if (!tableBody || !gutterBody || !wrapper) return;

    const store = createPersonalizeStore({ initialRows: 3 });
    seedStore(store);

    const handleFieldInput = (rowId: string, field: string, value: string) => {
      if (field === "square") {
        store.updateRow(rowId, { squareId: parseSquareInput(value) });
        return;
      }
      if (field === "title") {
        store.updateRow(rowId, { title: value });
        return;
      }
      if (field === "uri") {
        store.updateRow(rowId, { uri: value });
      }
    };

    const handleFieldBlur = (rowId: string, field: string, value: string) => {
      if (field !== "square") return;
      const squareId = parseSquareInput(value);
      const message = isValidSquareId(squareId)
        ? ""
        : "Enter a number between 1 and 10000.";
      store.setRowError(rowId, "square", message);
    };

    const handleRowDelete = (rowId: string) => store.removeRow(rowId);

    const handleRowLocate = (rowId: string) => {
      const state = store.getState();
      if (state.locatorRowId === rowId) {
        store.setLocatorRow(null);
        return;
      }
      store.setLocatorRow(rowId);
    };

    createPersonalizeTableTyped({
      store,
      tableBody,
      gutterBody,
      wrapper,
      onFieldInput: handleFieldInput,
      onFieldBlur: handleFieldBlur,
      onRowDelete: handleRowDelete,
      onRowLocate: handleRowLocate,
    });
  },
};
