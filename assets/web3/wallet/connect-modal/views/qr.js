import { renderQr as renderQrCanvas } from "../../qr.js";

/**
 * @param {HTMLElement} target
 * @param {{ qrUri: string, copied: boolean }} state
 * @param {{ onCopy: () => void, onOpenWallet: () => void }} actions
 */
export function renderQrView(target, state, actions) {
  if (!target) return;
  const baseurl = window.SITE_BASEURL || '';
  target.innerHTML = `
    <div class="wallet-modal__header">
      <h2 id="wallet-qr-title">Scan with wallet</h2>
    </div>
    <div class="wallet-qr">
      <div class="wallet-qr__container">
        <div class="wallet-qr__placeholder" id="wallet-qr-placeholder">
          <span class="wallet-qr__loading-text">Generating QR...</span>
        </div>
        <canvas
          id="wallet-qr-canvas"
          width="220"
          height="220"
          role="img"
          aria-label="WalletConnect QR code for mobile wallet"
          style="display: none;"
        ></canvas>
        <img
          src="${window.location.origin}${baseurl}/assets/images/logo-su-squares.png"
          alt="Su Squares"
          class="wallet-qr__logo"
        />
      </div>
      <div class="wallet-actions">
        <button class="wallet-btn" type="button" data-copy>${state.copied ? "Copied!" : "Copy link"}</button>
        <button class="wallet-btn" type="button" data-open-wallet>Open mobile wallet</button>
      </div>
    </div>
  `;

  target.querySelector("[data-copy]")?.addEventListener("click", actions.onCopy);
  target.querySelector("[data-open-wallet]")?.addEventListener("click", actions.onOpenWallet);

  const canvas = target.querySelector("#wallet-qr-canvas");
  const placeholder = target.querySelector("#wallet-qr-placeholder");
  const logo = target.querySelector(".wallet-qr__logo");

  if (canvas && state.qrUri) {
    renderQrCanvas(canvas, state.qrUri)
      .then(() => {
        if (placeholder) placeholder.style.display = "none";
        canvas.style.display = "block";
        canvas.classList.add("wallet-fade");
        if (logo) logo.classList.add("wallet-qr__logo--visible");
      })
      .catch((error) => {
        console.error("QR render failed", error);
        if (placeholder) {
          placeholder.innerHTML = '<span class="wallet-qr__loading-text">QR generation failed</span>';
        }
      });
  }
}
