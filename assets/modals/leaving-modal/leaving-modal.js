(function () {
  const STYLESHEET_HREF = "/assets/modals/leaving-modal/modal.css";
  const TEMPLATE_HTML = `
    <div class="su-leaving-backdrop" aria-hidden="true">
      <div class="su-leaving" role="dialog" aria-modal="true" aria-label="Leaving this site">
        <div class="su-leaving__title">You are leaving this site</div>
        <p class="su-leaving__message">
          We do NOT vet these links and assume no responsibility if you choose to visit it. Proceed at your own discretion.
        </p>
        <a class="su-leaving__url" href="#" target="_blank" rel="noopener"></a>
        <div class="su-leaving__actions">
          <button type="button" class="su-leaving__button su-leaving__button--stay">Stay Here</button>
          <button type="button" class="su-leaving__button su-leaving__button--go">Go There</button>
        </div>
      </div>
    </div>
  `;
  const VISIBLE_CLASS = "is-visible";
  /* allowlist.json is a separate complementary configuration for expanding beyond the built-in list*/
  const BUILT_IN_ALLOWED = ["localhost", "127.0.0.1", "tenthousandsu.com", "www.tenthousandsu.com"];
  const allowlist = new Set(BUILT_IN_ALLOWED);
  let allowlistLoaded = false;

  let backdrop;
  let urlNode;
  let stayButton;
  let goButton;
  let lastFocusedElement;
  let readyPromise;
  let pendingUrl;
  let pendingTarget;

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
    urlNode = backdrop.querySelector(".su-leaving__url");
    stayButton = backdrop.querySelector(".su-leaving__button--stay");
    goButton = backdrop.querySelector(".su-leaving__button--go");

    if (!urlNode || !stayButton || !goButton) {
      console.warn("LeavingModal: missing modal parts, skipping custom modal.");
      backdrop = null;
      return;
    }

    stayButton.addEventListener("click", hide);
    goButton.addEventListener("click", function () {
      if (!pendingUrl) {
        hide();
        return;
      }

      const target = pendingTarget || "_self";
      if (target === "_self") {
        window.location.assign(pendingUrl.href);
      } else {
        window.open(pendingUrl.href, target, "noopener");
      }

      hide();
    });

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

  function init() {
    if (readyPromise) {
      return readyPromise;
    }

    readyPromise = new Promise(function (resolve) {
      const setup = function () {
        ensureStylesheet();
        appendModal();
        loadAllowlist();
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

  function loadAllowlist() {
    if (allowlistLoaded) {
      return Promise.resolve(allowlist);
    }

    allowlistLoaded = true;

    return fetch("/assets/modals/leaving-modal/allowlist.json")
      .then(function (response) {
        if (!response.ok) {
          throw new Error("Allowlist fetch failed");
        }
        return response.json();
      })
      .then(function (items) {
        if (!Array.isArray(items)) {
          return;
        }
        items.forEach(function (item) {
          if (typeof item === "string" && item.trim()) {
            allowlist.add(item.trim().toLowerCase());
          }
        });
      })
      .catch(function () {
        // Keep built-in list on failure.
      });
  }

  function hide() {
    if (!backdrop) {
      return;
    }

    backdrop.classList.remove(VISIBLE_CLASS);
    backdrop.setAttribute("aria-hidden", "true");
    pendingUrl = null;
    pendingTarget = null;

    const focusTarget = lastFocusedElement && document.contains(lastFocusedElement) ? lastFocusedElement : document.body;
    if (focusTarget && typeof focusTarget.focus === "function") {
      focusTarget.focus({ preventScroll: true });
    }
  }

  function show(targetUrl, target) {
    init().then(function (node) {
      if (!node || !urlNode || !stayButton || !goButton) {
        if (target === "_self") {
          window.location.assign(targetUrl.href);
        } else {
          window.open(targetUrl.href, target || "_self");
        }
        return;
      }

      const active = document.activeElement;
      lastFocusedElement = active && active !== document.body ? active : null;
      pendingUrl = targetUrl;
      pendingTarget = target || "_self";

      urlNode.textContent = targetUrl.href;
      urlNode.href = targetUrl.href;
      node.setAttribute("aria-hidden", "false");
      node.classList.add(VISIBLE_CLASS);

      setTimeout(function () {
        stayButton.focus({ preventScroll: true });
      }, 0);
    });
  }

  function isHttpUrl(url) {
    return url && (url.protocol === "http:" || url.protocol === "https:");
  }

  function shouldWarnForUrl(url) {
    if (!url || !isHttpUrl(url)) {
      return false;
    }

    const currentHost = window.location.hostname;
    const hostname = url.hostname.toLowerCase();

    if (hostname === currentHost.toLowerCase()) {
      return false;
    }

    if (allowlist.has(hostname)) {
      return false;
    }

    return true;
  }

  function gateAnchor(anchor) {
    if (!anchor) {
      return;
    }

    anchor.addEventListener("click", function (event) {
      const href = anchor.getAttribute("href");
      if (!href) {
        return;
      }

      let destination;
      try {
        destination = new URL(href, window.location.href);
      } catch (error) {
        return;
      }

      if (!shouldWarnForUrl(destination)) {
        return;
      }

      event.preventDefault();
      show(destination, anchor.getAttribute("target") || "_self");
    });
  }

  if (!window.SuLeavingModal) {
    window.SuLeavingModal = {
      init,
      show,
      hide,
      shouldWarnForUrl,
      gateAnchor,
      loadAllowlist,
    };
  }

  init();
})();
