import {
  ensureConnected,
  ensureCorrectNetwork,
  isMobileDevice,
  openWalletChooser,
  loadWeb3,
} from "../../web3/foundation.js";
import { createTxFixture } from "../../web3/tx/index.js";
import { getWeb3Config } from "../../web3/config.js";
import { personalizeUnderlay } from "../../web3/services/underlay.js";
import { personalizeUnderlayBatch } from "../../web3/services/underlay-batch.js";
import { buildTxUrl } from "../../web3/services/explorer-links.js";
import { fetchOwnedSquares } from "../../web3/services/ownership.js";
import {
  createPersonalizeStore,
  isRowEmpty,
  isValidSquareId,
  getTitleLength,
  getUriLength,
} from "./store.js";
import { createPersonalizeTable } from "./table.js";
import { initPersonalizeChooser } from "./chooser.js";

const TITLE_MAX = 64;
const URI_MAX = 96;

const CSV_INSTRUCTIONS = [
  "CSV Batch Instructions",
  "- Format: CSV or TSV with columns square_id,title,uri (extra columns ignored).",
  "- Square IDs can be 1 or 00001 (leading zeros are treated the same).",
  "- Title max 64 bytes; URI max 96 bytes.",
  "- If ownership data is loaded, Squares you don't own are rejected.",
  "- Running CSV Batch replaces the table with only those Squares.",
  "- Image Batch is additive only when it targets the same Square set.",
].join("\n");

const IMAGE_INSTRUCTIONS = [
  "Image Batch Instructions",
  "- Upload a folder of 10x10 images named by Square number (1.png or 00001.png).",
  "- Mixed image formats are fine; duplicate names after normalization are rejected.",
  "- If ownership data is loaded, Squares you don't own are rejected.",
  "- Running Image Batch replaces the table with only those Squares.",
  "- CSV Batch is additive only when it targets the same Square set.",
].join("\n");

const CSV_TEMPLATE_LINES = [
  "square_id,title,uri",
  "1,Example Square,https://example.com",
  "00002,Second Example,mailto:hello@example.com",
  "3,Third Example,https://tenthousandsu.com",
];

const overLimitFlags = new Map();

function clearOverLimitFlags(rowId) {
  const prefix = `${rowId}:`;
  Array.from(overLimitFlags.keys()).forEach((key) => {
    if (key.startsWith(prefix)) {
      overLimitFlags.delete(key);
    }
  });
}

function setOverLimitFlag(rowId, field, isOver) {
  const key = `${rowId}:${field}`;
  if (isOver) {
    if (!overLimitFlags.get(key)) {
      overLimitFlags.set(key, true);
      return true;
    }
    return false;
  }
  overLimitFlags.delete(key);
  return false;
}

function summarizeErrors(counts) {
  const messages = [];
  if (counts.incomplete > 0) messages.push(`${counts.incomplete} row(s) are incomplete.`);
  if (counts.invalidSquare > 0) messages.push(`${counts.invalidSquare} invalid Square number(s).`);
  if (counts.duplicate > 0) messages.push(`${counts.duplicate} duplicate Square number(s).`);
  if (counts.ownership > 0) messages.push(`${counts.ownership} Square(s) not owned.`);
  if (counts.overLimit > 0) messages.push(`${counts.overLimit} field(s) exceed limits.`);
  return messages.join("\n");
}

function parseSquareInput(value) {
  if (value === "") return null;
  const num = Number(value);
  if (Number.isNaN(num)) return null;
  return num;
}

function collectDuplicateCounts(rows) {
  const counts = new Map();
  rows.forEach((row) => {
    if (isValidSquareId(row.squareId)) {
      counts.set(row.squareId, (counts.get(row.squareId) || 0) + 1);
    }
  });
  return counts;
}

const encoder = new TextEncoder();

function byteLength(value) {
  return encoder.encode(value || "").length;
}

function normalizeSquareId(value) {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) return null;
  if (!/^\d+$/.test(trimmed)) return null;
  const num = Number.parseInt(trimmed, 10);
  if (!Number.isInteger(num)) return null;
  return num;
}

function detectDelimiter(text) {
  const lines = text.split(/\r\n|\n|\r/);
  const sample = lines.find((line) => line.trim().length > 0) || "";
  if (sample.includes("\t")) return "\t";
  return ",";
}

function parseSeparatedValues(text, delimiter) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];

    if (inQuotes) {
      if (char === "\"") {
        if (text[i + 1] === "\"") {
          field += "\"";
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === "\"") {
      inQuotes = true;
      continue;
    }

    if (char === delimiter) {
      row.push(field);
      field = "";
      continue;
    }

    if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      continue;
    }

    if (char === "\r") {
      if (text[i + 1] === "\n") {
        i += 1;
      }
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      continue;
    }

    field += char;
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}

