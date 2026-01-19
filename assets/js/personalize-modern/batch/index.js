import { CSV_INSTRUCTIONS, IMAGE_INSTRUCTIONS, TITLE_MAX, URI_MAX } from "../constants.js";
import { buildBatchErrorMessage } from "./errors.js";
import { downloadCsv, parseCsvBatchFile } from "./csv.js";
import { parseImageBatchFiles } from "./images.js";

const CSV_WORKER_URL = `${window.SITE_BASEURL || ""}/assets/js/personalize-modern/batch/csv-worker.js`;
const CSV_PROGRESS_THRESHOLD = 50;
const CSV_PROGRESS_DELAY_MS = 200;
const CSV_APPLY_CHUNK_SIZE = 200;
const OWNERSHIP_MAX_SQUARE = 10000;

let csvWorker = null;
let csvWorkerId = 0;

function nextFrame() {
  return new Promise((resolve) => requestAnimationFrame(resolve));
}

function getCsvWorker() {
  if (csvWorker) return csvWorker;
  if (!("Worker" in window)) return null;
  try {
    csvWorker = new Worker(CSV_WORKER_URL);
  } catch (error) {
    csvWorker = null;
  }
  return csvWorker;
}

function buildOwnershipFlags(ownedSquares) {
  if (!ownedSquares || ownedSquares.size === 0) return null;
  const flags = new Uint8Array(OWNERSHIP_MAX_SQUARE + 1);
  ownedSquares.forEach((squareId) => {
    if (
      Number.isInteger(squareId) &&
      squareId >= 1 &&
      squareId <= OWNERSHIP_MAX_SQUARE
    ) {
      flags[squareId] = 1;
    }
  });
  return flags;
}

function createBatchProgressOverlay() {
  let overlay = null;
  let messageNode = null;
  let countNode = null;

  const ensureOverlay = () => {
    if (overlay) return;
    overlay = document.createElement("div");
    overlay.className = "personalize-batch__overlay";
    overlay.hidden = true;
    overlay.setAttribute("aria-hidden", "true");
    overlay.innerHTML = `
      <div class="personalize-batch__overlay-card" role="status" aria-live="polite">
        <div class="personalize-batch__overlay-title">Processing CSV</div>
        <div class="personalize-batch__overlay-message">
          <span class="personalize-batch__overlay-text"></span>
          <span class="personalize-batch__overlay-count"></span>
        </div>
      </div>
    `;
    messageNode = overlay.querySelector(".personalize-batch__overlay-text");
    countNode = overlay.querySelector(".personalize-batch__overlay-count");
    document.body.appendChild(overlay);
  };

  const show = (message, processed, total) => {
    ensureOverlay();
    if (!overlay || !messageNode || !countNode) return;
    overlay.hidden = false;
    overlay.setAttribute("aria-hidden", "false");
    messageNode.textContent = message || "Processing CSV";
    if (Number.isFinite(total) && total > 0) {
      const capped = Math.min(processed, total);
      countNode.textContent = ` (${capped}/${total})`;
    } else if (Number.isFinite(processed) && processed > 0) {
      countNode.textContent = ` (${processed})`;
    } else {
      countNode.textContent = "";
    }
  };

  const update = (message, processed, total) => {
    if (!overlay || overlay.hidden) {
      show(message, processed, total);
      return;
    }
    if (messageNode) {
      messageNode.textContent = message || "Processing CSV";
    }
    if (countNode) {
      if (Number.isFinite(total) && total > 0) {
        const capped = Math.min(processed, total);
        countNode.textContent = ` (${capped}/${total})`;
      } else if (Number.isFinite(processed) && processed > 0) {
        countNode.textContent = ` (${processed})`;
      } else {
        countNode.textContent = "";
      }
    }
  };

  const hide = () => {
    if (!overlay) return;
    overlay.hidden = true;
    overlay.setAttribute("aria-hidden", "true");
  };

  return { show, update, hide };
}

function createCsvProgressController() {
  const overlay = createBatchProgressOverlay();
  let visible = false;
  let timer = null;

  const clearTimer = () => {
    if (!timer) return;
    window.clearTimeout(timer);
    timer = null;
  };

  const maybeShow = (message, processed, total) => {
    if (visible) {
      overlay.update(message, processed, total);
      return;
    }
    if (!Number.isFinite(total) || total < CSV_PROGRESS_THRESHOLD) return;
    if (timer) return;
    timer = window.setTimeout(() => {
      timer = null;
      visible = true;
      overlay.show(message, processed, total);
    }, CSV_PROGRESS_DELAY_MS);
  };

  const update = (message, processed, total) => {
    if (visible) {
      overlay.update(message, processed, total);
      return;
    }
    maybeShow(message, processed, total);
  };

  const hide = () => {
    clearTimer();
    if (visible) {
      overlay.hide();
    }
    visible = false;
  };

  return { update, hide };
}

