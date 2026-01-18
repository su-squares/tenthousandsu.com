import { initPersonalizeBillboard } from "../../billboard/wrappers/personalize-billboard.js";
import { isValidSquareId } from "./store.js";

function setsEqual(a, b) {
  if (a === b) return true;
  if (!a || !b) return false;
  if (a.size !== b.size) return false;
  for (const value of a) {
    if (!b.has(value)) return false;
  }
  return true;
}

function hasRowErrors(row) {
  if (!row || !row.errors) return false;
  return Object.values(row.errors).some(Boolean);
}

function summarizeRowErrors(row) {
  if (!row || !row.errors) return "";
  const unique = Array.from(new Set(Object.values(row.errors).filter(Boolean)));
  return unique.join(" ");
}

function chooseBestRow(rows) {
  if (!rows || rows.length === 0) return null;
  const noErrors = rows.filter((row) => !hasRowErrors(row));
  const withImage = rows.filter((row) => row.imagePreviewUrl && row.imagePixelsHex);
  if (noErrors.length > 0 && withImage.length > 0) {
    const inBoth = noErrors.find((row) => row.imagePreviewUrl && row.imagePixelsHex);
    if (inBoth) return inBoth;
  }
  if (noErrors.length > 0) return noErrors[0];
  if (withImage.length > 0) return withImage[0];
  return rows[0];
}

function buildRowGroups(rows) {
  const groups = new Map();
  rows.forEach((row) => {
    if (!isValidSquareId(row.squareId)) return;
    const list = groups.get(row.squareId);
    if (list) {
      list.push(row);
    } else {
      groups.set(row.squareId, [row]);
    }
  });
  return groups;
}

function buildPreviewRows(rows) {
  const groups = buildRowGroups(rows);
  const map = new Map();
  groups.forEach((groupRows, squareId) => {
    const row = chooseBestRow(groupRows);
    if (!row) return;
    map.set(squareId, {
      title: row.title,
      uri: row.uri,
      imagePreviewUrl: row.imagePreviewUrl,
      imagePixelsHex: row.imagePixelsHex,
      hasErrors: hasRowErrors(row),
      errorText: summarizeRowErrors(row),
    });
  });
  return map;
}

function buildErrorMap(rows) {
  const groups = buildRowGroups(rows);
  const map = new Map();
  groups.forEach((groupRows, squareId) => {
    const messageSet = new Set();
    groupRows.forEach((row) => {
      if (!row || !row.errors) return;
      Object.values(row.errors)
        .filter(Boolean)
        .forEach((message) => messageSet.add(message));
    });
    if (messageSet.size > 0) {
      map.set(squareId, Array.from(messageSet).join(" "));
    }
  });
  return map;
}

function getSelectedSquares(rows) {
  const selected = new Set();
  rows.forEach((row) => {
    if (isValidSquareId(row.squareId)) {
      selected.add(row.squareId);
    }
  });
  return selected;
}

