(function () {
  const baseurl = window.SITE_BASEURL || '';
  const DEFAULT_STYLESHEET_HREF = baseurl + "/assets/modals/blocked-modal/blocked-modal.css";

  // SVG X icon
  const X_ICON_SVG = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
      <line x1="18" y1="6" x2="6" y2="18"></line>
      <line x1="6" y1="6" x2="18" y2="18"></line>
    </svg>
  `;

  // Modal variant configurations
  const VARIANTS = {
    domain: {
      title: "This link has been blocked for your protection",
      message: "",
      buttonText: "Okay",
    },
    uri: {
      title: "This deeplink is disallowed",
      message: "Certain URIs are known for malicious activity so we disable them by default.",
      buttonText: "Okay",
    },
    square: {
      title: "This square is disabled for your protection",
      message: "",
      buttonText: "Okay",
    },
  };

  const TEMPLATE_HTML = `
    <div class="su-blocked-backdrop" aria-hidden="true">
      <div class="su-blocked" role="alertdialog" aria-modal="true" aria-labelledby="su-blocked-title">
        <div class="su-blocked__icon">${X_ICON_SVG}</div>
        <div class="su-blocked__title" id="su-blocked-title">This link has been blocked for your protection</div>
        <p class="su-blocked__message"></p>
        <div class="su-blocked__url"></div>
        <div class="su-blocked__actions">
          <button type="button" class="su-blocked__button">Okay</button>
        </div>
      </div>
    </div>
  `;

  const VISIBLE_CLASS = "is-visible";

  let stylesheetHref = DEFAULT_STYLESHEET_HREF;
  let backdrop;
  let titleNode;
  let messageNode;
  let urlNode;
  let okayButton;
  let lastFocusedElement;
  let readyPromise;

  function configure(options) {
    if (!options) {
      return;
    }

    if (options.stylesheetHref && options.stylesheetHref !== stylesheetHref) {
      stylesheetHref = options.stylesheetHref;
    }
  }

  function ensureStylesheet() {
    const existing = document.querySelector(`link[href="${stylesheetHref}"]`);
    if (existing) {
      return;
    }

    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = stylesheetHref;
    document.head.appendChild(link);
  }

  function appendModal() {
    if (backdrop) {
      return;
    }

    const wrapper = document.createElement("div");
    wrapper.innerHTML = TEMPLATE_HTML.trim();
    backdrop = wrapper.firstElementChild;
    titleNode = backdrop.querySelector(".su-blocked__title");
    messageNode = backdrop.querySelector(".su-blocked__message");
    urlNode = backdrop.querySelector(".su-blocked__url");
    okayButton = backdrop.querySelector(".su-blocked__button");

    if (!urlNode || !okayButton) {
      console.warn("BlockedModal: missing modal parts, skipping.");
      backdrop = null;
      return;
    }

    okayButton.addEventListener("click", hide);

    backdrop.addEventListener("click", function (event) {
      if (event.target === backdrop) {
        hide();
      }
    });

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && backdrop && backdrop.classList.contains(VISIBLE_CLASS)) {
        hide();
      }
    });

    document.body.appendChild(backdrop);
  }

  function init(options) {
    configure(options);

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

  function hide() {
    if (!backdrop) {
      return;
    }

    backdrop.classList.remove(VISIBLE_CLASS);
    backdrop.setAttribute("aria-hidden", "true");

    const focusTarget = lastFocusedElement && document.contains(lastFocusedElement) ? lastFocusedElement : document.body;
    if (focusTarget && typeof focusTarget.focus === "function") {
      focusTarget.focus({ preventScroll: true });
    }
  }

  /**
   * Show the blocked modal
   * @param {URL|string} targetUrl - The blocked URL/URI to display
   * @param {Object} [options] - Display options
   * @param {string} [options.variant='domain'] - Modal variant: 'domain' or 'uri'
   */
  function show(targetUrl, options) {
    var opts = options || {};
    var variant = opts.variant || "domain";
    var config = VARIANTS[variant] || VARIANTS.domain;

    init().then(function (node) {
      if (!node || !urlNode || !okayButton) {
        return;
      }

      var active = document.activeElement;
      lastFocusedElement = active && active !== document.body ? active : null;

      // Apply variant content
      if (titleNode) {
        titleNode.textContent = config.title;
      }

      if (messageNode) {
        if (config.message) {
          messageNode.textContent = config.message;
          messageNode.style.display = "";
        } else {
          messageNode.textContent = "";
          messageNode.style.display = "none";
        }
      }

      if (okayButton) {
        okayButton.textContent = config.buttonText;
      }

      var urlString = typeof targetUrl === "string" ? targetUrl : targetUrl.href;
      urlNode.textContent = urlString;

      node.setAttribute("aria-hidden", "false");
      node.classList.add(VISIBLE_CLASS);

      setTimeout(function () {
        okayButton.focus({ preventScroll: true });
      }, 0);
    });
  }

  /**
   * Check if modal is currently visible
   * @returns {boolean}
   */
  function isVisible() {
    return backdrop && backdrop.classList.contains(VISIBLE_CLASS);
  }

  if (!window.SuBlockedModal) {
    window.SuBlockedModal = {
      init,
      show,
      hide,
      isVisible,
      configure,
    };
  }

  // Auto-init when script loads
  init();
})();
