(function () {
  const STYLESHEET_HREF = "/assets/modals/alert-modal/modal.css";
  const TEMPLATE_HTML = `
    <div class="su-alert-backdrop" aria-hidden="true">
      <div class="su-alert" role="dialog" aria-modal="true" aria-label="Alert" aria-describedby="su-alert-message">
        <div class="su-alert__message" id="su-alert-message"></div>
        <div class="su-alert__actions">
          <button type="button" class="btn su-alert__button">Okay</button>
        </div>
      </div>
    </div>
  `;
  const VISIBLE_CLASS = "is-visible";
  const nativeAlert = window.alert.bind(window);

  let backdrop;
  let messageNode;
  let dismissButton;
  let lastFocusedElement;
  let readyPromise;

  function ensureStylesheet() {
    const existing = document.querySelector(`link[href="${STYLESHEET_HREF}"]`);
    if (existing) {
      return;
    }

    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = STYLESHEET_HREF;
    document.head.appendChild(link);
  }

  function appendModal() {
    if (backdrop) {
      return;
    }

    const wrapper = document.createElement("div");
    wrapper.innerHTML = TEMPLATE_HTML.trim();
    backdrop = wrapper.firstElementChild;
    messageNode = backdrop.querySelector(".su-alert__message");
    dismissButton = backdrop.querySelector(".su-alert__button");

    if (!messageNode || !dismissButton) {
      console.warn("SuAlertModal: missing modal parts, falling back to native alert.");
      backdrop = null;
      return;
    }

    dismissButton.addEventListener("click", hide);
    backdrop.addEventListener("click", function (event) {
      if (event.target === backdrop) {
        hide();
      }
    });
    document.addEventListener("keydown", function (event) {
      if (!backdrop || !backdrop.classList.contains(VISIBLE_CLASS)) {
        return;
      }

      if (event.key === "Escape") {
        hide();
      } else if (event.key === "Tab") {
        // Focus trap: prevent Tab from escaping the modal.
        // Since there's only one focusable element, just prevent default.
        event.preventDefault();
        dismissButton.focus({ preventScroll: true });
      }
    });

    document.body.appendChild(backdrop);
  }

  function init() {
    if (readyPromise) {
      return readyPromise;
    }

    readyPromise = new Promise(function (resolve) {
      const setup = function () {
        ensureStylesheet();
        appendModal();
        resolve(backdrop);
      };

      if (document.body) {
        setup();
      } else {
        document.addEventListener("DOMContentLoaded", setup, { once: true });
      }
    });

    return readyPromise;
  }

  function show(message) {
    init().then(function (node) {
      if (!node || !messageNode || !dismissButton) {
        nativeAlert(message);
        return;
      }

      const active = document.activeElement;
      lastFocusedElement = active && active !== document.body ? active : null;

      messageNode.textContent = message === undefined ? "" : String(message);
      node.setAttribute("aria-hidden", "false");
      node.classList.add(VISIBLE_CLASS);

      // Focus after transition completes to ensure modal is fully visible.
      setTimeout(function () {
        dismissButton.focus({ preventScroll: true });
      }, 50);
    });
  }

  function hide() {
    if (!backdrop) {
      return;
    }

    backdrop.classList.remove(VISIBLE_CLASS);
    if (dismissButton) {
      dismissButton.blur();
    }

    const focusTarget = lastFocusedElement && document.contains(lastFocusedElement) ? lastFocusedElement : document.body;
    if (focusTarget && typeof focusTarget.focus === "function") {
      focusTarget.focus({ preventScroll: true });
    }

    backdrop.setAttribute("aria-hidden", "true");
  }

  if (!window.SuAlertModal) {
    window.SuAlertModal = {
      init,
      show,
      hide,
    };
  }

  init();
})();
