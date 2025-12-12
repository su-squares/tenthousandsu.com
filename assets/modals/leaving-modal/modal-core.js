(function () {
  const baseurl = window.SITE_BASEURL || '';
  const DEFAULT_STYLESHEET_HREF = baseurl + "/assets/modals/leaving-modal/modal.css";
  const DEFAULT_ALLOWLIST_URL = baseurl + "/assets/modals/leaving-modal/allowlist.json";
  const DEFAULT_BLOCKLIST_URL = baseurl + "/assets/blocklist/blocklist-domains.json";
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
  const BUILT_IN_ALLOWED = ["localhost", "127.0.0.1", "tenthousandsu.com", "www.tenthousandsu.com"];
  const allowlist = new Set(BUILT_IN_ALLOWED);
  const blocklist = new Set();

  let allowlistLoaded = false;
  let blocklistLoaded = false;
  let allowlistUrl = DEFAULT_ALLOWLIST_URL;
  let blocklistUrl = DEFAULT_BLOCKLIST_URL;
  let stylesheetHref = DEFAULT_STYLESHEET_HREF;

  let backdrop;
  let urlNode;
  let stayButton;
  let goButton;
  let lastFocusedElement;
  let readyPromise;
  let pendingUrl;
  let pendingTarget;

  function configure(options) {
    if (!options) {
      return;
    }

    if (options.allowlistUrl && options.allowlistUrl !== allowlistUrl) {
      allowlistLoaded = false;
      allowlistUrl = options.allowlistUrl;
    }

    if (options.blocklistUrl && options.blocklistUrl !== blocklistUrl) {
      blocklistLoaded = false;
      blocklistUrl = options.blocklistUrl;
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

  function init(options) {
    configure(options);

    if (readyPromise) {
      return readyPromise;
    }

    readyPromise = new Promise(function (resolve) {
      const setup = function () {
        ensureStylesheet();
        appendModal();
        loadAllowlist();
        loadBlocklist();
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

  function loadAllowlist(url) {
    const fetchUrl = url || allowlistUrl;
    if (allowlistLoaded && fetchUrl === allowlistUrl) {
      return Promise.resolve(allowlist);
    }

    allowlistLoaded = true;
    allowlistUrl = fetchUrl;

    return fetch(fetchUrl)
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

  function loadBlocklist(url) {
    const fetchUrl = url || blocklistUrl;
    if (blocklistLoaded && fetchUrl === blocklistUrl) {
      return Promise.resolve(blocklist);
    }

    blocklistLoaded = true;
    blocklistUrl = fetchUrl;

    return fetch(fetchUrl)
      .then(function (response) {
        if (!response.ok) {
          throw new Error("Blocklist fetch failed");
        }
        return response.json();
      })
      .then(function (items) {
        if (!Array.isArray(items)) {
          return;
        }
        items.forEach(function (item) {
          if (typeof item === "string" && item.trim()) {
            blocklist.add(item.trim().toLowerCase());
          }
        });
      })
      .catch(function () {
        // Keep empty list on failure.
      });
  }

  /**
   * Get all domain parts for matching (domain + all parent domains)
   * e.g., "a.b.c.com" → ["a.b.c.com", "b.c.com", "c.com", "com"]
   */
  function getDomainParts(domain) {
    if (!domain) return [];
    const parts = domain.split(".");
    const result = [];
    for (var i = 0; i < parts.length; i++) {
      result.push(parts.slice(i).join("."));
    }
    return result;
  }

  /**
   * Check if a domain is in the blocklist (includes subdomain/parent matching)
   */
  function isDomainBlocked(domain) {
    if (!domain) return false;
    var normalized = domain.toLowerCase();

    // Check direct match
    if (blocklist.has(normalized)) {
      return true;
    }

    // Check if domain is subdomain of any blocked domain
    var domainParts = getDomainParts(normalized);
    for (var i = 0; i < domainParts.length; i++) {
      if (blocklist.has(domainParts[i])) {
        return true;
      }
    }

    // Check if any blocked domain is subdomain of this domain
    var blockedArray = Array.from(blocklist);
    for (var j = 0; j < blockedArray.length; j++) {
      var blockedParts = getDomainParts(blockedArray[j]);
      if (blockedParts.indexOf(normalized) !== -1) {
        return true;
      }
    }

    return false;
  }

  /**
   * Check if a URL is blocked
   */
  function isUrlBlocked(url) {
    if (!url || !isHttpUrl(url)) {
      return false;
    }
    return isDomainBlocked(url.hostname);
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

    init();

    if (anchor.dataset.suLeavingGuarded === "1") {
      return;
    }
    anchor.dataset.suLeavingGuarded = "1";

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

      // Check blocklist first - blocked URLs get the blocked modal
      if (isUrlBlocked(destination)) {
        event.preventDefault();
        // Show blocked modal if available, otherwise just block
        if (window.SuBlockedModal && typeof window.SuBlockedModal.show === "function") {
          window.SuBlockedModal.show(destination);
        }
        return;
      }

      if (!shouldWarnForUrl(destination)) {
        return;
      }

      event.preventDefault();
      show(destination, anchor.getAttribute("target") || "_self");
    });
  }

  function gateAnchors(selector) {
    if (!selector) {
      return;
    }

    let anchors;
    if (typeof selector === "string") {
      anchors = document.querySelectorAll(selector);
    } else if (selector instanceof NodeList || Array.isArray(selector)) {
      anchors = selector;
    } else {
      anchors = [selector];
    }

    anchors.forEach(function (anchor) {
      gateAnchor(anchor);
    });
  }

  if (!window.SuLeavingModal) {
    window.SuLeavingModal = {
      init,
      show,
      hide,
      shouldWarnForUrl,
      isUrlBlocked,
      gateAnchor,
      gateAnchors,
      loadAllowlist,
      loadBlocklist,
      configure,
    };
  }

  init();
})();