export function initPersonalizeBillboardUi({
  store,
  validateSquareErrors,
  clearOverLimitFlags,
  alertFn = window.alert.bind(window),
}) {
  const root = document.querySelector(".personalize-billboard");
  const mount = document.getElementById("personalize-billboard");
  if (!root || !mount) return null;

  const modeButtons = Array.from(
    root.querySelectorAll(".personalize-billboard__mode-btn")
  );
  const previewToggle = document.getElementById("preview-tooltips-toggle");
  const previewToggleLabel = document.getElementById("preview-tooltips-toggle-label");
  const updateButton = document.getElementById("billboard-update");
  const cancelButton = document.getElementById("billboard-cancel");
  const uploadButton = document.getElementById("billboard-upload");
  const resetButton = document.getElementById("personalize-billboard-reset");

  let mode = "owned";
  let previewTooltips = previewToggle ? previewToggle.checked : false;
  let isEditing = false;
  let stagedSelection = new Set();
  let lastOwnedSquares = null;
  let outsideListenerActive = false;

  root.dataset.editing = "false";

  const controller = initPersonalizeBillboard({
    container: mount,
    baseurl: window.SITE_BASEURL || "",
    onSquareActivate: (squareNumber) => {
      if (!isValidSquareId(squareNumber)) return;
      if (!isEditing) {
        startEditMode();
      }
      toggleStagedSquare(squareNumber);
    },
  });

  if (!controller) return null;

  function startEditMode() {
    if (isEditing) return;
    isEditing = true;
    stagedSelection = getSelectedSquares(store.getState().rows);
    root.dataset.editing = "true";
    enableOutsideListener();
    syncUi();
  }

  function stopEditMode() {
    if (!isEditing) return;
    isEditing = false;
    stagedSelection = new Set();
    root.dataset.editing = "false";
    disableOutsideListener();
    syncUi();
  }

  function cancelEditMode() {
    stopEditMode();
  }

  function applyEditMode() {
    if (!isEditing) return;
    const selected = stagedSelection;
    const state = store.getState();
    const existing = getSelectedSquares(state.rows);

    state.rows.forEach((row) => {
      if (isValidSquareId(row.squareId) && !selected.has(row.squareId)) {
        store.removeRow(row.id);
        clearOverLimitFlags(row.id);
      }
    });

    selected.forEach((squareId) => {
      if (!existing.has(squareId)) {
        store.addRow({ squareId });
      }
    });

    store.sortRows();
    validateSquareErrors(false);
    stopEditMode();
  }

  function toggleStagedSquare(squareNumber) {
    const { ownershipStatus, ownedSquares } = store.getState();
    if (ownershipStatus === "ready" && ownedSquares && !ownedSquares.has(squareNumber)) {
      alertFn("You don't own this Square.");
      return;
    }

    if (stagedSelection.has(squareNumber)) {
      stagedSelection.delete(squareNumber);
    } else {
      stagedSelection.add(squareNumber);
    }
    syncUi();
  }

  function handleOutsidePointer(event) {
    if (!isEditing) return;
    if (!root.contains(event.target)) {
      cancelEditMode();
    }
  }

  function enableOutsideListener() {
    if (outsideListenerActive) return;
    outsideListenerActive = true;
    document.addEventListener("pointerdown", handleOutsidePointer, true);
  }

  function disableOutsideListener() {
    if (!outsideListenerActive) return;
    outsideListenerActive = false;
    document.removeEventListener("pointerdown", handleOutsidePointer, true);
  }

  function syncControls(hasChanges) {
    if (updateButton) {
      updateButton.hidden = !isEditing;
      updateButton.disabled = !hasChanges;
      updateButton.classList.toggle("is-invisible", !hasChanges);
    }
    if (cancelButton) {
      cancelButton.hidden = !isEditing;
    }
    if (uploadButton) {
      uploadButton.hidden = isEditing;
    }
  }

  function syncModeButtons() {
    modeButtons.forEach((button) => {
      const isActive = button.dataset.mode === mode;
      button.classList.toggle("is-active", isActive);
      button.setAttribute("aria-pressed", isActive ? "true" : "false");
    });
    root.dataset.mode = mode;
  }

  function syncBillboardState() {
    const state = store.getState();
    const rows = state.rows;
    const tableSelection = getSelectedSquares(rows);
    const selectedSquares = isEditing ? stagedSelection : tableSelection;
    const previewRows = buildPreviewRows(rows);
    const errorMap = buildErrorMap(rows);

    controller.setState({
      mode,
      previewTooltips,
      ownershipStatus: state.ownershipStatus,
      ownedSquares: state.ownedSquares,
      selectedSquares,
      previewRows,
      errorMap,
    });

    const hasChanges = isEditing && !setsEqual(tableSelection, stagedSelection);
    syncControls(hasChanges);
  }

  function clearUnownedSquares(state) {
    if (state.ownershipStatus !== "ready" || !state.ownedSquares) return;
    const ownedSquares = state.ownedSquares;
    const rows = state.rows;
    rows.forEach((row) => {
      if (isValidSquareId(row.squareId) && !ownedSquares.has(row.squareId)) {
        store.updateRow(row.id, (draft) => {
          draft.squareId = null;
          draft.errors.square = "";
        });
      }
    });
    validateSquareErrors(false);
    if (isEditing) {
      const filtered = new Set();
      stagedSelection.forEach((squareId) => {
        if (ownedSquares.has(squareId)) {
          filtered.add(squareId);
        }
      });
      stagedSelection = filtered;
    }
  }

  function syncOwnership(state) {
    if (state.ownershipStatus === "ready" && state.ownedSquares) {
      if (state.ownedSquares !== lastOwnedSquares) {
        lastOwnedSquares = state.ownedSquares;
        clearUnownedSquares(state);
      }
    }
  }

  function syncUi() {
    syncModeButtons();
    syncBillboardState();
  }

  modeButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const nextMode = button.dataset.mode;
      if (!nextMode || nextMode === mode) return;
      mode = nextMode;
      syncUi();
    });
  });

  if (previewToggle) {
    previewToggle.addEventListener("change", () => {
      previewTooltips = previewToggle.checked;
      syncBillboardState();
    });
  }

  if (updateButton) {
    updateButton.addEventListener("click", applyEditMode);
  }

  if (cancelButton) {
    cancelButton.addEventListener("click", cancelEditMode);
  }

  if (resetButton) {
    resetButton.addEventListener("click", () => controller.billboard.reset());
  }

  store.subscribe((state) => {
    syncOwnership(state);
    syncBillboardState();
  });

  syncUi();

  return {
    controller,
  };
}
