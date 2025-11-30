import { ensureBackButton } from "./back-button.js";

let overlayEl = null;
let modalEl = null;
let contentEl = null;
let closeHandler = null;
let backBtn = null;

function setBackHandler(handler) {
  backBtn = ensureBackButton(modalEl, handler);
}

function ensureElements() {
  if (overlayEl) return;

  overlayEl = document.createElement("div");
  overlayEl.className = "wallet-overlay";
  overlayEl.setAttribute("role", "dialog");
  overlayEl.setAttribute("aria-modal", "true");
  overlayEl.setAttribute("id", "wallet-info-modal");
  overlayEl.addEventListener("click", (event) => {
    if (event.target === overlayEl) {
      closeInfoModal();
    }
  });

  modalEl = document.createElement("div");
  modalEl.className = "wallet-modal";
  contentEl = document.createElement("div");

  const closeBtn = document.createElement("button");
  closeBtn.className = "wallet-close";
  closeBtn.type = "button";
  closeBtn.setAttribute("aria-label", "Close");
  closeBtn.textContent = "✕";
  closeBtn.addEventListener("click", closeInfoModal);

  modalEl.appendChild(closeBtn);
  modalEl.appendChild(contentEl);
  overlayEl.appendChild(modalEl);
  document.body.appendChild(overlayEl);

  setBackHandler(null);
}

function showOverlay() {
  ensureElements();
  overlayEl.classList.add("is-visible");
}

export function closeInfoModal() {
  if (!overlayEl) return;
  overlayEl.classList.remove("is-visible");
  if (closeHandler) closeHandler();
}

function render(onBack) {
  contentEl.innerHTML = `
    <div class="wallet-modal__header">
      <h2>What does a wallet do?</h2>
    </div>

    <div class="wallet-checklist">
      <div class="wallet-checklist-item">Holds your crypto and NFTs</div>
      <div class="wallet-checklist-item">Lets you send and receive crypto</div>
      <div class="wallet-checklist-item">Let's you sign in to dApps securely</div>
      <div class="wallet-checklist-item">Gives you an identity in the blockchain</div>
    </div>

    <div class="wallet-info-text">
      <p>You can get one as a standalone mobile app or a desktop browser extension.</p>
      <p>You need a wallet to own Squares.</p>
    </div>

    <div class="wallet-actions">
      <a href="https://ethereum.org/wallets/find-wallet/" target="_blank" rel="noopener noreferrer" class="wallet-info-btn">Get a wallet</a>
    </div>
  `;

  setBackHandler(() => {
    closeInfoModal();
    if (onBack) onBack();
  });
}

/**
 * Open the info modal.
 * @param {Function} onBack - Callback to execute when back arrow is clicked (e.g., to reopen connect modal)
 * @returns {Promise<void>}
 */
export async function openInfoModal(onBack = null) {
  closeHandler = null;
  showOverlay();
  render(onBack);

  return new Promise((resolve) => {
    closeHandler = () => resolve();
  });
}
