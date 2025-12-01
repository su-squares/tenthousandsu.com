/**
 * Lazy QR code generator with gradient support using qr-creator.
 * @module qr
 */

const QR_LIB_URL = "/assets/web3/vendor/qr-creator-bundle.js";
let qrLibPromise = null;

async function loadQrLib() {
  if (qrLibPromise) return qrLibPromise;
  qrLibPromise = import(QR_LIB_URL);
  return qrLibPromise;
}

/**
 * Render a gradient QR code into a canvas element.
 * @param {HTMLCanvasElement} canvas
 * @param {string} value
 * @returns {Promise<void>}
 */
export async function renderQr(canvas, value) {
  if (!canvas || !value) return;
  const qrLib = await loadQrLib();
  const QrCreator = qrLib?.default || qrLib?.QrCreator || qrLib;
  if (!QrCreator || typeof QrCreator.render !== "function") {
    throw new Error("QR code library failed to load");
  }

  const size = 220;

  return QrCreator.render(
    {
      text: value,
      size: size,
      ecLevel: "M",
      radius: 0.5,
      fill: {
        type: "linear-gradient",
        position: [0, 0, 1, 1],
        colorStops: [
          [0, "#2d3c96"],
          [1, "#d53392"]
        ]
      },
      background: "#000000",
      quiet: 2
    },
    canvas
  );
}
