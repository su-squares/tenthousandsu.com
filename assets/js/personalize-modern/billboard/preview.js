import { isValidSquareId } from "../store.js";

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

export function buildPreviewRows(rows) {
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

export function buildErrorMap(rows) {
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

export function getSelectedSquares(rows) {
  const selected = new Set();
  rows.forEach((row) => {
    if (isValidSquareId(row.squareId)) {
      selected.add(row.squareId);
    }
  });
  return selected;
}
