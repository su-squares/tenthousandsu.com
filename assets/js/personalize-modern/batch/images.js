import { createBatchErrorGroups } from "./errors.js";
import {
  buildImagePixelsHex,
  extractSquareIdFromFilename,
  loadImageFromFile,
} from "../utils.js";

function nextFrame() {
  return new Promise((resolve) => requestAnimationFrame(resolve));
}

export async function parseImageBatchFiles(files, options) {
  const {
    isValidSquareId,
    ownershipReady = false,
    ownedSquares = null,
    onProgress,
    chunkSize = null,
  } = options;
  const errors = createBatchErrorGroups();
  const batchMap = new Map();
  const alphaWarnings = [];
  const fileMap = new Map();
  const duplicates = new Set();

  Array.from(files || []).forEach((file) => {
    const squareId = extractSquareIdFromFilename(file.name);
    if (!squareId || !isValidSquareId(squareId)) {
      errors.invalidFilenames.push(file.name);
      return;
    }
    if (fileMap.has(squareId)) {
      duplicates.add(squareId);
      return;
    }
    fileMap.set(squareId, file);
  });

  if (duplicates.size > 0) {
    errors.duplicateImageSquares = Array.from(duplicates)
      .sort((a, b) => a - b)
      .map((id) => `#${id}`);
  }

  if (ownershipReady && ownedSquares) {
    fileMap.forEach((_file, squareId) => {
      if (!ownedSquares.has(squareId)) {
        errors.notOwned.push(`#${squareId}`);
      }
    });
  }

  const entries = Array.from(fileMap.entries());
  const total = entries.length;
  const effectiveChunk =
    Number.isInteger(chunkSize) && chunkSize > 0 ? chunkSize : total;

  const processEntry = async ([squareId, file]) => {
    try {
      const image = await loadImageFromFile(file);
      if (image.width !== 10 || image.height !== 10) {
        errors.invalidImageSize.push(`#${squareId}`);
        return;
      }
      if (image.naturalWidth !== image.width || image.naturalHeight !== image.height) {
        errors.animatedImages.push(`#${squareId}`);
        return;
      }
      const { hex, previewUrl, alphaWarning } = buildImagePixelsHex(image);
      if (alphaWarning) {
        alphaWarnings.push(`#${squareId}`);
      }
      batchMap.set(squareId, { imagePixelsHex: hex, imagePreviewUrl: previewUrl });
    } catch (_error) {
      errors.unreadableImages.push(file.name);
    }
  };

  if (total === 0) {
    if (typeof onProgress === "function") {
      onProgress(0, 0);
    }
  } else if (effectiveChunk >= total) {
    await Promise.all(entries.map(processEntry));
    if (typeof onProgress === "function") {
      onProgress(total, total);
    }
  } else {
    let processed = 0;
    for (let offset = 0; offset < entries.length; offset += effectiveChunk) {
      const chunk = entries.slice(offset, offset + effectiveChunk);
      await Promise.all(chunk.map(processEntry));
      processed += chunk.length;
      if (typeof onProgress === "function") {
        onProgress(processed, total);
      }
      if (processed < total) {
        await nextFrame();
      }
    }
  }

  const hasErrors = Object.values(errors).some((list) => list.length > 0);
  return { batchMap, errors, hasErrors, alphaWarnings };
}
