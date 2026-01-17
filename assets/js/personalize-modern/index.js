import { loadWeb3 } from "../../web3/foundation.js";
import {
  createPersonalizeStore,
  getTitleLength,
  getUriLength,
  isRowEmpty,
  isValidSquareId,
} from "./store.js";
import { createPersonalizeTable } from "./table.js";
import { initPersonalizeChooser } from "./chooser.js";
import { TITLE_MAX, URI_MAX } from "./constants.js";
import { parseSquareInput } from "./utils.js";
import {
  clearOverLimitFlags,
  createValidationController,
  resetOverLimitFlags,
  setOverLimitFlag,
} from "./validation/index.js";
import { createBatchApplier, initBatchControls } from "./batch/index.js";
import { initPersonalizeTx } from "./tx.js";

function initPage() {
  const tableBody = document.getElementById("personalize-table-body");
  const gutterBody = document.getElementById("personalize-table-gutter");
  const wrapper = document.querySelector(".personalize-table__wrapper");
  const openChooserButton = document.getElementById("open-square-chooser");
  const resetButton = document.getElementById("reset-all");
  const addRowButton = document.getElementById("add-row");
  const csvBatchDropdown = document.getElementById("csv-batch-dropdown");
  const csvBatchTrigger = document.getElementById("csv-batch-trigger");
  const csvBatchInstructions = document.getElementById("csv-batch-instructions");
  const csvBatchDownload = document.getElementById("csv-batch-download");
  const csvBatchUpload = document.getElementById("csv-batch-upload");
  const imageBatchDropdown = document.getElementById("image-batch-dropdown");
  const imageBatchTrigger = document.getElementById("image-batch-trigger");
  const imageBatchInstructions = document.getElementById("image-batch-instructions");
  const imageBatchUpload = document.getElementById("image-batch-upload");
  const openWalletButton = document.getElementById("open-wallet-app");
  const personalizeButton = document.getElementById("personalize");
  const txFixtureDiv = document.getElementById("tx-fixture");

  if (!tableBody || !gutterBody || !wrapper || !personalizeButton || !txFixtureDiv) {
    return;
  }

  const store = createPersonalizeStore({ initialRows: 1 });

  const { validateSquareErrors, validateForSubmit, markOwnershipErrorsFromTx } =
    createValidationController({
      store,
      isValidSquareId,
      isRowEmpty,
      getTitleLength,
      getUriLength,
      titleMax: TITLE_MAX,
      uriMax: URI_MAX,
    });

  const applyBatchRows = createBatchApplier({
    store,
    clearOverLimitFlags,
    validateSquareErrors,
  });

  initBatchControls({
    store,
    isValidSquareId,
    applyBatchRows,
    elements: {
      csvBatchDropdown,
      csvBatchTrigger,
      csvBatchInstructions,
      csvBatchDownload,
      csvBatchUpload,
      imageBatchDropdown,
      imageBatchTrigger,
      imageBatchInstructions,
      imageBatchUpload,
    },
  });

  const handleFieldInput = (rowId, field, value) => {
    if (field === "square") {
      const squareId = parseSquareInput(value);
      store.updateRow(rowId, { squareId });
      validateSquareErrors(false);
      return;
    }

    if (field === "title") {
      store.updateRow(rowId, { title: value });
      const row = store.getState().rows.find((item) => item.id === rowId);
      const length = row ? getTitleLength(row) : 0;
      if (length > TITLE_MAX) {
        store.setRowError(rowId, "title", "Text is too long.");
        if (setOverLimitFlag(rowId, "title", true)) {
          alert("Text is too long, please try again.");
        }
      } else {
        store.setRowError(rowId, "title", "");
        setOverLimitFlag(rowId, "title", false);
      }
      return;
    }

    if (field === "uri") {
      store.updateRow(rowId, { uri: value });
      const row = store.getState().rows.find((item) => item.id === rowId);
      const length = row ? getUriLength(row) : 0;
      if (length > URI_MAX) {
        store.setRowError(rowId, "uri", "URI is too long.");
        if (setOverLimitFlag(rowId, "uri", true)) {
          alert("URI is too long, please try again.");
        }
      } else {
        store.setRowError(rowId, "uri", "");
        setOverLimitFlag(rowId, "uri", false);
      }
    }
  };

  const handleRowDelete = (rowId) => {
    store.removeRow(rowId);
    clearOverLimitFlags(rowId);
    validateSquareErrors(false);
  };

  const table = createPersonalizeTable({
    store,
    tableBody,
    gutterBody,
    wrapper,
    onFieldInput: handleFieldInput,
    onRowDelete: handleRowDelete,
  });

  const syncSelectionToRows = (selectedIds) => {
    const selected = new Set(selectedIds);
    const state = store.getState();
    const existing = new Set(
      state.rows
        .map((row) => row.squareId)
        .filter((id) => isValidSquareId(id))
    );
    const selectionsMatch =
      selected.size === existing.size &&
      Array.from(selected).every((id) => existing.has(id));

    if (selectionsMatch) {
      return false;
    }

    state.rows.forEach((row) => {
      if (isValidSquareId(row.squareId) && !selected.has(row.squareId)) {
        store.removeRow(row.id);
      }
    });

    selected.forEach((id) => {
      if (!existing.has(id)) {
        store.addRow({ squareId: id });
      }
    });

    validateSquareErrors(false);
    return true;
  };

  initPersonalizeChooser({
    store,
    trigger: openChooserButton,
    onConfirm: (ids) => {
      const changed = syncSelectionToRows(ids);
      if (changed) {
        store.sortRows();
      }
    },
    onOwnershipReady: () => validateSquareErrors(false),
  });

  if (resetButton) {
    resetButton.addEventListener("click", () => {
      store.resetRowsKeepFirst();
      resetOverLimitFlags();
      validateSquareErrors(false);
    });
  }

  if (addRowButton) {
    addRowButton.addEventListener("click", () => {
      store.addRow();
      validateSquareErrors(false);
    });
  }

  initPersonalizeTx({
    store,
    personalizeButton,
    openWalletButton,
    txFixtureDiv,
    validateForSubmit,
    validateSquareErrors,
    markOwnershipErrorsFromTx,
  });

  loadWeb3().catch(() => {});

  window.personalizeModern = {
    getRows: () =>
      store.getState().rows.map((row) => ({
        id: row.id,
        squareId: row.squareId,
        title: row.title,
        uri: row.uri,
        imagePixelsHex: row.imagePixelsHex,
        imagePreviewUrl: row.imagePreviewUrl,
      })),
    ensureRowForSquare: (squareId) => {
      if (!isValidSquareId(squareId)) return;
      store.ensureRowForSquare(squareId);
      store.sortRows();
      validateSquareErrors(false);
    },
    highlightRowBySquare: (squareId) => {
      const state = store.getState();
      const row = state.rows.find((item) => item.squareId === squareId);
      if (row) {
        store.highlightRow(row.id);
        table.scrollToRow(row.id);
      }
    },
    subscribe: (handler) => {
      if (typeof handler !== "function") return () => {};
      return store.subscribe(() => handler(window.personalizeModern.getRows()));
    },
  };
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initPage);
} else {
  initPage();
}
