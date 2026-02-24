import { createModalShell } from "../base/modal-shell.js";

let shell = null;
let closeHandler = null;

const ensureShell = () => {
  if (shell) return shell;
  shell = createModalShell({
    id: "wallet-info-modal",
    onRequestClose: () => closeInfoModal(),
    onOverlayDismiss: () => closeInfoModal(),
    mountImmediately: true,
  });
  return shell;
};

export function closeInfoModal() {
  if (!shell) return;
  shell.hide();
  if (closeHandler) closeHandler();
}

function render(onBack) {
  const modalShell = ensureShell();
  const target = modalShell.content;
  if (!target) return;

  modalShell.setAria({ labelledBy: "wallet-info-title", describedBy: "wallet-info-text" });

  target.innerHTML = `
    <div class="wallet-modal__header">
      <h2 id="wallet-info-title">What does a wallet do?</h2>
    </div>

    <div class="wallet-checklist">
      <div class="wallet-checklist-item">Holds your crypto and NFTs</div>
      <div class="wallet-checklist-item">Lets you send and receive crypto</div>
      <div class="wallet-checklist-item">Let's you sign in to dApps securely</div>
      <div class="wallet-checklist-item">Gives you an identity in the blockchain</div>
    </div>

    <div class="wallet-info-text" id="wallet-info-text">
      <p>You can get one as a standalone mobile app or a desktop browser extension.</p>
      <p>You need a wallet to own Squares.</p>
    </div>

    <div class="wallet-actions">
      <a href="https://ethereum.org/wallets/find-wallet/" target="_blank" rel="noopener noreferrer" class="wallet-info-btn">Get a wallet</a>
    </div>
  `;

  modalShell.setBackHandler(() => {
    closeInfoModal();
    if (onBack) onBack();
  });
}

/**
 * Open the info modal.
 * @param {Function|null} onBack - Callback to execute when back arrow is clicked (e.g., to reopen connect modal)
 * @returns {Promise<void>}
 */
export async function openInfoModal(onBack = null) {
  closeHandler = null;
  const modalShell = ensureShell();
  modalShell.show();
  render(onBack);

  return new Promise((resolve) => {
    closeHandler = () => resolve();
  });
}

// Pre-mount the info modal shell so aria-controls references an existing element.
ensureShell();
