import fs from "fs";
import path from "path";
import sharp from "sharp";
import { INDIVIDUAL_SQUARE_EDGE_PIXELS, row, column } from "./geometry.mjs";

function safeRead(file, encoding = "utf-8") {
  if (!fs.existsSync(file)) return null;
  try {
    return fs.readFileSync(file, encoding);
  } catch (_err) {
    return null;
  }
}

async function loadBaseBoard({ emptyBoardPath, builtBoardPath }) {
  if (fs.existsSync(builtBoardPath)) {
    return fs.readFileSync(builtBoardPath);
  }
  if (fs.existsSync(emptyBoardPath)) {
    return fs.readFileSync(emptyBoardPath);
  }
  // Create a blank gray board if no template exists
  const blank = await sharp({
    create: {
      width: INDIVIDUAL_SQUARE_EDGE_PIXELS * 100,
      height: INDIVIDUAL_SQUARE_EDGE_PIXELS * 100,
      channels: 3,
      background: { r: 230, g: 230, b: 230 },
    },
  })
    .png()
    .toBuffer();
  fs.mkdirSync(path.dirname(builtBoardPath), { recursive: true });
  fs.writeFileSync(builtBoardPath, blank);
  return blank;
}

function createImagePipeline({ repoRoot, buildDir, metadataDir }) {
  const EMPTY_BOARD = path.join(repoRoot, "assets", "empty-board.png");
  const BUILT_BOARD = path.join(buildDir, "wholeSquare.png");
  const fontBase64 = safeRead(path.join(repoRoot, "assets", "Inter-bold-subset.txt")) || "";
  const composites = [];

  function publishEmptySquareImage(squareNumber) {
    const paddedSquareNumber = ("00000" + squareNumber).slice(-5);
    const svg = [
      `<svg width="800" height="1000" xmlns="http://www.w3.org/2000/svg">`,
      `<defs>`,
        `<style>`,
        fontBase64 ? `@font-face {font-family:'Inter';src:url('data:font/woff2;base64,${fontBase64}')}` : "",
        `</style>`,
      `<linearGradient id="g" x1="0" x2="1" y1="0" y2="1">`,
      `<stop offset="0%" stop-color="#2d3c96"/>`,
      `<stop offset="100%" stop-color="#d53392"/>`,
      `</linearGradient>`,
      `</defs>`,
      `<rect x="10" y="10" width="780" height="980" fill="url(#g)" rx="50" ry="50" stroke="gold" stroke-width="20"/>`,
      `<text x="400" y="570" text-anchor="middle" style="font-family:'Inter';font-size:200px;fill:gold;">${paddedSquareNumber}</text>`,
      `</svg>`,
    ].join("");
    fs.writeFileSync(path.join(metadataDir, `${paddedSquareNumber}.svg`), svg);
  }

  function publishSquareImageWithRGBData(squareNumber, rgbData) {
    const paddedSquareNumber = ("00000" + squareNumber).slice(-5);
    const svgPixels = [];
    for (let x = 0; x < INDIVIDUAL_SQUARE_EDGE_PIXELS; x++) {
      for (let y = 0; y < INDIVIDUAL_SQUARE_EDGE_PIXELS; y++) {
        const pixelNum = y * INDIVIDUAL_SQUARE_EDGE_PIXELS + x;
        const rgbPixel = rgbData.slice(pixelNum * 3, pixelNum * 3 + 3);
        const rgbPixelHex = rgbPixel.toString("hex");
        svgPixels.push(`<rect x="${x}" y="${y}" width="1" height="1" fill="#${rgbPixelHex}" />`);
      }
    }
    const svg = [
      `<svg width="800" height="1000" xmlns="http://www.w3.org/2000/svg">`,
      `<defs>`,
        `<style>`,
        fontBase64 ? `@font-face {font-family:'Inter';src:url('data:font/woff2;base64,${fontBase64}')}` : "",
        `</style>`,
      `<linearGradient id="g" x1="0" x2="1" y1="0" y2="1">`,
      `<stop offset="0%" stop-color="#2d3c96"/>`,
      `<stop offset="100%" stop-color="#d53392"/>`,
      `</linearGradient>`,
      `</defs>`,
      `<rect x="10" y="10" width="780" height="980" fill="url(#g)" rx="50" ry="50" stroke="gold" stroke-width="20"/>`,
      `<text x="400" y="920" text-anchor="middle" style="font-family:'Inter';font-size:200px;fill:gold">${paddedSquareNumber}</text>`,
      `<g transform="translate(80 80) scale(64)">`,
      ...svgPixels,
      `</g>`,
      `</svg>`,
    ].join("");
    fs.writeFileSync(path.join(metadataDir, `${paddedSquareNumber}.svg`), svg);
  }

  function paintSuSquare(squareNumber, rgbData) {
    const zeroBasedColumn = column(squareNumber) - 1;
    const zeroBasedRow = row(squareNumber) - 1;

    composites.push({
      input: rgbData,
      raw: { width: INDIVIDUAL_SQUARE_EDGE_PIXELS, height: INDIVIDUAL_SQUARE_EDGE_PIXELS, channels: 3 },
      left: INDIVIDUAL_SQUARE_EDGE_PIXELS * zeroBasedColumn,
      top: INDIVIDUAL_SQUARE_EDGE_PIXELS * zeroBasedRow,
    });
  }

  async function saveWholeSuSquare() {
    const inputBuffer = await loadBaseBoard({ emptyBoardPath: EMPTY_BOARD, builtBoardPath: BUILT_BOARD });
    return sharp(inputBuffer).composite(composites).toFile(BUILT_BOARD);
  }

  return { publishEmptySquareImage, publishSquareImageWithRGBData, paintSuSquare, saveWholeSuSquare, BUILT_BOARD };
}

export { createImagePipeline };
