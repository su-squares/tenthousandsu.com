const encoder = new TextEncoder();

export function byteLength(value) {
  return encoder.encode(value || "").length;
}

export function normalizeSquareId(value) {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) return null;
  if (!/^\d+$/.test(trimmed)) return null;
  const num = Number.parseInt(trimmed, 10);
  if (!Number.isInteger(num)) return null;
  return num;
}

export function detectDelimiter(text) {
  const lines = text.split(/\r\n|\n|\r/);
  const sample = lines.find((line) => line.trim().length > 0) || "";
  if (sample.includes("\t")) return "\t";
  return ",";
}

export function parseSeparatedValues(text, delimiter) {
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

export function loadImageFromFile(file) {
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

export function buildImagePixelsHex(image) {
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

export function extractSquareIdFromFilename(name) {
  const base = String(name || "").replace(/\.[^/.]+$/, "");
  if (!/^\d+$/.test(base)) return null;
  const num = Number.parseInt(base, 10);
  if (!Number.isInteger(num)) return null;
  return num;
}

export function parseSquareInput(value) {
  if (value === "") return null;
  const num = Number(value);
  if (Number.isNaN(num)) return null;
  return num;
}