function buildBatchErrorMessage(title, groups) {
  const lines = [title];
  const addGroup = (label, values) => {
    if (!values || values.length === 0) return;
    lines.push(`${label}: ${values.join(", ")}`);
  };

  addGroup("Rows with missing columns", groups.missingColumns);
  addGroup("Invalid Square numbers", groups.invalidSquare);
  addGroup("Duplicate Squares", groups.duplicateSquares);
  addGroup("Missing titles", groups.titleMissing);
  addGroup("Titles too long", groups.titleTooLong);
  addGroup("Missing URIs", groups.uriMissing);
  addGroup("URIs too long", groups.uriTooLong);
  addGroup("Squares not owned", groups.notOwned);
  addGroup("Invalid filenames", groups.invalidFilenames);
  addGroup("Duplicate image Squares", groups.duplicateImageSquares);
  addGroup("Unreadable images", groups.unreadableImages);
  addGroup("Invalid image size", groups.invalidImageSize);
  addGroup("Animated images", groups.animatedImages);

  return lines.join("\n");
}

function loadImageFromFile(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.addEventListener("load", () => {
      URL.revokeObjectURL(url);
      resolve(image);
    });
    image.addEventListener("error", () => {
      URL.revokeObjectURL(url);
      reject(new Error("Unable to read file"));
    });
    image.src = url;
  });
}

function buildImagePixelsHex(image) {
  const canvas = document.createElement("canvas");
  canvas.width = 10;
  canvas.height = 10;
  const context = canvas.getContext("2d");
  context.drawImage(image, 0, 0);
  const { data } = context.getImageData(0, 0, 10, 10);
  let alphaWarning = false;
  let hex = "0x";
  for (let i = 0; i < data.length; i += 4) {
    const red = data[i];
    const green = data[i + 1];
    const blue = data[i + 2];
    const alpha = data[i + 3];
    const mixedRed = Math.floor((red * alpha + 255 * (255 - alpha)) / 255);
    const mixedGreen = Math.floor((green * alpha + 255 * (255 - alpha)) / 255);
    const mixedBlue = Math.floor((blue * alpha + 255 * (255 - alpha)) / 255);
    if (alpha !== 255) alphaWarning = true;
    hex += mixedRed.toString(16).padStart(2, "0");
    hex += mixedGreen.toString(16).padStart(2, "0");
    hex += mixedBlue.toString(16).padStart(2, "0");
  }
  return { hex, previewUrl: canvas.toDataURL("image/png"), alphaWarning };
}

