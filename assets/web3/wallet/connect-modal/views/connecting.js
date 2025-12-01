import { CONNECTING_VARIANT } from "../constants.js";

/**
 * Render the connecting state.
 * @param {HTMLElement} target
 * @param {Object} options
 * @param {string} options.variant
 * @param {boolean} options.hasUri
 * @param {Function} options.onCancel
 * @param {Function} options.onOpenWallet
 * @param {Function} [options.onShowQr]
 */
export function renderConnectingView(target, options = {}) {
  if (!target) return;
  const {
    variant = CONNECTING_VARIANT.DEFAULT,
    hasUri = false,
    onCancel = () => {},
    onOpenWallet = () => {},
    onShowQr = () => {},
  } = options;

  const isWalletConnect = variant === CONNECTING_VARIANT.WALLETCONNECT;

  target.innerHTML = `
    <div class="wallet-modal__header">
      <h2 class="wallet-connecting-heading">
        <span class="wallet-connecting-text">
          <span>Connecting</span><span class="wallet-connecting-dots" aria-hidden="true"></span>
        </span>
      </h2>
    </div>
    <p class="wallet-helper wallet-helper--spaced">Check your wallet to approve the request.</p>
    <div class="wallet-actions">
      <button class="wallet-btn wallet-btn--ghost" type="button" data-cancel>Cancel</button>
      ${
        isWalletConnect
          ? `
            <button class="wallet-btn" type="button" data-open-wallet>Open wallet app</button>
            <button class="wallet-btn" type="button" data-show-qr>Show QR</button>
          `
          : hasUri
          ? `<button class="wallet-btn" type="button" data-open-wallet>Open wallet app</button>`
          : ""
      }
    </div>
  `;

  target.querySelector("[data-cancel]")?.addEventListener("click", onCancel);
  target.querySelector("[data-open-wallet]")?.addEventListener("click", onOpenWallet);
  if (isWalletConnect) {
    target.querySelector("[data-show-qr]")?.addEventListener("click", onShowQr);
  }
}
