import { CSV_TEMPLATE_LINES, TITLE_MAX, URI_MAX } from "../constants.js";
import { createBatchErrorGroups } from "./errors.js";
import {
  byteLength,
  detectDelimiter,
  normalizeSquareId,
  parseSeparatedValues,
} from "../utils.js";

export function downloadCsvTemplate() {
  const blob = new Blob([CSV_TEMPLATE_LINES.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "personalize-template.csv";
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export async function parseCsvBatchFile(file, options) {
  const text = await file.text();
  return parseCsvBatchText(text, options);
}

export function parseCsvBatchText(text, options) {
  const {
    isValidSquareId,
    ownershipReady = false,
    ownedSquares = null,
    titleMax = TITLE_MAX,
    uriMax = URI_MAX,
  } = options;

  const delimiter = detectDelimiter(text);
  const rows = parseSeparatedValues(text, delimiter)
    .map((row) => row.map((cell) => String(cell ?? "").trim()))
    .filter((row) => row.some((cell) => cell.length > 0));

  const errors = createBatchErrorGroups();
  const batchMap = new Map();

  if (rows.length === 0) {
    return { batchMap, errors, hasErrors: true, empty: true };
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

  const duplicates = new Set();
  const seenSquares = new Set();

  for (let index = startIndex; index < rows.length; index += 1) {
    const row = rows[index];
    const rowNumber = index + 1;
    if (row.length < 3) {
      errors.missingColumns.push(`Row ${rowNumber}`);
      continue;
    }

    const [squareText, titleValueRaw, uriValueRaw] = row;
    const titleValue = titleValueRaw || "";
    const uriValue = uriValueRaw || "";
    const squareId = normalizeSquareId(squareText);
    if (!squareId && (titleValue || uriValue)) {
      errors.missingSquare.push(`Row ${rowNumber}`);
      continue;
    }
    if (!squareId || !isValidSquareId(squareId)) {
      if (squareText || titleValue || uriValue) {
        errors.invalidSquare.push(`Row ${rowNumber}`);
      }
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

    if (ownershipReady && ownedSquares && !ownedSquares.has(squareId)) {
      errors.notOwned.push(`#${squareId}`);
    }

    const patch = {};
    if (titleValue.length > 0) {
      patch.title = titleValue;
    }
    if (uriValue.length > 0) {
      patch.uri = uriValue;
    }
    batchMap.set(squareId, patch);

  }

  if (duplicates.size > 0) {
    errors.duplicateSquares = Array.from(duplicates)
      .sort((a, b) => a - b)
      .map((id) => `#${id}`);
  }

  const hasErrors = Object.values(errors).some((list) => list.length > 0);
  return { batchMap, errors, hasErrors, empty: false };
}
