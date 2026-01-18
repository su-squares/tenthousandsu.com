import { initPersonalizeBillboard } from "../../billboard/wrappers/personalize-billboard.js";
import { createPersonalizeImagePlacementOverlay } from "../../billboard/overlays/personalize-image-placement.js";
import { coordsToSquare } from "../../billboard/billboard-utils.js";
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

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

const PLACEMENT_MAX_DIMENSION = 1000;
const PLACEMENT_RESAMPLE_SMOOTH = true;
const PLACEMENT_CHUNK_SIZE = 200;

function revokePlacementUrl(url) {
  if (!url || typeof url !== "string") return;
  if (url.startsWith("blob:")) {
    URL.revokeObjectURL(url);
  }
}

function loadPlacementImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.addEventListener("load", () => {
      if (
        image.naturalWidth &&
        image.naturalHeight &&
        image.width &&
        image.height &&
        (image.naturalWidth !== image.width || image.naturalHeight !== image.height)
      ) {
        revokePlacementUrl(url);
        reject(new Error("IMAGE ERROR: Image must not be animated. Please try again."));
        return;
      }

      const naturalWidth = image.naturalWidth || image.width || 0;
      const naturalHeight = image.naturalHeight || image.height || 0;
      if (!naturalWidth || !naturalHeight) {
        revokePlacementUrl(url);
        reject(new Error("Unable to read file."));
        return;
      }

      const scale = Math.min(
        1,
        PLACEMENT_MAX_DIMENSION / Math.max(naturalWidth, naturalHeight)
      );

      if (scale >= 1) {
        resolve({ image, url });
        return;
      }

      const targetWidth = Math.max(1, Math.round(naturalWidth * scale));
      const targetHeight = Math.max(1, Math.round(naturalHeight * scale));
      const canvas = document.createElement("canvas");
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      const context = canvas.getContext("2d");
      context.imageSmoothingEnabled = PLACEMENT_RESAMPLE_SMOOTH;
      if (PLACEMENT_RESAMPLE_SMOOTH && "imageSmoothingQuality" in context) {
        context.imageSmoothingQuality = "high";
      }
      context.drawImage(image, 0, 0, targetWidth, targetHeight);
      const dataUrl = canvas.toDataURL("image/png");
      revokePlacementUrl(url);
      resolve({ image: canvas, url: dataUrl });
    });
    image.addEventListener("error", () => {
      revokePlacementUrl(url);
      reject(new Error("Unable to read file"));
    });
    image.src = url;
  });
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
  let placementWorker = null;
  let placementWorkerId = 0;
  const RESIZE_STEP_SQUARES = 1;

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

  function getPlacementWorker() {
    if (placementWorker) return placementWorker;
    if (!("Worker" in window)) return null;
    try {
      placementWorker = new Worker(placementWorkerUrl);
    } catch (error) {
      placementWorker = null;
    }
    return placementWorker;
  }

  async function buildPlacementTilesWithWorker(state) {
    const worker = getPlacementWorker();
    if (!worker || typeof createImageBitmap !== "function") {
      throw new Error("Placement worker not available.");
    }
    const bitmap = await createImageBitmap(state.image);
    return new Promise((resolve, reject) => {
      const id = placementWorkerId + 1;
      placementWorkerId = id;

      const handleMessage = (event) => {
        const payload = event.data || {};
        if (payload.id !== id) return;
        if (payload.type === "progress") {
          updatePlacementLoading(payload.processed, payload.total);
          return;
        }
        cleanup();
        if (payload.type === "error") {
          reject(new Error(payload.message || "Placement worker failed."));
          return;
        }
        resolve({
          tiles: payload.tiles || [],
          alphaWarning: Boolean(payload.alphaWarning),
        });
      };

      const handleError = () => {
        cleanup();
        reject(new Error("Placement worker failed."));
      };

      const cleanup = () => {
        worker.removeEventListener("message", handleMessage);
        worker.removeEventListener("error", handleError);
      };

      worker.addEventListener("message", handleMessage);
      worker.addEventListener("error", handleError);
      worker.postMessage(
        {
          id,
          bitmap,
          widthSquares: state.widthSquares,
          heightSquares: state.heightSquares,
          row: state.row,
          col: state.col,
          chunkSize: PLACEMENT_CHUNK_SIZE,
        },
        [bitmap]
      );
    });
  }

  async function buildPlacementTilesChunked(state) {
    const widthPx = state.widthSquares * 10;
    const heightPx = state.heightSquares * 10;
    const canvas = document.createElement("canvas");
    canvas.width = widthPx;
    canvas.height = heightPx;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    context.drawImage(state.image, 0, 0, widthPx, heightPx);
    const { data } = context.getImageData(0, 0, widthPx, heightPx);

    const previewCanvas = document.createElement("canvas");
    previewCanvas.width = 10;
    previewCanvas.height = 10;
    const previewContext = previewCanvas.getContext("2d");
    const previewImageData = previewContext.createImageData(10, 10);
    const tiles = [];
    let alphaWarning = false;
    const total = state.widthSquares * state.heightSquares;
    let processed = 0;

    for (let y = 0; y < state.heightSquares; y += 1) {
      for (let x = 0; x < state.widthSquares; x += 1) {
        let hex = "0x";
        for (let py = 0; py < 10; py += 1) {
          for (let px = 0; px < 10; px += 1) {
            const sourceIndex =
              ((y * 10 + py) * widthPx + (x * 10 + px)) * 4;
            const red = data[sourceIndex];
            const green = data[sourceIndex + 1];
            const blue = data[sourceIndex + 2];
            const alpha = data[sourceIndex + 3];
            const mixedRed = Math.floor((red * alpha + 255 * (255 - alpha)) / 255);
            const mixedGreen = Math.floor(
              (green * alpha + 255 * (255 - alpha)) / 255
            );
            const mixedBlue = Math.floor((blue * alpha + 255 * (255 - alpha)) / 255);
            if (alpha !== 255) alphaWarning = true;
            hex += mixedRed.toString(16).padStart(2, "0");
            hex += mixedGreen.toString(16).padStart(2, "0");
            hex += mixedBlue.toString(16).padStart(2, "0");

            const targetIndex = (py * 10 + px) * 4;
            previewImageData.data[targetIndex] = mixedRed;
            previewImageData.data[targetIndex + 1] = mixedGreen;
            previewImageData.data[targetIndex + 2] = mixedBlue;
            previewImageData.data[targetIndex + 3] = 255;
          }
        }

        previewContext.putImageData(previewImageData, 0, 0);
        const previewUrl = previewCanvas.toDataURL("image/png");
        const squareId = coordsToSquare(state.row + y, state.col + x);
        tiles.push({
          squareId,
          imagePixelsHex: hex,
          imagePreviewUrl: previewUrl,
        });
        processed += 1;

        if (processed % PLACEMENT_CHUNK_SIZE === 0) {
          updatePlacementLoading(processed, total);
          await nextFrame();
        }
      }
    }

    updatePlacementLoading(total, total);
    return { tiles, alphaWarning };
  }

  async function buildPlacementTiles(state) {
    if (!state || !state.image) {
      return { tiles: [], alphaWarning: false };
    }
    try {
      if ("Worker" in window && "OffscreenCanvas" in window) {
        return await buildPlacementTilesWithWorker(state);
      }
    } catch (error) {
      console.warn("[Personalize] Placement worker unavailable, using fallback.", error);
    }
    return buildPlacementTilesChunked(state);
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
      const { tiles, alphaWarning } = await buildPlacementTiles(placementState);
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

  syncUi();

  return {
    controller,
  };
}