async function parseCsvBatchFileWithWorker(file, options = {}) {
  const worker = getCsvWorker();
  if (!worker) return null;
  const text = await file.text();
  const {
    ownershipReady = false,
    ownedSquares = null,
    titleMax = TITLE_MAX,
    uriMax = URI_MAX,
    onProgress,
  } = options;
  const ownedFlags = ownershipReady ? buildOwnershipFlags(ownedSquares) : null;
  const id = csvWorkerId + 1;
  csvWorkerId = id;

  return new Promise((resolve, reject) => {
    const handleMessage = (event) => {
      const payload = event.data || {};
      if (payload.id !== id) return;
      if (payload.type === "progress") {
        if (typeof onProgress === "function") {
          onProgress(payload);
        }
        return;
      }
      cleanup();
      if (payload.type === "error") {
        reject(new Error(payload.message || "Unable to read CSV."));
        return;
      }
      if (payload.type === "done") {
        const batchMap = new Map();
        (payload.batchEntries || []).forEach((entry) => {
          if (!entry || !Number.isInteger(entry.squareId)) return;
          const patch = {};
          if (entry.patch && typeof entry.patch === "object") {
            if (Object.prototype.hasOwnProperty.call(entry.patch, "title")) {
              patch.title = entry.patch.title;
            }
            if (Object.prototype.hasOwnProperty.call(entry.patch, "uri")) {
              patch.uri = entry.patch.uri;
            }
          }
          batchMap.set(entry.squareId, patch);
        });
        const errors = payload.errors || {};
        const hasErrors = Object.values(errors).some(
          (list) => Array.isArray(list) && list.length > 0
        );
        resolve({
          batchMap,
          errors,
          hasErrors,
          empty: Boolean(payload.empty),
        });
        return;
      }
      reject(new Error("Unable to read CSV."));
    };

    const handleError = () => {
      cleanup();
      reject(new Error("Unable to read CSV."));
    };

    const cleanup = () => {
      worker.removeEventListener("message", handleMessage);
      worker.removeEventListener("error", handleError);
    };

    worker.addEventListener("message", handleMessage);
    worker.addEventListener("error", handleError);

    const payload = {
      id,
      text,
      ownershipReady,
      ownedFlags: ownedFlags || null,
      titleMax,
      uriMax,
      progressInterval: CSV_APPLY_CHUNK_SIZE,
    };
    try {
      if (ownedFlags) {
        worker.postMessage(payload, [ownedFlags.buffer]);
      } else {
        worker.postMessage(payload);
      }
    } catch (error) {
      cleanup();
      reject(error);
    }
  });
}

export function createBatchApplier({ store, clearOverLimitFlags, validateSquareErrors, alertFn }) {
  const alert = alertFn || window.alert.bind(window);

  return async (batchMap, options = {}) => {
    if (!batchMap || batchMap.size === 0) {
      alert("No Squares found in the batch.");
      return;
    }

    const batchIds = Array.from(batchMap.keys());
    const chunkSize = options.chunkSize || CSV_APPLY_CHUNK_SIZE;
    const onProgress = typeof options.onProgress === "function" ? options.onProgress : null;
    const rowsBySquareId = new Map();

    store.getState().rows.forEach((row) => {
      if (row.squareId === null || row.squareId === undefined || row.squareId === "") {
        return;
      }
      if (!rowsBySquareId.has(row.squareId)) {
        rowsBySquareId.set(row.squareId, []);
      }
      rowsBySquareId.get(row.squareId).push(row);
    });

    store.beginBatch();
    try {
      const total = batchIds.length;
      let processed = 0;
      for (let offset = 0; offset < batchIds.length; offset += chunkSize) {
        const end = Math.min(offset + chunkSize, batchIds.length);
        for (let index = offset; index < end; index += 1) {
          const squareId = batchIds[index];
          const patch = batchMap.get(squareId) || {};
          const matches = rowsBySquareId.get(squareId) || [];
          if (matches.length > 0) {
            const [primary, ...duplicates] = matches;
            store.updateRow(primary.id, (row) => {
              Object.assign(row, patch);
              if (Object.prototype.hasOwnProperty.call(patch, "title")) {
                row.errors.title = "";
              }
              if (Object.prototype.hasOwnProperty.call(patch, "uri")) {
                row.errors.uri = "";
              }
              if (Object.prototype.hasOwnProperty.call(patch, "imagePixelsHex")) {
                row.errors.image = "";
              }
            });
            clearOverLimitFlags(primary.id);
            duplicates.forEach((row) => {
              store.removeRow(row.id);
              clearOverLimitFlags(row.id);
            });
          } else {
            const newRow = store.addRow({ squareId, ...patch });
            rowsBySquareId.set(squareId, [newRow]);
          }
        }
        processed = end;
        if (onProgress) {
          onProgress(processed, total);
        }
        if (end < total) {
          await nextFrame();
        }
      }

      store.sortRows();
      validateSquareErrors(false);
    } finally {
      store.endBatch();
    }
  };
}

