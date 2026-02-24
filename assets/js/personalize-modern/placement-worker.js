const GRID_DIMENSION = 100;
const TILE_SIZE = 10;

function coordsToSquare(row, col) {
  return row * GRID_DIMENSION + col + 1;
}

self.onmessage = (event) => {
  const payload = event.data || {};
  const {
    id,
    bitmap,
    widthSquares,
    heightSquares,
    row = 0,
    col = 0,
    chunkSize = 200,
  } = payload;

  if (!bitmap || !widthSquares || !heightSquares) {
    self.postMessage({
      id,
      type: "error",
      message: "Missing placement data.",
    });
    return;
  }

  const process = async () => {
    const widthPx = widthSquares * TILE_SIZE;
    const heightPx = heightSquares * TILE_SIZE;
    const canvas = new OffscreenCanvas(widthPx, heightPx);
    const context = canvas.getContext("2d", { willReadFrequently: true });
    context.drawImage(bitmap, 0, 0, widthPx, heightPx);
    const { data } = context.getImageData(0, 0, widthPx, heightPx);

    const previewCanvas = new OffscreenCanvas(TILE_SIZE, TILE_SIZE);
    const previewContext = previewCanvas.getContext("2d");
    const previewImageData = previewContext.createImageData(TILE_SIZE, TILE_SIZE);
    const reader = new FileReaderSync();

    const total = widthSquares * heightSquares;
    const tiles = new Array(total);
    let processed = 0;
    let alphaWarning = false;

    for (let y = 0; y < heightSquares; y += 1) {
      for (let x = 0; x < widthSquares; x += 1) {
        let hex = "0x";
        for (let py = 0; py < TILE_SIZE; py += 1) {
          for (let px = 0; px < TILE_SIZE; px += 1) {
            const sourceIndex =
              ((y * TILE_SIZE + py) * widthPx + (x * TILE_SIZE + px)) * 4;
            const red = data[sourceIndex];
            const green = data[sourceIndex + 1];
            const blue = data[sourceIndex + 2];
            const alpha = data[sourceIndex + 3];
            const mixedRed = Math.floor((red * alpha + 255 * (255 - alpha)) / 255);
            const mixedGreen = Math.floor(
              (green * alpha + 255 * (255 - alpha)) / 255
            );
            const mixedBlue = Math.floor((blue * alpha + 255 * (255 - alpha)) / 255);
            if (alpha !== 255) alphaWarning = true;
            hex += mixedRed.toString(16).padStart(2, "0");
            hex += mixedGreen.toString(16).padStart(2, "0");
            hex += mixedBlue.toString(16).padStart(2, "0");

            const targetIndex = (py * TILE_SIZE + px) * 4;
            previewImageData.data[targetIndex] = mixedRed;
            previewImageData.data[targetIndex + 1] = mixedGreen;
            previewImageData.data[targetIndex + 2] = mixedBlue;
            previewImageData.data[targetIndex + 3] = 255;
          }
        }

        previewContext.putImageData(previewImageData, 0, 0);
        const blob = await previewCanvas.convertToBlob({ type: "image/png" });
        const previewUrl = reader.readAsDataURL(blob);
        const squareId = coordsToSquare(row + y, col + x);
        tiles[processed] = {
          squareId,
          imagePixelsHex: hex,
          imagePreviewUrl: previewUrl,
        };
        processed += 1;

        if (chunkSize > 0 && processed % chunkSize === 0) {
          self.postMessage({
            id,
            type: "progress",
            processed,
            total,
          });
        }
      }
    }

    self.postMessage({
      id,
      type: "done",
      tiles,
      alphaWarning,
      total,
    });
  };

  process()
    .catch((error) => {
      self.postMessage({
        id,
        type: "error",
        message: error?.message || "Placement processing failed.",
      });
    })
    .finally(() => {
      if (bitmap && typeof bitmap.close === "function") {
        bitmap.close();
      }
    });
};