function extractSquareIdFromFilename(name) {
  const base = String(name || "").replace(/\.[^/.]+$/, "");
  if (!/^\d+$/.test(base)) return null;
  const num = Number.parseInt(base, 10);
  if (!Number.isInteger(num)) return null;
  return num;
}

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

  const validateSquareErrors = (requireFilled = false) => {
    const state = store.getState();
    const counts = collectDuplicateCounts(state.rows);

    state.rows.forEach((row) => {
      let message = "";
      if (row.squareId === null || row.squareId === "") {
        if (requireFilled && !isRowEmpty(row)) {
          message = "Square # is required.";
        }
      } else if (!isValidSquareId(row.squareId)) {
        message = "Square # must be between 1 and 10000.";
      } else if (counts.get(row.squareId) > 1) {
        message = "You already added this Square.";
      } else if (
        state.ownershipStatus === "ready" &&
        state.ownedSquares &&
        !state.ownedSquares.has(row.squareId)
      ) {
        message = "You don't own this Square.";
      }
      store.setRowError(row.id, "square", message);
    });
  };

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

  const applyBatchRows = (batchMap) => {
    if (!batchMap || batchMap.size === 0) {
      alert("No Squares found in the batch.");
      return;
    }

    const batchIds = Array.from(batchMap.keys());
    const stateRows = store.getState().rows.slice();

    stateRows.forEach((row) => {
      if (!batchMap.has(row.squareId)) {
        store.removeRow(row.id);
        clearOverLimitFlags(row.id);
      }
    });

    batchIds.forEach((squareId) => {
      const patch = batchMap.get(squareId) || {};
      const existing = store.getState().rows.find((row) => row.squareId === squareId);
      if (existing) {
        store.updateRow(existing.id, (row) => {
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
        clearOverLimitFlags(existing.id);
      } else {
        store.addRow({ squareId, ...patch });
      }
    });

    store.pruneEmptyRows();
    store.sortRows();
    validateSquareErrors(false);
  };

  const downloadCsvTemplate = () => {
    const blob = new Blob([CSV_TEMPLATE_LINES.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "personalize-template.csv";
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  };

  const handleCsvUpload = async (file) => {
    const text = await file.text();
    const delimiter = detectDelimiter(text);
    const rows = parseSeparatedValues(text, delimiter)
      .map((row) => row.map((cell) => String(cell ?? "").trim()))
      .filter((row) => row.some((cell) => cell.length > 0));

    if (rows.length === 0) {
      alert("No rows found in the CSV.");
      return;
    }

    let startIndex = 0;
    const headerCandidate = rows[0] || [];
    const headerFirst = (headerCandidate[0] || "").toLowerCase();
    const headerSecond = (headerCandidate[1] || "").toLowerCase();
    if (
      (headerFirst.includes("square") || headerFirst.includes("id")) &&
      (headerSecond.includes("title") || headerSecond.includes("uri") || headerSecond.includes("url"))
    ) {
      startIndex = 1;
    }

    const errors = {
      missingColumns: [],
      invalidSquare: [],
      duplicateSquares: [],
      titleMissing: [],
      titleTooLong: [],
      uriMissing: [],
      uriTooLong: [],
      notOwned: [],
      invalidFilenames: [],
      duplicateImageSquares: [],
      unreadableImages: [],
      invalidImageSize: [],
      animatedImages: [],
    };

    const duplicates = new Set();
    const seenSquares = new Set();
    const batchMap = new Map();

    const ownershipReady =
      store.getState().ownershipStatus === "ready" && store.getState().ownedSquares;
    const ownedSquares = store.getState().ownedSquares;

    for (let index = startIndex; index < rows.length; index += 1) {
      const row = rows[index];
      const rowNumber = index + 1;
      if (row.length < 3) {
        errors.missingColumns.push(`Row ${rowNumber}`);
        continue;
      }

      const [squareText, titleValue, uriValue] = row;
      const squareId = normalizeSquareId(squareText);
      if (!squareId || !isValidSquareId(squareId)) {
        errors.invalidSquare.push(`Row ${rowNumber}`);
        continue;
      }

      if (seenSquares.has(squareId)) {
        duplicates.add(squareId);
      } else {
        seenSquares.add(squareId);
      }

      const titleLength = byteLength(titleValue);
      if (titleLength < 1) {
        errors.titleMissing.push(`#${squareId}`);
      } else if (titleLength > TITLE_MAX) {
        errors.titleTooLong.push(`#${squareId}`);
      }

      const uriLength = byteLength(uriValue);
      if (uriLength < 1) {
        errors.uriMissing.push(`#${squareId}`);
      } else if (uriLength > URI_MAX) {
        errors.uriTooLong.push(`#${squareId}`);
      }

      if (ownershipReady && ownedSquares && !ownedSquares.has(squareId)) {
        errors.notOwned.push(`#${squareId}`);
      }

      batchMap.set(squareId, { title: titleValue, uri: uriValue });
    }

    if (duplicates.size > 0) {
      errors.duplicateSquares = Array.from(duplicates)
        .sort((a, b) => a - b)
        .map((id) => `#${id}`);
    }

    const hasErrors = Object.values(errors).some((list) => list.length > 0);
    if (hasErrors) {
      alert(buildBatchErrorMessage("CSV upload failed.", errors));
      return;
    }

    applyBatchRows(batchMap);
  };

  const handleImageUpload = async (files) => {
    const errors = {
      missingColumns: [],
      invalidSquare: [],
      duplicateSquares: [],
      titleMissing: [],
      titleTooLong: [],
      uriMissing: [],
      uriTooLong: [],
      notOwned: [],
      invalidFilenames: [],
      duplicateImageSquares: [],
      unreadableImages: [],
      invalidImageSize: [],
      animatedImages: [],
    };

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

    const ownershipReady =
      store.getState().ownershipStatus === "ready" && store.getState().ownedSquares;
    const ownedSquares = store.getState().ownedSquares;

    if (ownershipReady && ownedSquares) {
      fileMap.forEach((_file, squareId) => {
        if (!ownedSquares.has(squareId)) {
          errors.notOwned.push(`#${squareId}`);
        }
      });
    }

    const batchMap = new Map();
    const alphaWarnings = [];

    await Promise.all(
      Array.from(fileMap.entries()).map(async ([squareId, file]) => {
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
      })
    );

    const hasErrors = Object.values(errors).some((list) => list.length > 0);
    if (hasErrors) {
      alert(buildBatchErrorMessage("Image upload failed.", errors));
      return;
    }

    applyBatchRows(batchMap);

    if (alphaWarnings.length > 0) {
      alert(
        [
          "WARNING: Some images included transparency and were mixed on white.",
          `Affected Squares: ${alphaWarnings.join(", ")}`,
        ].join("\n")
      );
    }
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
      alert(CSV_INSTRUCTIONS);
      closeDropdown(csvBatchDropdown);
    });
  }

  if (imageBatchInstructions) {
    imageBatchInstructions.addEventListener("click", () => {
      alert(IMAGE_INSTRUCTIONS);
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
        await handleCsvUpload(file);
      } catch (error) {
        alert(error?.message || "Unable to read CSV.");
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
        await handleImageUpload(files);
      } catch (error) {
        alert(error?.message || "Unable to read images.");
      } finally {
        event.target.value = "";
      }
    });
  }

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
      overLimitFlags.clear();
      validateSquareErrors(false);
    });
  }

  if (addRowButton) {
    addRowButton.addEventListener("click", () => {
      store.addRow();
      validateSquareErrors(false);
    });
  }

  const { pricing } = getWeb3Config();
  const txUi = createTxFixture({
    target: txFixtureDiv,
    pricing,
    mode: "personalize",
    title: "Personalization status",
  });

  let currentWagmi = null;

  const updateOpenWalletButton = () => {
    if (!openWalletButton) return;
    const isWalletConnect = currentWagmi?.getAccount?.()?.connector?.id === "walletConnect";
    const showButton = isMobileDevice() && isWalletConnect;
    openWalletButton.style.display = showButton ? "inline-block" : "none";
  };

  if (openWalletButton) {
    updateOpenWalletButton();
    openWalletButton.addEventListener("click", () => {
      openWalletChooser();
    });
  }

  function validateForSubmit() {
    store.pruneEmptyRows();
    const state = store.getState();
    const rows = state.rows;

    if (rows.length === 1 && isRowEmpty(rows[0])) {
      alert("Please add at least one Square to personalize.");
      return false;
    }

    const issueRows = {
      incomplete: new Set(),
      invalidSquare: new Set(),
      duplicate: new Set(),
      ownership: new Set(),
      overLimit: new Set(),
    };

    const duplicateCounts = collectDuplicateCounts(rows);

    rows.forEach((row) => {
      const errors = { square: "", title: "", uri: "", image: "" };
      const hasData = !isRowEmpty(row);
      const hasSquare =
        row.squareId !== null &&
        row.squareId !== undefined &&
        row.squareId !== "";
      const titleLength = getTitleLength(row);
      const uriLength = getUriLength(row);

      if (!hasSquare) {
        if (hasData) {
          errors.square = "Square # is required.";
          issueRows.incomplete.add(row.id);
        }
      } else if (!isValidSquareId(row.squareId)) {
        errors.square = "Square # must be between 1 and 10000.";
        issueRows.invalidSquare.add(row.id);
      } else if (duplicateCounts.get(row.squareId) > 1) {
        errors.square = "You already added this Square.";
        issueRows.duplicate.add(row.id);
      } else if (
        state.ownershipStatus === "ready" &&
        state.ownedSquares &&
        !state.ownedSquares.has(row.squareId)
      ) {
        errors.square = "You don't own this Square.";
        issueRows.ownership.add(row.id);
      }

      if (titleLength > TITLE_MAX) {
        errors.title = "Text is too long.";
        issueRows.overLimit.add(row.id);
      } else if (titleLength < 1 && hasData) {
        errors.title = "Text is required.";
        issueRows.incomplete.add(row.id);
      }

      if (uriLength > URI_MAX) {
        errors.uri = "URI is too long.";
        issueRows.overLimit.add(row.id);
      } else if (uriLength < 1 && hasData) {
        errors.uri = "URI is required.";
        issueRows.incomplete.add(row.id);
      }

      if (!row.imagePixelsHex && hasData) {
        errors.image = "Upload an image.";
        issueRows.incomplete.add(row.id);
      }

      store.setRowErrors(row.id, errors);
    });

    const counts = {
      incomplete: issueRows.incomplete.size,
      invalidSquare: issueRows.invalidSquare.size,
      duplicate: issueRows.duplicate.size,
      ownership: issueRows.ownership.size,
      overLimit: issueRows.overLimit.size,
    };

    const hasErrors =
      counts.incomplete ||
      counts.invalidSquare ||
      counts.duplicate ||
      counts.ownership ||
      counts.overLimit;

    if (hasErrors) {
      alert(summarizeErrors(counts));
      return false;
    }

    validateSquareErrors(true);
    return true;
  }

  function markOwnershipErrorsFromTx(message) {
    if (!message || typeof message !== "string") return;
    const state = store.getState();
    const rows = state.rows;
    const matchedNumbers = Array.from(message.matchAll(/#?(\d{1,5})/g))
      .map((match) => Number(match[1]))
      .filter((num) => Number.isInteger(num));

    if (matchedNumbers.length > 0) {
      matchedNumbers.forEach((num) => {
        rows.forEach((row) => {
          if (row.squareId === num) {
            store.setRowError(row.id, "square", "You don't own this Square.");
          }
        });
      });
      return;
    }

    if (/own|owner/i.test(message)) {
      const notOwned =
        state.ownedSquares && state.ownedSquares.size > 0
          ? rows.filter(
              (row) => isValidSquareId(row.squareId) && !state.ownedSquares.has(row.squareId)
            )
          : rows;
      notOwned.forEach((row) => {
        store.setRowError(row.id, "square", "You don't own this Square.");
      });
    }
  }

  personalizeButton.addEventListener("click", async () => {
    if (!validateForSubmit()) return;

    const { rows } = store.getState();
    if (rows.length === 0) {
      alert("Please add at least one Square to personalize.");
      return;
    }

    const isBatch = rows.length > 1;
    const message = isBatch
      ? "Personalizing your Squares. Confirm in your wallet to continue."
      : `Personalizing Square #${rows[0].squareId}. Confirm in your wallet to continue.`;

    txUi.startProcessing(message);

    const doSendTransaction = async (wagmi) => {
      const isWalletConnect = wagmi?.getAccount?.()?.connector?.id === "walletConnect";
      txUi.setWalletContext({ isWalletConnect });
      if (isMobileDevice() && isWalletConnect) {
        openWalletChooser();
      }

      try {
        const state = store.getState();
        const account = wagmi.getAccount?.();
        if (account?.address && state.ownershipStatus !== "ready") {
          try {
            const owned = await fetchOwnedSquares(account.address, wagmi);
            store.setOwnedSquares(owned);
            store.setOwnershipStatus("ready");
            validateSquareErrors(true);
          } catch (error) {
            store.setOwnershipStatus("error", error?.message || "Unable to fetch ownership.");
            alert("Unable to verify ownership. Continuing without pre-validation.");
          }
        }

        const ownershipErrors = store
          .getState()
          .rows.some((row) => row.errors.square && /own/i.test(row.errors.square));
        if (ownershipErrors) {
          txUi.markError("One or more Squares are not owned.");
          alert("One or more Squares are not owned.");
          return;
        }

        let result;
        if (isBatch) {
          const payload = rows.map((row) => ({
            squareId: row.squareId,
            rgbData: row.imagePixelsHex,
            title: row.title,
            href: row.uri,
          }));
          result = await personalizeUnderlayBatch(payload, wagmi);
        } else {
          const row = rows[0];
          result = await personalizeUnderlay(
            {
              squareId: row.squareId,
              imagePixelsHex: row.imagePixelsHex,
              title: row.title,
              url: row.uri,
            },
            wagmi
          );
        }

        const pendingUrl = buildTxUrl(result.hash);
        txUi.addPending(result.hash, pendingUrl);
        const transaction = await wagmi.waitForTransaction({ hash: result.hash });
        const txUrl = buildTxUrl(transaction.transactionHash);
        txUi.markSuccess(
          transaction.transactionHash,
          txUrl,
          "Transaction confirmed. Your image will show on the Su Squares homepage, which refreshes hourly."
        );
      } catch (error) {
        const message = error?.message || "Transaction failed";
        txUi.markError(message);
        markOwnershipErrorsFromTx(message);
        alert(message);
      }
    };

    try {
      await ensureConnected(async (clients) => {
        currentWagmi = clients;
        updateOpenWalletButton();
        await ensureCorrectNetwork(clients);
        const { activeNetwork } = getWeb3Config();
        const account = clients.getAccount?.();
        if (account?.address) {
          txUi.setBalanceContext({
            address: account.address,
            chainId: activeNetwork.chainId,
            fetcher: (addr, chain) => clients.fetchBalance({ address: addr, chainId: chain }),
          });
        }
        await doSendTransaction(clients);
      });
    } catch (error) {
      const message = error?.message || "Unable to connect wallet.";
      txUi.markError(message);
      alert(message);
    }
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
