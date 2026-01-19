const TITLE_MAX_DEFAULT = 64;
const URI_MAX_DEFAULT = 96;
const MAX_SQUARE_ID = 10000;
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

function isValidSquareId(value) {
  return Number.isInteger(value) && value >= 1 && value <= MAX_SQUARE_ID;
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

function createBatchErrorGroups() {
  return {
    missingColumns: [],
    missingSquare: [],
    invalidSquare: [],
    duplicateSquares: [],
    titleTooLong: [],
    uriTooLong: [],
    notOwned: [],
    invalidFilenames: [],
    duplicateImageSquares: [],
    unreadableImages: [],
    invalidImageSize: [],
    animatedImages: [],
  };
}

self.onmessage = (event) => {
  const payload = event.data || {};
  const {
    id,
    text,
    ownershipReady = false,
    ownedFlags = null,
    titleMax = TITLE_MAX_DEFAULT,
    uriMax = URI_MAX_DEFAULT,
    progressInterval = 200,
  } = payload;

  if (typeof text !== "string") {
    self.postMessage({
      id,
      type: "error",
      message: "Missing CSV data.",
    });
    return;
  }

  const errors = createBatchErrorGroups();
  const ownedSet =
    ownedFlags instanceof Uint8Array
      ? ownedFlags
      : ownedFlags instanceof ArrayBuffer
        ? new Uint8Array(ownedFlags)
        : null;
  const delimiter = detectDelimiter(text);
  const rows = parseSeparatedValues(text, delimiter)
    .map((row) => row.map((cell) => String(cell ?? "").trim()))
    .filter((row) => row.some((cell) => cell.length > 0));

  if (rows.length === 0) {
    self.postMessage({
      id,
      type: "done",
      batchEntries: [],
      errors,
      empty: true,
    });
    return;
  }

  let startIndex = 0;
  const headerCandidate = rows[0] || [];
  const headerFirst = (headerCandidate[0] || "").toLowerCase();
  const headerSecond = (headerCandidate[1] || "").toLowerCase();
  if (
    (headerFirst.includes("square") || headerFirst.includes("id")) &&
    (headerSecond.includes("title") ||
      headerSecond.includes("uri") ||
      headerSecond.includes("url"))
  ) {
    startIndex = 1;
  }

  const duplicates = new Set();
  const seenSquares = new Set();
  const batchEntries = [];
  const entryIndex = new Map();
  const total = rows.length - startIndex;
  let processed = 0;

  for (let index = startIndex; index < rows.length; index += 1) {
    const row = rows[index];
    const rowNumber = index + 1;
    if (row.length < 3) {
      errors.missingColumns.push(`Row ${rowNumber}`);
      processed += 1;
      continue;
    }

    const [squareText, titleValueRaw, uriValueRaw] = row;
    const titleValue = titleValueRaw || "";
    const uriValue = uriValueRaw || "";
    const squareId = normalizeSquareId(squareText);

    if (!squareId && (titleValue || uriValue)) {
      errors.missingSquare.push(`Row ${rowNumber}`);
      processed += 1;
      continue;
    }
    if (!squareId || !isValidSquareId(squareId)) {
      if (squareText || titleValue || uriValue) {
        errors.invalidSquare.push(`Row ${rowNumber}`);
      }
      processed += 1;
      continue;
    }

    if (seenSquares.has(squareId)) {
      duplicates.add(squareId);
    } else {
      seenSquares.add(squareId);
    }

    const titleLength = byteLength(titleValue);
    if (titleLength > titleMax) {
      errors.titleTooLong.push(`#${squareId}`);
    }

    const uriLength = byteLength(uriValue);
    if (uriLength > uriMax) {
      errors.uriTooLong.push(`#${squareId}`);
    }

    if (ownershipReady && ownedSet && !ownedSet[squareId]) {
      errors.notOwned.push(`#${squareId}`);
    }

    const patch = {};
    if (titleValue.length > 0) {
      patch.title = titleValue;
    }
    if (uriValue.length > 0) {
      patch.uri = uriValue;
    }

    if (entryIndex.has(squareId)) {
      batchEntries[entryIndex.get(squareId)] = { squareId, patch };
    } else {
      entryIndex.set(squareId, batchEntries.length);
      batchEntries.push({ squareId, patch });
    }

    processed += 1;
    if (progressInterval > 0 && processed % progressInterval === 0) {
      self.postMessage({
        id,
        type: "progress",
        processed,
        total,
      });
    }
  }

  if (duplicates.size > 0) {
    errors.duplicateSquares = Array.from(duplicates)
      .sort((a, b) => a - b)
      .map((squareId) => `#${squareId}`);
  }

  self.postMessage({
    id,
    type: "progress",
    processed: total,
    total,
  });

  self.postMessage({
    id,
    type: "done",
    batchEntries,
    errors,
    empty: false,
  });
};