export function initBatchControls(options) {
  const {
    store,
    elements,
    isValidSquareId,
    applyBatchRows,
    alertFn = window.alert.bind(window),
  } = options;

  const {
    csvBatchDropdown,
    csvBatchTrigger,
    csvBatchInstructions,
    csvBatchDownload,
    csvBatchUpload,
    imageBatchDropdown,
    imageBatchTrigger,
    imageBatchInstructions,
    imageBatchUpload,
  } = elements;

  const dropdowns = [csvBatchDropdown, imageBatchDropdown].filter(Boolean);
  const csvProgress = createCsvProgressController();

  const closeDropdown = (dropdown) => {
    if (dropdown) {
      dropdown.classList.remove("is-open");
    }
  };

  const closeAllDropdowns = (except) => {
    dropdowns.forEach((dropdown) => {
      if (dropdown && dropdown !== except) {
        dropdown.classList.remove("is-open");
      }
    });
  };

  if (csvBatchTrigger && csvBatchDropdown) {
    csvBatchTrigger.addEventListener("click", (event) => {
      event.stopPropagation();
      const willOpen = !csvBatchDropdown.classList.contains("is-open");
      closeAllDropdowns(csvBatchDropdown);
      csvBatchDropdown.classList.toggle("is-open", willOpen);
    });
  }

  if (imageBatchTrigger && imageBatchDropdown) {
    imageBatchTrigger.addEventListener("click", (event) => {
      event.stopPropagation();
      const willOpen = !imageBatchDropdown.classList.contains("is-open");
      closeAllDropdowns(imageBatchDropdown);
      imageBatchDropdown.classList.toggle("is-open", willOpen);
    });
  }

  if (dropdowns.length > 0) {
    document.addEventListener("click", (event) => {
      dropdowns.forEach((dropdown) => {
        if (dropdown && !dropdown.contains(event.target)) {
          dropdown.classList.remove("is-open");
        }
      });
    });
  }

  if (csvBatchInstructions) {
    csvBatchInstructions.addEventListener("click", () => {
      alertFn(CSV_INSTRUCTIONS);
      closeDropdown(csvBatchDropdown);
    });
  }

  if (imageBatchInstructions) {
    imageBatchInstructions.addEventListener("click", () => {
      alertFn(IMAGE_INSTRUCTIONS);
      closeDropdown(imageBatchDropdown);
    });
  }

  if (csvBatchDownload) {
    csvBatchDownload.addEventListener("click", () => {
      const rows = store.getState().rows;
      downloadCsv(rows);
      closeDropdown(csvBatchDropdown);
    });
  }

  if (csvBatchUpload) {
    csvBatchUpload.addEventListener("change", async (event) => {
      const file = event.target.files?.[0];
      closeDropdown(csvBatchDropdown);
      if (!file) {
        return;
      }

      try {
        const state = store.getState();
        const ownershipReady = state.ownershipStatus === "ready" && state.ownedSquares;
        const progressHandler = (payload) => {
          if (!payload || payload.type !== "progress") return;
          const total = Number.isFinite(payload.total) ? payload.total : 0;
          const processed = Number.isFinite(payload.processed) ? payload.processed : 0;
          csvProgress.update("Parsing CSV", processed, total);
        };

        const workerResult = await parseCsvBatchFileWithWorker(file, {
          ownershipReady,
          ownedSquares: state.ownedSquares,
          titleMax: TITLE_MAX,
          uriMax: URI_MAX,
          onProgress: progressHandler,
        });

        const { batchMap, errors, hasErrors, empty } = workerResult
          ? workerResult
          : await parseCsvBatchFile(file, {
              isValidSquareId,
              ownershipReady,
              ownedSquares: state.ownedSquares,
            });

        if (empty) {
          alertFn("No rows found in the CSV.");
          return;
        }

        if (hasErrors) {
          alertFn(buildBatchErrorMessage("CSV upload failed.", errors));
          return;
        }

        const total = batchMap.size;
        csvProgress.update("Applying rows", 0, total);
        await applyBatchRows(batchMap, {
          chunkSize: CSV_APPLY_CHUNK_SIZE,
          onProgress: (processed, totalCount) => {
            csvProgress.update("Applying rows", processed, totalCount);
          },
        });
      } catch (error) {
        alertFn(error?.message || "Unable to read CSV.");
      } finally {
        csvProgress.hide();
        event.target.value = "";
      }
    });
  }

  if (imageBatchUpload) {
    imageBatchUpload.addEventListener("change", async (event) => {
      const files = event.target.files;
      closeDropdown(imageBatchDropdown);
      if (!files || files.length === 0) {
        return;
      }
      try {
        const state = store.getState();
        const { batchMap, errors, hasErrors, alphaWarnings } = await parseImageBatchFiles(files, {
          isValidSquareId,
          ownershipReady: state.ownershipStatus === "ready" && state.ownedSquares,
          ownedSquares: state.ownedSquares,
        });

        if (hasErrors) {
          alertFn(buildBatchErrorMessage("Image upload failed.", errors));
          return;
        }

        await applyBatchRows(batchMap);

        if (alphaWarnings.length > 0) {
          alertFn(
            [
              "WARNING: Some images included transparency and were mixed on white.",
              `Affected Squares: ${alphaWarnings.join(", ")}`,
            ].join("\n")
          );
        }
      } catch (error) {
        alertFn(error?.message || "Unable to read images.");
      } finally {
        event.target.value = "";
      }
    });
  }
}
