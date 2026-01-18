import { CSV_INSTRUCTIONS, IMAGE_INSTRUCTIONS } from "../constants.js";
import { buildBatchErrorMessage } from "./errors.js";
import { downloadCsvTemplate, parseCsvBatchFile } from "./csv.js";
import { parseImageBatchFiles } from "./images.js";

export function createBatchApplier({ store, clearOverLimitFlags, validateSquareErrors, alertFn }) {
  const alert = alertFn || window.alert.bind(window);

  return (batchMap) => {
    if (!batchMap || batchMap.size === 0) {
      alert("No Squares found in the batch.");
      return;
    }

    const batchIds = Array.from(batchMap.keys());
    const stateRows = store.getState().rows.slice();

    batchIds.forEach((squareId) => {
      const patch = batchMap.get(squareId) || {};
      const matches = store.getState().rows.filter((row) => row.squareId === squareId);
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
        store.addRow({ squareId, ...patch });
      }
    });

    store.sortRows();
    validateSquareErrors(false);
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
      downloadCsvTemplate();
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
        const { batchMap, errors, hasErrors, empty } = await parseCsvBatchFile(file, {
          isValidSquareId,
          ownershipReady: state.ownershipStatus === "ready" && state.ownedSquares,
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

        applyBatchRows(batchMap);
      } catch (error) {
        alertFn(error?.message || "Unable to read CSV.");
      } finally {
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

        applyBatchRows(batchMap);

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
