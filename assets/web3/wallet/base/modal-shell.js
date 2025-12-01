import { ensureBackButton } from "../back-button.js";

/**
 * Create a reusable wallet modal shell (overlay + container).
 * @param {Object} [options]
 * @param {string} [options.id]
 * @param {() => void} [options.onRequestClose]
 * @param {() => void} [options.onOverlayDismiss]
 */
export function createModalShell(options = {}) {
  const overlay = document.createElement("div");
  overlay.className = "wallet-overlay";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  if (options.id) overlay.id = options.id;

  const modal = document.createElement("div");
  modal.className = "wallet-modal";
  const content = document.createElement("div");

  const closeBtn = document.createElement("button");
  closeBtn.className = "wallet-close";
  closeBtn.type = "button";
  closeBtn.setAttribute("aria-label", "Close");
  closeBtn.textContent = "✕";

  modal.appendChild(closeBtn);
  modal.appendChild(content);
  overlay.appendChild(modal);

  let mounted = false;
  let backBtn = null;
  const hide = () => {
    overlay.classList.remove("is-visible");
  };
  let onRequestClose = options.onRequestClose || hide;

  const ensureMounted = () => {
    if (mounted) return;
    document.body.appendChild(overlay);
    mounted = true;
  };

  const setBackHandler = (handler) => {
    backBtn = ensureBackButton(modal, handler);
  };

  const show = () => {
    ensureMounted();
    overlay.classList.add("is-visible");
  };

  closeBtn.addEventListener("click", () => onRequestClose?.());
  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) {
      if (options.onOverlayDismiss) {
        options.onOverlayDismiss();
      } else {
        onRequestClose?.();
      }
    }
  });

  return {
    overlay,
    modal,
    content,
    show,
    hide,
    setBackHandler,
    /**
     * Replace the close handler.
     * @param {() => void} handler
     */
    setOnRequestClose(handler) {
      onRequestClose = handler;
    },
  };
}
