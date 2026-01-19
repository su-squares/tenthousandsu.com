import { initPersonalizeBillboard } from "../../../billboard/wrappers/personalize-billboard.js";
import { createPersonalizeImagePlacementOverlay } from "../../../billboard/overlays/personalize-image-placement.js";
import { coordsToSquare } from "../../../billboard/billboard-utils.js";
import { isValidSquareId } from "../store.js";
import { buildErrorMap, buildPreviewRows, getSelectedSquares } from "./preview.js";
import {
  PLACEMENT_CHUNK_SIZE,
  buildPlacementTiles,
  loadPlacementImage,
  revokePlacementUrl,
} from "./placement.js";

function setsEqual(a, b) {
  if (a === b) return true;
  if (!a || !b) return false;
  if (a.size !== b.size) return false;
  for (const value of a) {
    if (!b.has(value)) return false;
  }
  return true;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function nextFrame() {
  return new Promise((resolve) => requestAnimationFrame(resolve));
}

function getCornerSquares({ row, col, widthSquares, heightSquares }) {
  const topLeft = coordsToSquare(row, col);
  const topRight = coordsToSquare(row, col + widthSquares - 1);
  const bottomLeft = coordsToSquare(row + heightSquares - 1, col);
  const bottomRight = coordsToSquare(
    row + heightSquares - 1,
    col + widthSquares - 1
  );
  return { topLeft, topRight, bottomLeft, bottomRight };
}

function getLocatorSquare(state) {
  if (!state.locatorRowId) return null;
  const row = state.rows.find((item) => item.id === state.locatorRowId);
  if (!row || !isValidSquareId(row.squareId)) return null;
  return row.squareId;
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
  const locatorHideButton = document.getElementById("billboard-locator-hide");
  const placementControls = document.getElementById("personalize-placement-controls");
  const placementInput = document.getElementById("placement-image-input");
  const placementAccept = document.getElementById("placement-accept");
  const placementCancel = document.getElementById("placement-cancel");
  const placementResizeMinus = document.getElementById("placement-resize-minus");
  const placementResizePlus = document.getElementById("placement-resize-plus");
  const placementTopLeft = document.getElementById("placement-top-left");
  const placementTopRight = document.getElementById("placement-top-right");
  const placementBottomLeft = document.getElementById("placement-bottom-left");
  const placementBottomRight = document.getElementById("placement-bottom-right");
  const placementLoading = document.getElementById("placement-loading");
  const placementLoadingText =
    placementLoading?.querySelector(".personalize-billboard__loading-text") || null;
  const ownershipLoading = document.getElementById("ownership-loading");
  const ownershipLoadingCount = document.getElementById("ownership-loading-count");

  let mode = "owned";
  let previewTooltips = previewToggle ? previewToggle.checked : false;
  let isEditing = false;
  let stagedSelection = new Set();
  let lastOwnedSquares = null;
  let outsideListenerActive = false;
  let placementActive = false;
  let placementState = null;
  let placementDragging = null;
  let placementOverlay = null;
  let placementInvalid = false;
  let placementProcessing = false;
  const RESIZE_STEP_SQUARES = 1;
  const OWNERSHIP_OVERLAY_DELAY_MS = 1000;
  const OWNERSHIP_OVERLAY_COUNT_THRESHOLD = 50;
  let ownershipOverlayTimer = null;
  let ownershipOverlayVisible = false;
  let lastOwnershipStatus = null;

  root.dataset.editing = "false";

  const controller = initPersonalizeBillboard({
    container: mount,
    baseurl: window.SITE_BASEURL || "",
    onSquareActivate: (squareNumber) => {
      if (!isValidSquareId(squareNumber) || placementActive) return;
      if (!isEditing) {
        startEditMode();
      }
      toggleStagedSquare(squareNumber);
    },
  });

  if (!controller) return null;

  placementOverlay = createPersonalizeImagePlacementOverlay({
    wrapper: controller.billboard.elements.wrapper,
    panZoom: controller.billboard.panZoom,
  });

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
    const locatorSquare = getLocatorSquare(state);

    controller.setState({
      mode,
      previewTooltips,
      ownershipStatus: state.ownershipStatus,
      ownedSquares: state.ownedSquares,
      selectedSquares,
      previewRows,
      errorMap,
      locatorSquare,
    });

    const hasChanges = isEditing && !setsEqual(tableSelection, stagedSelection);
    syncControls(hasChanges);
    if (locatorHideButton) {
      locatorHideButton.hidden = !locatorSquare;
    }
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

  function setPlacementVisibility(active) {
    root.dataset.placement = active ? "true" : "false";
    if (placementControls) {
      placementControls.hidden = !active;
    }
  }

  const placementWorkerUrl = `${window.SITE_BASEURL || ""}/assets/js/personalize-modern/placement-worker.js`;

  function setPlacementLoading(active) {
    if (placementLoading) {
      placementLoading.hidden = !active;
    }
    if (placementLoadingText) {
      const message = "Adding images to table";
      if (active) {
        if (placementLoadingText.firstChild) {
          placementLoadingText.firstChild.nodeValue = message;
        } else {
          placementLoadingText.textContent = message;
        }
      }
    }
    if (placementAccept) {
      placementAccept.disabled = active || placementInvalid;
    }
    if (placementCancel) {
      placementCancel.disabled = active;
    }
    if (uploadButton) {
      uploadButton.disabled = active;
    }
  }

  function updatePlacementLoading(processed, total) {
    if (!placementLoadingText || !total) return;
    const percent = Math.min(100, Math.round((processed / total) * 100));
    const message = `Adding images to table (${percent}%)`;
    if (placementLoadingText.firstChild) {
      placementLoadingText.firstChild.nodeValue = message;
    } else {
      placementLoadingText.textContent = message;
    }
  }

  function clearOwnershipOverlayTimer() {
    if (ownershipOverlayTimer) {
      window.clearTimeout(ownershipOverlayTimer);
      ownershipOverlayTimer = null;
    }
  }

  function setOwnershipOverlayVisible(visible) {
    if (!ownershipLoading) return;
    ownershipLoading.hidden = !visible;
    ownershipOverlayVisible = visible;
  }

  function updateOwnershipLoading(state) {
    if (!ownershipLoading) return;
    const loading = state.ownershipStatus === "loading";
    const total = Number.isFinite(state.ownershipTotal) ? state.ownershipTotal : null;
    const progress = Number.isFinite(state.ownershipProgress) ? state.ownershipProgress : 0;

    if (!loading) {
      clearOwnershipOverlayTimer();
      if (ownershipOverlayVisible) {
        setOwnershipOverlayVisible(false);
      }
      if (ownershipLoadingCount) {
        ownershipLoadingCount.textContent = "";
      }
      lastOwnershipStatus = state.ownershipStatus;
      return;
    }

    if (lastOwnershipStatus !== "loading") {
      const panZoom = controller?.billboard?.panZoom;
      if (panZoom?.isActive && typeof panZoom.reset === "function") {
        panZoom.reset();
      }
    }
    lastOwnershipStatus = state.ownershipStatus;

    const shouldShowInstantly =
      total !== null && total > OWNERSHIP_OVERLAY_COUNT_THRESHOLD;

    if (shouldShowInstantly) {
      clearOwnershipOverlayTimer();
      if (!ownershipOverlayVisible) {
        setOwnershipOverlayVisible(true);
      }
    } else if (!ownershipOverlayVisible && !ownershipOverlayTimer) {
      ownershipOverlayTimer = window.setTimeout(() => {
        ownershipOverlayTimer = null;
        if (store.getState().ownershipStatus === "loading") {
          setOwnershipOverlayVisible(true);
        }
      }, OWNERSHIP_OVERLAY_DELAY_MS);
    }

    if (ownershipLoadingCount) {
      if (total !== null && total > 0) {
        const capped = Math.min(progress, total);
        ownershipLoadingCount.textContent = `(${capped}/${total})`;
      } else if (progress > 0) {
        ownershipLoadingCount.textContent = `(${progress})`;
      } else {
        ownershipLoadingCount.textContent = "";
      }
    }
  }

  function computeInitialPlacement(image) {
    const aspect = image.width / image.height || 1;
    let widthSquares = Math.max(1, Math.round(image.width / 10));
    let heightSquares = Math.max(1, Math.round(image.height / 10));

    if (widthSquares >= heightSquares) {
      widthSquares = clamp(widthSquares, 1, 100);
      heightSquares = clamp(Math.round(widthSquares / aspect), 1, 100);
    } else {
      heightSquares = clamp(heightSquares, 1, 100);
      widthSquares = clamp(Math.round(heightSquares * aspect), 1, 100);
    }

    widthSquares = clamp(widthSquares, 1, 100);
    heightSquares = clamp(heightSquares, 1, 100);

    const maxCol = Math.max(0, 100 - widthSquares);
    const maxRow = Math.max(0, 100 - heightSquares);
    const col = Math.floor(maxCol / 2);
    const row = Math.floor(maxRow / 2);

    return {
      image,
      aspect,
      widthSquares,
      heightSquares,
      row,
      col,
    };
  }

  function updatePlacementOverlay() {
    if (!placementOverlay || !placementState) return;
    placementOverlay.updateBounds(placementState);
  }

  function updatePlacementCoords() {
    if (!placementState) return;
    const corners = getCornerSquares(placementState);
    if (placementTopLeft) placementTopLeft.textContent = `#${corners.topLeft}`;
    if (placementTopRight) placementTopRight.textContent = `#${corners.topRight}`;
    if (placementBottomLeft) placementBottomLeft.textContent = `#${corners.bottomLeft}`;
    if (placementBottomRight) placementBottomRight.textContent = `#${corners.bottomRight}`;
  }

  function computePlacementValid(state) {
    if (!placementState) return false;
    if (state.ownershipStatus !== "ready" || !state.ownedSquares) {
      return true;
    }
    for (let rowOffset = 0; rowOffset < placementState.heightSquares; rowOffset += 1) {
      for (let colOffset = 0; colOffset < placementState.widthSquares; colOffset += 1) {
        const squareId = coordsToSquare(
          placementState.row + rowOffset,
          placementState.col + colOffset
        );
        if (!state.ownedSquares.has(squareId)) {
          return false;
        }
      }
    }
    return true;
  }

  function syncPlacementValidity() {
    if (!placementActive || !placementState) return;
    placementInvalid = !computePlacementValid(store.getState());
    if (placementOverlay) {
      placementOverlay.setInvalid(placementInvalid);
    }
    if (placementAccept) {
      placementAccept.disabled = placementInvalid || placementProcessing;
      placementAccept.setAttribute(
        "aria-disabled",
        placementInvalid || placementProcessing ? "true" : "false"
      );
    }
  }

  function syncPlacementUi() {
    updatePlacementOverlay();
    updatePlacementCoords();
    syncPlacementValidity();
  }

  function setPlacementPosition(row, col) {
    if (!placementState) return;
    const maxCol = Math.max(0, 100 - placementState.widthSquares);
    const maxRow = Math.max(0, 100 - placementState.heightSquares);
    placementState.col = clamp(col, 0, maxCol);
    placementState.row = clamp(row, 0, maxRow);
    syncPlacementUi();
  }

  function resizePlacement(delta) {
    if (!placementState) return;
    const nextWidth = clamp(
      Math.round(placementState.widthSquares + delta),
      1,
      100
    );
    const nextHeight = clamp(
      Math.round(nextWidth / placementState.aspect),
      1,
      100
    );

    placementState.widthSquares = nextWidth;
    placementState.heightSquares = nextHeight;
    setPlacementPosition(placementState.row, placementState.col);
  }

  function enterPlacementMode(image, imageUrl) {
    if (!placementOverlay || !image) return;
    if (isEditing) {
      cancelEditMode();
    }
    placementActive = true;
    placementState = computeInitialPlacement(image);
    placementState.imageUrl = imageUrl || "";
    placementOverlay.setImageSource(imageUrl || image.src);
    placementOverlay.setVisible(true);
    setPlacementVisibility(true);
    syncPlacementUi();
    placementOverlay.element.focus();
  }

  function exitPlacementMode() {
    const imageUrl = placementState?.imageUrl;
    placementActive = false;
    placementState = null;
    placementDragging = null;
    placementInvalid = false;
    setPlacementVisibility(false);
    if (placementOverlay) {
      placementOverlay.setVisible(false);
      placementOverlay.setInvalid(false);
    }
    revokePlacementUrl(imageUrl);
  }

  async function applyPlacementTiles(tiles) {
    const rows = store.getState().rows;
    const rowBySquare = new Map();
    rows.forEach((row) => {
      if (isValidSquareId(row.squareId) && !rowBySquare.has(row.squareId)) {
        rowBySquare.set(row.squareId, row);
      }
    });

    store.beginBatch();
    try {
      const total = tiles.length;
      let index = 0;
      while (index < total) {
        const end = Math.min(index + PLACEMENT_CHUNK_SIZE, total);
        for (let i = index; i < end; i += 1) {
          const patch = tiles[i];
          const squareId = patch.squareId;
          const row = rowBySquare.get(squareId) || null;
          if (row) {
            store.updateRow(row.id, (draft) => {
              draft.imagePixelsHex = patch.imagePixelsHex;
              draft.imagePreviewUrl = patch.imagePreviewUrl;
              draft.errors.image = "";
            });
          } else {
            const newRow = store.addRow({
              squareId,
              imagePixelsHex: patch.imagePixelsHex,
              imagePreviewUrl: patch.imagePreviewUrl,
            });
            rowBySquare.set(squareId, newRow);
          }
        }
        index = end;
        updatePlacementLoading(index, total);
        if (index < total) {
          await nextFrame();
        }
      }

      store.sortRows();
      validateSquareErrors(false);
    } finally {
      store.endBatch();
    }
  }

  async function applyPlacement() {
    if (!placementState || placementInvalid || placementProcessing) return;
    if (controller?.billboard?.panZoom?.reset) {
      controller.billboard.panZoom.reset();
    }
    placementProcessing = true;
    setPlacementLoading(true);
    try {
      const { tiles, alphaWarning } = await buildPlacementTiles(placementState, {
        workerUrl: placementWorkerUrl,
        onProgress: updatePlacementLoading,
        coordsToSquare,
        chunkSize: PLACEMENT_CHUNK_SIZE,
      });
      await applyPlacementTiles(tiles);
      exitPlacementMode();
      if (alphaWarning) {
        alertFn("WARNING: Your image included transparency. We mixed it on white.");
      }
    } catch (error) {
      alertFn(error?.message || "Unable to apply image placement.");
    } finally {
      placementProcessing = false;
      setPlacementLoading(false);
    }
  }

  root.dataset.placement = "false";

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

  if (uploadButton && placementInput) {
    uploadButton.addEventListener("click", () => {
      placementInput.click();
    });

    placementInput.addEventListener("change", async (event) => {
      const file = event.target.files?.[0];
      if (!file) return;
      try {
        if (placementActive) {
          exitPlacementMode();
        }
        const { image, url } = await loadPlacementImage(file);
        enterPlacementMode(image, url);
      } catch (error) {
        alertFn(error?.message || "Unable to read file.");
      } finally {
        placementInput.value = "";
      }
    });
  }

  if (placementAccept) {
    placementAccept.addEventListener("click", () => {
      applyPlacement();
    });
  }

  if (placementCancel) {
    placementCancel.addEventListener("click", () => {
      exitPlacementMode();
    });
  }

  const attachResizeHold = (button, delta) => {
    if (!button) return;
    let holdTimer = null;
    let repeatTimer = null;

    const stop = () => {
      if (holdTimer) clearTimeout(holdTimer);
      if (repeatTimer) clearInterval(repeatTimer);
      holdTimer = null;
      repeatTimer = null;
    };

    const start = (event) => {
      if (!placementActive) return;
      event.preventDefault();
      resizePlacement(delta);
      holdTimer = window.setTimeout(() => {
        repeatTimer = window.setInterval(() => resizePlacement(delta), 120);
      }, 600);
    };

    button.addEventListener("pointerdown", start);
    button.addEventListener("pointerup", stop);
    button.addEventListener("pointerleave", stop);
    button.addEventListener("pointercancel", stop);
  };

  attachResizeHold(placementResizeMinus, -RESIZE_STEP_SQUARES);
  attachResizeHold(placementResizePlus, RESIZE_STEP_SQUARES);

  if (placementOverlay) {
    placementOverlay.element.addEventListener("pointerdown", (event) => {
      if (!placementActive || !placementState) return;
      event.preventDefault();
      event.stopPropagation();
      const point = placementOverlay.screenToCanvas(event.clientX, event.clientY);
      const cellSize = placementOverlay.getCellSize();
      placementDragging = {
        pointerId: event.pointerId,
        offsetX: point.x - placementState.col * cellSize,
        offsetY: point.y - placementState.row * cellSize,
      };
      placementOverlay.element.setPointerCapture(event.pointerId);
    });

    placementOverlay.element.addEventListener("pointermove", (event) => {
      if (!placementActive || !placementState || !placementDragging) return;
      if (placementDragging.pointerId !== event.pointerId) return;
      const point = placementOverlay.screenToCanvas(event.clientX, event.clientY);
      const cellSize = placementOverlay.getCellSize();
      const nextCol = Math.round((point.x - placementDragging.offsetX) / cellSize);
      const nextRow = Math.round((point.y - placementDragging.offsetY) / cellSize);
      setPlacementPosition(nextRow, nextCol);
    });

    const stopDrag = (event) => {
      if (!placementDragging) return;
      if (event.pointerId !== placementDragging.pointerId) return;
      placementDragging = null;
    };

    placementOverlay.element.addEventListener("pointerup", stopDrag);
    placementOverlay.element.addEventListener("pointercancel", stopDrag);

    placementOverlay.element.addEventListener("keydown", (event) => {
      if (!placementActive || !placementState) return;
      switch (event.key) {
        case "ArrowUp":
          event.preventDefault();
          setPlacementPosition(placementState.row - 1, placementState.col);
          break;
        case "ArrowDown":
          event.preventDefault();
          setPlacementPosition(placementState.row + 1, placementState.col);
          break;
        case "ArrowLeft":
          event.preventDefault();
          setPlacementPosition(placementState.row, placementState.col - 1);
          break;
        case "ArrowRight":
          event.preventDefault();
          setPlacementPosition(placementState.row, placementState.col + 1);
          break;
        case "+":
        case "=":
          event.preventDefault();
          resizePlacement(RESIZE_STEP_SQUARES);
          break;
        case "-":
        case "_":
          event.preventDefault();
          resizePlacement(-RESIZE_STEP_SQUARES);
          break;
        case "Enter":
          event.preventDefault();
          applyPlacement();
          break;
        case "Escape":
          event.preventDefault();
          exitPlacementMode();
          break;
        default:
          break;
      }
    });
  }

  if (locatorHideButton) {
    locatorHideButton.addEventListener("click", () => {
      store.setLocatorRow(null);
    });
  }

  store.subscribe((state) => {
    syncOwnership(state);
    updateOwnershipLoading(state);
    syncBillboardState();
    if (placementActive) {
      syncPlacementValidity();
    }
  });

  window.addEventListener("resize", () => {
    if (placementActive) {
      syncPlacementUi();
    }
  });

  updateOwnershipLoading(store.getState());
  syncUi();

  return {
    controller,
  };
}
