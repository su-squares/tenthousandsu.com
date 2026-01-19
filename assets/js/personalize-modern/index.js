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
import { ensureOwnershipLoaded } from "./ownership.js";
import {
  clearOverLimitFlags,
  createValidationController,
  resetOverLimitFlags,
  setOverLimitFlag,
} from "./validation/index.js";
import { createBatchApplier, initBatchControls } from "./batch/index.js";
import { initPersonalizeTx } from "./tx.js";
import { initPersonalizeBillboardUi } from "./billboard.js";

function initPage() {
  const tableBody = document.getElementById("personalize-table-body");
  const gutterBody = document.getElementById("personalize-table-gutter");
  const wrapper = document.querySelector(".personalize-table__wrapper");
  const openChooserButton = document.getElementById("open-square-chooser");
  const showOwnedButton = document.getElementById("billboard-show-owned");
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
  const BUTTON_LOADING_DELAY_MS = 200;
  const BUTTON_LOADING_COUNT_THRESHOLD = 50;

  if (!tableBody || !gutterBody || !wrapper || !personalizeButton || !txFixtureDiv) {
    return;
  }

  const store = createPersonalizeStore({ initialRows: 1 });
  const defaultChooserText = openChooserButton?.textContent || "Choose Squares";
  const defaultShowOwnedText = showOwnedButton?.textContent || "Show my Squares";
  const defaultPersonalizeText = personalizeButton?.textContent || "Personalize";
  const defaultChooserDisabled = openChooserButton?.disabled ?? false;
  const defaultShowOwnedDisabled = showOwnedButton?.disabled ?? false;
  const defaultPersonalizeDisabled = personalizeButton?.disabled ?? false;
  let ownershipButtonsLoading = false;
  let ownershipButtonTimer = null;
  let personalizeLoading = false;

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
        store.setRowError(rowId, "title", "Title is too long.");
        if (setOverLimitFlag(rowId, "title", true)) {
          alert("Title is too long, please try again.");
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

  const handleRowLocate = (rowId) => {
    const state = store.getState();
    const current = state.locatorRowId;
    if (current === rowId) {
      store.setLocatorRow(null);
      return;
    }
    const row = state.rows.find((item) => item.id === rowId);
    if (!row || !isValidSquareId(row.squareId)) {
      return;
    }
    store.setLocatorRow(rowId);
  };

  const table = createPersonalizeTable({
    store,
    tableBody,
    gutterBody,
    wrapper,
    onFieldInput: handleFieldInput,
    onRowDelete: handleRowDelete,
    onRowLocate: handleRowLocate,
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

  initPersonalizeBillboardUi({
    store,
    validateSquareErrors,
    clearOverLimitFlags,
  });

  const formatCountLabel = (progressValue, totalValue) => {
    const total = Number.isFinite(totalValue) ? totalValue : null;
    const progress = Number.isFinite(progressValue) ? progressValue : 0;
    if (total !== null && total > 0) {
      const capped = Math.min(progress, total);
      return `(${capped}/${total})`;
    }
    if (progress > 0) return `(${progress})`;
    return "";
  };

  const formatOwnershipCount = (state) =>
    formatCountLabel(state.ownershipProgress, state.ownershipTotal);
  const formatTxCount = (state) =>
    formatCountLabel(state.txOwnershipProgress, state.txOwnershipTotal);

  const buildLoadingMarkup = (countLabel = "") => {
    const countMarkup = countLabel
      ? `<span class="personalize-billboard__loading-count">${countLabel}</span>`
      : "";
    return `Fetching Squares<span class="personalize-billboard__loading-dots" aria-hidden="true">...</span>${countMarkup}`;
  };

  const setOwnershipButtonsLoading = (loading, countLabel = "") => {
    if (loading === ownershipButtonsLoading) {
      if (loading) {
        const markup = buildLoadingMarkup(countLabel);
        if (openChooserButton) {
          openChooserButton.innerHTML = markup;
        }
        if (showOwnedButton) {
          showOwnedButton.innerHTML = markup;
        }
      }
      return;
    }
    ownershipButtonsLoading = loading;

    if (openChooserButton) {
      openChooserButton.disabled = loading || defaultChooserDisabled;
      if (loading) {
        openChooserButton.innerHTML = buildLoadingMarkup(countLabel);
      } else {
        openChooserButton.textContent = defaultChooserText;
      }
    }

    if (showOwnedButton) {
      showOwnedButton.disabled = loading || defaultShowOwnedDisabled;
      if (loading) {
        showOwnedButton.innerHTML = buildLoadingMarkup(countLabel);
      } else {
        showOwnedButton.textContent = defaultShowOwnedText;
      }
    }
  };

  const setPersonalizeButtonLoading = (loading, countLabel = "") => {
    if (loading === personalizeLoading) {
      if (loading && personalizeButton) {
        personalizeButton.innerHTML = buildLoadingMarkup(countLabel);
      }
      return;
    }
    personalizeLoading = loading;

    if (personalizeButton) {
      personalizeButton.disabled = loading || defaultPersonalizeDisabled;
      if (loading) {
        personalizeButton.innerHTML = buildLoadingMarkup(countLabel);
      } else {
        personalizeButton.textContent = defaultPersonalizeText;
      }
    }
  };

  const clearOwnershipButtonTimer = () => {
    if (ownershipButtonTimer) {
      window.clearTimeout(ownershipButtonTimer);
      ownershipButtonTimer = null;
    }
  };

  const updateOwnershipButtons = (state) => {
    const loading = state.ownershipStatus === "loading";
    const total = Number.isFinite(state.ownershipTotal) ? state.ownershipTotal : null;
    const showImmediately = loading && total !== null && total > BUTTON_LOADING_COUNT_THRESHOLD;
    const countLabel = formatOwnershipCount(state);

    if (!loading) {
      clearOwnershipButtonTimer();
      setOwnershipButtonsLoading(false);
      return;
    }

    if (showImmediately) {
      clearOwnershipButtonTimer();
      setOwnershipButtonsLoading(true, countLabel);
      return;
    }

    if (ownershipButtonsLoading) {
      setOwnershipButtonsLoading(true, countLabel);
      return;
    }
    if (ownershipButtonTimer) return;
    ownershipButtonTimer = window.setTimeout(() => {
      ownershipButtonTimer = null;
      if (store.getState().ownershipStatus === "loading") {
        setOwnershipButtonsLoading(true, formatOwnershipCount(store.getState()));
      }
    }, BUTTON_LOADING_DELAY_MS);
  };

  const updatePersonalizeButton = (state) => {
    const isTxLoading = state.txOwnershipStatus === "loading";
    const isOwnershipLoading = state.ownershipStatus === "loading";
    const loading = isTxLoading || isOwnershipLoading;
    const txTotal = Number.isFinite(state.txOwnershipTotal) ? state.txOwnershipTotal : null;
    const ownershipTotal = Number.isFinite(state.ownershipTotal) ? state.ownershipTotal : null;
    const ownershipContext = state.ownershipRequestContext;
    const showTxCount =
      isTxLoading && txTotal !== null && txTotal > BUTTON_LOADING_COUNT_THRESHOLD;
    const showOwnershipCount =
      isOwnershipLoading &&
      ownershipTotal !== null &&
      ownershipTotal > BUTTON_LOADING_COUNT_THRESHOLD &&
      ownershipContext &&
      ownershipContext !== "personalize";
    const countLabel = showTxCount
      ? formatTxCount(state)
      : showOwnershipCount
        ? formatOwnershipCount(state)
        : "";

    if (!loading || (!showTxCount && !showOwnershipCount)) {
      setPersonalizeButtonLoading(false);
      return;
    }

    if (personalizeLoading) {
      setPersonalizeButtonLoading(true, countLabel);
      return;
    }
    setPersonalizeButtonLoading(true, countLabel);
  };

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

  if (showOwnedButton) {
    showOwnedButton.addEventListener("click", () => {
      ensureOwnershipLoaded({
        store,
        requireConnection: true,
        source: "show",
      }).catch(() => {});
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

  store.subscribe((state) => {
    updateOwnershipButtons(state);
    updatePersonalizeButton(state);
  });
  updateOwnershipButtons(store.getState());
  updatePersonalizeButton(store.getState());

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
