const PLACEMENT_MAX_DIMENSION = 1000;
const PLACEMENT_RESAMPLE_SMOOTH = true;
export const PLACEMENT_CHUNK_SIZE = 200;

let placementWorker = null;
let placementWorkerId = 0;

export function revokePlacementUrl(url) {
  if (!url || typeof url !== "string") return;
  if (url.startsWith("blob:")) {
    URL.revokeObjectURL(url);
  }
}

export function loadPlacementImage(file) {
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

function getPlacementWorker(workerUrl) {
  if (placementWorker) return placementWorker;
  if (!("Worker" in window) || !workerUrl) return null;
  try {
    placementWorker = new Worker(workerUrl);
  } catch (error) {
    placementWorker = null;
  }
  return placementWorker;
}

function getDefaultCoordsToSquare(row, col) {
  return row * 100 + col + 1;
}

async function buildPlacementTilesWithWorker(state, options = {}) {
  const { workerUrl, onProgress, chunkSize = PLACEMENT_CHUNK_SIZE } = options;
  const worker = getPlacementWorker(workerUrl);
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
        if (typeof onProgress === "function") {
          onProgress(payload.processed, payload.total);
        }
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
        chunkSize,
      },
      [bitmap]
    );
  });
}

async function buildPlacementTilesChunked(state, options = {}) {
  const { onProgress, coordsToSquare, chunkSize = PLACEMENT_CHUNK_SIZE } = options;
  const toSquare =
    typeof coordsToSquare === "function" ? coordsToSquare : getDefaultCoordsToSquare;
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
          const sourceIndex = ((y * 10 + py) * widthPx + (x * 10 + px)) * 4;
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
      const squareId = toSquare(state.row + y, state.col + x);
      tiles.push({
        squareId,
        imagePixelsHex: hex,
        imagePreviewUrl: previewUrl,
      });
      processed += 1;

      if (chunkSize > 0 && processed % chunkSize === 0) {
        if (typeof onProgress === "function") {
          onProgress(processed, total);
        }
        await nextFrame();
      }
    }
  }

  if (typeof onProgress === "function") {
    onProgress(total, total);
  }
  return { tiles, alphaWarning };
}

export async function buildPlacementTiles(state, options = {}) {
  if (!state || !state.image) {
    return { tiles: [], alphaWarning: false };
  }
  const { workerUrl } = options;
  try {
    if ("Worker" in window && "OffscreenCanvas" in window && workerUrl) {
      return await buildPlacementTilesWithWorker(state, options);
    }
  } catch (error) {
    console.warn("[Personalize] Placement worker unavailable, using fallback.", error);
  }
  return buildPlacementTilesChunked(state, options);
}
