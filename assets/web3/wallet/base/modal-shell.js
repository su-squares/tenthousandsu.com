import { ensureBackButton } from "../back-button.js";

/**
 * Create a reusable wallet modal shell (overlay + container).
 * @param {Object} [options]
 * @param {string} [options.id]
 * @param {() => void} [options.onRequestClose]
 * @param {() => void} [options.onOverlayDismiss]
 * @param {boolean} [options.mountImmediately]
 */
export function createModalShell(options = {}) {
  const overlay = document.createElement("div");
  overlay.className = "wallet-overlay";
  overlay.setAttribute("aria-hidden", "true");
  if (options.id) overlay.id = options.id;

  const modal = document.createElement("div");
  modal.className = "wallet-modal";
  modal.setAttribute("role", "dialog");
  modal.setAttribute("aria-modal", "true");
  modal.setAttribute("tabindex", "-1");
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
  let lastFocusedElement = null;
  const hide = () => {
    overlay.classList.remove("is-visible");
    overlay.setAttribute("aria-hidden", "true");
    overlay.hidden = true;
    if (lastFocusedElement && typeof lastFocusedElement.focus === "function") {
      try {
        lastFocusedElement.focus();
      } catch (_error) {
        /* ignore focus errors */
      }
    }
  };
  let onRequestClose = options.onRequestClose || hide;

  const ensureMounted = () => {
    if (mounted) return;
    document.body.appendChild(overlay);
    overlay.hidden = true;
    mounted = true;
  };

  if (options.mountImmediately) {
    ensureMounted();
  }

  const setBackHandler = (handler) => {
    backBtn = ensureBackButton(modal, handler);
  };

  const setAria = ({ labelledBy, describedBy } = {}) => {
    if (labelledBy) {
      modal.setAttribute("aria-labelledby", labelledBy);
    } else {
      modal.removeAttribute("aria-labelledby");
    }
    if (describedBy) {
      modal.setAttribute("aria-describedby", describedBy);
    } else {
      modal.removeAttribute("aria-describedby");
    }
  };

  const getFocusableElements = () => {
    return Array.from(
      modal.querySelectorAll(
        [
          "button",
          "[href]",
          "input",
          "select",
          "textarea",
          '[tabindex]:not([tabindex="-1"])',
        ].join(",")
      )
    ).filter((el) => {
      const hidden = el.getAttribute("aria-hidden") === "true" || el.hasAttribute("disabled");
      const isVisible = el.offsetParent !== null || el.getClientRects().length > 0;
      return !hidden && isVisible;
    });
  };

  const trapFocus = (event) => {
    if (event.key === "Escape") {
      event.stopPropagation();
      onRequestClose?.();
      return;
    }
    if (event.key !== "Tab") return;
    const focusable = getFocusableElements();
    if (focusable.length === 0) {
      event.preventDefault();
      modal.focus();
      return;
    }
    const currentIndex = focusable.indexOf(document.activeElement);
    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (event.shiftKey) {
      if (document.activeElement === first || currentIndex === -1) {
        event.preventDefault();
        last.focus();
      }
    } else {
      if (document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  };

  const show = () => {
    ensureMounted();
    lastFocusedElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    overlay.hidden = false;
    overlay.setAttribute("aria-hidden", "false");
    overlay.classList.add("is-visible");
    modal.focus({ preventScroll: true });
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
  overlay.addEventListener("keydown", trapFocus);

  return {
    overlay,
    modal,
    content,
    show,
    hide,
    setBackHandler,
    setAria,
    /**
     * Replace the close handler.
     * @param {() => void} handler
     */
    setOnRequestClose(handler) {
      onRequestClose = handler;
    },
  };
}
