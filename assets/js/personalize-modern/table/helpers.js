import { SQUARE_MAX_DIGITS } from "./constants.js";

const encoder = new TextEncoder();

export function autoResizeTextarea(textarea) {
  textarea.style.height = "auto";
  textarea.style.height = `${textarea.scrollHeight}px`;
}

export function clampToByteLength(value, maxBytes) {
  if (encoder.encode(value).length <= maxBytes) return value;
  let result = "";
  let currentBytes = 0;
  for (const char of value) {
    const nextBytes = encoder.encode(char).length;
    if (currentBytes + nextBytes > maxBytes) break;
    result += char;
    currentBytes += nextBytes;
  }
  return result;
}

export function sanitizeSquareInput(value) {
  const digits = value.replace(/\D/g, "");
  return digits.slice(0, SQUARE_MAX_DIGITS);
}
