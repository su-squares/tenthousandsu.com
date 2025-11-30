/**
 * Lazy QR code generator using a tiny client-side library.
 * @module qr
 */

const QR_LIB_URL = "https://esm.sh/qrcode@1.5.3";
let qrLibPromise = null;

async function loadQrLib() {
  if (qrLibPromise) return qrLibPromise;
  qrLibPromise = import(QR_LIB_URL);
  return qrLibPromise;
}

/**
 * Render a QR code into a canvas element.
 * @param {HTMLCanvasElement} canvas
 * @param {string} value
 * @returns {Promise<void>}
 */
export async function renderQr(canvas, value) {
  if (!canvas || !value) return;
  const qrLib = await loadQrLib();
  const QRCode = qrLib?.default || qrLib?.QRCode || qrLib;
  if (!QRCode || typeof QRCode.toCanvas !== "function") {
    throw new Error("QR code library failed to load");
  }
  return QRCode.toCanvas(canvas, value, {
    errorCorrectionLevel: "M",
    margin: 2,
    width: 200,
    color: {
      dark: "#ffd700",
      light: "#000000",
    },
  });
}
