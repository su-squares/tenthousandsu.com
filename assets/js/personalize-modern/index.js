import { loadWeb3 } from "../../web3/foundation.js";
import {
  createPersonalizeStore,
  getTitleLength,
  getUriLength,
  isRowEmpty,
  isValidSquareId,
} from "./store.js";
import { createPersonalizeTable } from "./table/index.js";
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
import { initPersonalizeBillboardUi } from "./billboard/index.js";

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
  const SQUARE_VALIDATE_DELAY_MS = 200;
  const SQUARE_VALIDATE_IDLE_TIMEOUT_MS = 1200;
  const DEFER_INPUT_THRESHOLD = 200;
  let squareValidationTimer = null;
  const pendingEdits = new Map();
  const commitQueue = new Set();
  let commitTimer = null;
  let pendingSquareValidation = false;
  let squareValidationHandle = null;
  let squareValidationHandleType = null;

  const getInitialSquareId = () => {
    const params = new URLSearchParams(window.location.search);
    if (!params.has("square")) return null;
    const parsed = parseSquareInput(params.get("square"));
    return isValidSquareId(parsed) ? parsed : null;
  };

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

  const initialSquareId = getInitialSquareId();
  if (initialSquareId !== null) {
    const firstRow = store.getState().rows[0];
    if (firstRow) {
      store.updateRow(firstRow.id, { squareId: initialSquareId });
      validateSquareErrors(false);
    }
  }

  const applyBatchRows = createBatchApplier({
    store,
    clearOverLimitFlags,
    validateSquareErrors,
  });

  initBatchControls({
    store,
    isValidSquareId,
    applyBatchRows,
    overlayMount: wrapper,
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

  const scheduleSquareValidation = () => {
    if (squareValidationTimer) {
      window.clearTimeout(squareValidationTimer);
    }
    squareValidationTimer = window.setTimeout(() => {
      squareValidationTimer = null;
      validateSquareErrors(false);
    }, SQUARE_VALIDATE_DELAY_MS);
  };

  const shouldDeferInput = () => store.getState().rows.length >= DEFER_INPUT_THRESHOLD;

  const clearSquareValidationHandle = () => {
    if (!squareValidationHandle) return;
    if (
      squareValidationHandleType === "idle" &&
      typeof window.cancelIdleCallback === "function"
    ) {
      window.cancelIdleCallback(squareValidationHandle);
    } else {
      window.clearTimeout(squareValidationHandle);
    }
    squareValidationHandle = null;
    squareValidationHandleType = null;
  };

  const scheduleSquareValidationDeferred = () => {
    if (!pendingSquareValidation || squareValidationHandle) return;
    const runValidation = () => {
      squareValidationHandle = null;
      squareValidationHandleType = null;
      if (!pendingSquareValidation) return;
      pendingSquareValidation = false;
      validateSquareErrors(false);
    };
    if (typeof window.requestIdleCallback === "function") {
      squareValidationHandleType = "idle";
      squareValidationHandle = window.requestIdleCallback(runValidation, {
        timeout: SQUARE_VALIDATE_IDLE_TIMEOUT_MS,
      });
    } else {
      squareValidationHandleType = "timeout";
      squareValidationHandle = window.setTimeout(
        runValidation,
        SQUARE_VALIDATE_IDLE_TIMEOUT_MS
      );
    }
  };

  const finalizeSquareValidation = ({ force = false, suppress = false } = {}) => {
    if (force) {
      clearSquareValidationHandle();
      pendingSquareValidation = false;
      validateSquareErrors(false);
      return;
    }
    if (suppress) {
      clearSquareValidationHandle();
      pendingSquareValidation = false;
      return;
    }
    if (!pendingSquareValidation) return;
    if (!shouldDeferInput()) {
      clearSquareValidationHandle();
      pendingSquareValidation = false;
      validateSquareErrors(false);
      return;
    }
    scheduleSquareValidationDeferred();
  };

  const setPendingEdit = (rowId, field, value) => {
    const pending = pendingEdits.get(rowId) || {};
    if (field === "square") {
      pending.squareId = value;
    } else if (field === "title") {
      pending.title = value;
    } else if (field === "uri") {
      pending.uri = value;
    }
    pendingEdits.set(rowId, pending);
  };

  const commitPendingEdits = (rowId) => {
    const pending = pendingEdits.get(rowId);
    if (!pending) return false;
    pendingEdits.delete(rowId);

    const existing = store.getState().rows.find((item) => item.id === rowId);
    if (!existing) return false;

    let squareChanged = false;
    if (Object.prototype.hasOwnProperty.call(pending, "squareId")) {
      squareChanged = existing.squareId !== pending.squareId;
    }

    store.batch(() => {
      const patch = {};
      if (Object.prototype.hasOwnProperty.call(pending, "squareId")) {
        patch.squareId = pending.squareId;
      }
      if (Object.prototype.hasOwnProperty.call(pending, "title")) {
        patch.title = pending.title;
      }
      if (Object.prototype.hasOwnProperty.call(pending, "uri")) {
        patch.uri = pending.uri;
      }
      if (Object.keys(patch).length > 0) {
        store.updateRow(rowId, patch);
      }

      const row = store.getState().rows.find((item) => item.id === rowId);
      if (!row) return;

      if (Object.prototype.hasOwnProperty.call(pending, "title")) {
        const length = getTitleLength(row);
        if (length > TITLE_MAX) {
          store.setRowError(rowId, "title", "Title is too long.");
          if (setOverLimitFlag(rowId, "title", true)) {
            alert("Title is too long, please try again.");
          }
        } else {
          store.setRowError(rowId, "title", "");
          setOverLimitFlag(rowId, "title", false);
        }
      }

      if (Object.prototype.hasOwnProperty.call(pending, "uri")) {
        const length = getUriLength(row);
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
    });

    return squareChanged;
  };

  const flushCommitQueue = ({ forceValidate = false, suppressDeferred = false } = {}) => {
    if (commitTimer) {
      window.clearTimeout(commitTimer);
      commitTimer = null;
    }

    if (commitQueue.size === 0) {
      finalizeSquareValidation({ force: forceValidate, suppress: suppressDeferred });
      return;
    }

    const rowIds = Array.from(commitQueue);
    commitQueue.clear();
    let needsSquareValidation = false;

    rowIds.forEach((rowId) => {
      if (commitPendingEdits(rowId)) {
        needsSquareValidation = true;
      }
    });

    if (needsSquareValidation) {
      pendingSquareValidation = true;
    }

    finalizeSquareValidation({ force: forceValidate, suppress: suppressDeferred });
  };

  const queueCommit = (rowId) => {
    if (!pendingEdits.has(rowId)) return;
    commitQueue.add(rowId);
    if (commitTimer) return;
    commitTimer = window.setTimeout(() => {
      commitTimer = null;
      flushCommitQueue();
    }, 0);
  };

  const flushAllPendingEdits = ({ forceValidate = false, suppressDeferred = false } = {}) => {
    if (commitTimer) {
      window.clearTimeout(commitTimer);
      commitTimer = null;
    }

    if (pendingEdits.size === 0 && commitQueue.size === 0) {
      finalizeSquareValidation({ force: forceValidate, suppress: suppressDeferred });
      return;
    }

    const rowIds = new Set([...pendingEdits.keys(), ...commitQueue]);
    commitQueue.clear();
    let needsSquareValidation = false;

    rowIds.forEach((rowId) => {
      if (commitPendingEdits(rowId)) {
        needsSquareValidation = true;
      }
    });

    if (needsSquareValidation) {
      pendingSquareValidation = true;
    }

    finalizeSquareValidation({ force: forceValidate, suppress: suppressDeferred });
  };

  const handleFieldInput = (rowId, field, value) => {
    if (shouldDeferInput()) {
      if (field === "square") {
        const squareId = parseSquareInput(value);
        setPendingEdit(rowId, "square", squareId);
        return;
      }
      if (field === "title") {
        setPendingEdit(rowId, "title", value);
        return;
      }
      if (field === "uri") {
        setPendingEdit(rowId, "uri", value);
      }
      return;
    }

    if (field === "square") {
      const squareId = parseSquareInput(value);
      store.updateRow(rowId, { squareId });
      scheduleSquareValidation();
      return;
    }

    if (field === "title") {
      store.batch(() => {
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
      });
      return;
    }

    if (field === "uri") {
      store.batch(() => {
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
      });
    }
  };

  const handleFieldBlur = (rowId, field, value, { event } = {}) => {
    if (shouldDeferInput()) {
      window.setTimeout(() => {
        const rowElement = document.getElementById(`personalize-row-${rowId}`);
        const active = document.activeElement;
        if (rowElement && active && rowElement.contains(active)) {
          return;
        }
        queueCommit(rowId);
      }, 0);
      return;
    }
    if (field === "square") {
      if (squareValidationTimer) {
        window.clearTimeout(squareValidationTimer);
        squareValidationTimer = null;
      }
      validateSquareErrors(false);
    }
  };

  const handleRowDelete = (rowId) => {
    store.removeRow(rowId);
    pendingEdits.delete(rowId);
    commitQueue.delete(rowId);
    clearOverLimitFlags(rowId);
    pendingSquareValidation = true;
    finalizeSquareValidation();
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
    onFieldBlur: handleFieldBlur,
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
        pendingEdits.delete(row.id);
        commitQueue.delete(row.id);
        clearOverLimitFlags(row.id);
        store.removeRow(row.id);
      }
    });

    selected.forEach((id) => {
      if (!existing.has(id)) {
        store.addRow({ squareId: id });
      }
    });

    pendingSquareValidation = true;
    finalizeSquareValidation();
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

  const handleResetAll = () => {
    store.resetRowsKeepFirst();
    pendingEdits.clear();
    commitQueue.clear();
    pendingSquareValidation = false;
    clearSquareValidationHandle();
    if (commitTimer) {
      window.clearTimeout(commitTimer);
      commitTimer = null;
    }
    if (squareValidationTimer) {
      window.clearTimeout(squareValidationTimer);
      squareValidationTimer = null;
    }
    resetOverLimitFlags();
    validateSquareErrors(false);
  };

  initPersonalizeBillboardUi({
    store,
    validateSquareErrors,
    clearOverLimitFlags,
    onResetAll: handleResetAll,
  });

  if (personalizeButton) {
    personalizeButton.addEventListener(
      "click",
      () => {
        flushAllPendingEdits({ suppressDeferred: true });
      },
      true
    );
  }

  const billboardSection = document.getElementById("personalize-billboard-section");
  if (billboardSection && "IntersectionObserver" in window) {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            flushAllPendingEdits();
          }
        });
      },
      { threshold: 0.15 }
    );
    observer.observe(billboardSection);
  }

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
    resetButton.addEventListener("click", handleResetAll);
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
