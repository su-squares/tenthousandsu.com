(function () {
  var baseurl = window.SITE_BASEURL || '';
  var DEFAULT_STYLESHEET_HREF = baseurl + "/assets/modals/leaving-modal/modal.css";
  var DEFAULT_BLOCKLIST_URL = baseurl + "/assets/blocklist/blocklist-domains.json";

  // Modal variant configurations
  var VARIANTS = {
    standard: {
      title: "You are leaving this site",
      message: "We do NOT vet these links and assume no responsibility if you choose to visit it. Proceed at your own discretion.",
      cancelText: "Stay Here",
      confirmText: "Go There",
    },
    deeplink: {
      title: "You are using a deeplink",
      message: "We don't vet URIs and assume no responsibility if you choose to open it on your device. Proceed at your own discretion.",
      cancelText: "Cancel",
      confirmText: "Open",
    },
  };

  var TEMPLATE_HTML = '\
    <div class="su-leaving-backdrop" aria-hidden="true">\
      <div class="su-leaving" role="dialog" aria-modal="true" aria-labelledby="su-leaving-title">\
        <div class="su-leaving__title" id="su-leaving-title">You are leaving this site</div>\
        <p class="su-leaving__message">\
          We do NOT vet these links and assume no responsibility if you choose to visit it. Proceed at your own discretion.\
        </p>\
        <a class="su-leaving__url" href="#" target="_blank" rel="noopener"></a>\
        <div class="su-leaving__actions">\
          <button type="button" class="su-leaving__button su-leaving__button--stay">Stay Here</button>\
          <button type="button" class="su-leaving__button su-leaving__button--go">Go There</button>\
        </div>\
      </div>\
    </div>\
  ';

  var VISIBLE_CLASS = "is-visible";
  var blocklist = new Set();

  var blocklistLoaded = false;
  var blocklistUrl = DEFAULT_BLOCKLIST_URL;
  var stylesheetHref = DEFAULT_STYLESHEET_HREF;

  var backdrop;
  var titleNode;
  var messageNode;
  var urlNode;
  var stayButton;
  var goButton;
  var lastFocusedElement;
  var readyPromise;
  var pendingUrl;
  var pendingTarget;
  var currentVariant = "standard";

  function triggerDeeplink(urlString) {
    try {
      var link = document.createElement("a");
      link.href = urlString;
      link.rel = "noopener";
      link.style.display = "none";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (e) {
      window.location.href = urlString;
    }
  }

  function configure(options) {
    if (!options) {
      return;
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
    var existing = document.querySelector('link[href="' + stylesheetHref + '"]');
    if (existing) {
      return;
    }

    var link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = stylesheetHref;
    document.head.appendChild(link);
  }

  function appendModal() {
    if (backdrop) {
      return;
    }

    var wrapper = document.createElement("div");
    wrapper.innerHTML = TEMPLATE_HTML.trim();
    backdrop = wrapper.firstElementChild;
    titleNode = backdrop.querySelector(".su-leaving__title");
    messageNode = backdrop.querySelector(".su-leaving__message");
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

      var target = pendingTarget || "_self";

      // For deeplinks (non-HTTP URIs), trigger via real link navigation
      if (currentVariant === "deeplink") {
        var urlString = typeof pendingUrl === "string" ? pendingUrl : pendingUrl.href;
        triggerDeeplink(urlString);
      } else {
        // Standard HTTP navigation
        if (target === "_self") {
          window.location.assign(pendingUrl.href);
        } else {
          window.open(pendingUrl.href, target, "noopener");
        }
      }

      hide();
    });

    urlNode.addEventListener("click", function (event) {
      if (currentVariant !== "deeplink") {
        return;
      }
      if (!pendingUrl) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      var urlString = typeof pendingUrl === "string" ? pendingUrl : pendingUrl.href;
      triggerDeeplink(urlString);
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
      var setup = function () {
        ensureStylesheet();
        appendModal();
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

  function loadBlocklist(url) {
    var fetchUrl = url || blocklistUrl;
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
    var parts = domain.split(".");
    var result = [];
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
    currentVariant = "standard";

    var focusTarget = lastFocusedElement && document.contains(lastFocusedElement) ? lastFocusedElement : document.body;
    if (focusTarget && typeof focusTarget.focus === "function") {
      focusTarget.focus({ preventScroll: true });
    }
  }

  /**
   * Show the leaving modal
   * @param {URL|string} targetUrl - The target URL/URI to display
   * @param {string} [target='_self'] - Link target attribute
   * @param {Object} [options] - Display options
   * @param {string} [options.variant='standard'] - Modal variant: 'standard' or 'deeplink'
   */
  function show(targetUrl, target, options) {
    var opts = options || {};
    var variant = opts.variant || "standard";
    var config = VARIANTS[variant] || VARIANTS.standard;
    currentVariant = variant;

    init().then(function (node) {
      if (!node || !urlNode || !stayButton || !goButton) {
        // Fallback navigation
        var urlString = typeof targetUrl === "string" ? targetUrl : targetUrl.href;
        if (variant === "deeplink") {
          window.location.href = urlString;
        } else if (target === "_self") {
          window.location.assign(urlString);
        } else {
          window.open(urlString, target || "_self");
        }
        return;
      }

      var active = document.activeElement;
      lastFocusedElement = active && active !== document.body ? active : null;
      pendingUrl = targetUrl;
      pendingTarget = target || "_self";

      // Apply variant content
      if (titleNode) {
        titleNode.textContent = config.title;
      }

      if (messageNode) {
        messageNode.textContent = config.message;
      }

      if (stayButton) {
        stayButton.textContent = config.cancelText;
      }

      if (goButton) {
        goButton.textContent = config.confirmText;
      }

      var displayUrl = typeof targetUrl === "string" ? targetUrl : targetUrl.href;
      urlNode.textContent = displayUrl;

      // For deeplinks, the URL display shouldn't be a clickable link
      if (variant === "deeplink") {
        urlNode.href = displayUrl;
        urlNode.style.cursor = "pointer";
        urlNode.style.pointerEvents = "";
      } else {
        urlNode.href = displayUrl;
        urlNode.style.cursor = "";
        urlNode.style.pointerEvents = "";
      }

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

  /**
   * Check if URL should show warning modal (any external HTTP/HTTPS URL)
   */
  function shouldWarnForUrl(url) {
    if (!url || !isHttpUrl(url)) {
      return false;
    }

    var currentHost = window.location.hostname;
    var hostname = url.hostname.toLowerCase();

    if (hostname === currentHost.toLowerCase()) {
      return false;
    }

    return true;
  }

  /**
   * Unified link gate function - classifies URI and shows appropriate modal
   * @param {string} href - The href to gate
   * @param {Event} [event] - The click event (to prevent default)
   * @param {string} [target='_self'] - Link target attribute
   * @returns {boolean} - True if navigation was handled/blocked, false if should proceed
   */
  function gateLinkNavigation(href, event, target) {
    if (!href) return false;

    var linkTarget = target || "_self";

    // Use SuLinkUtils if available (from link-utils.js)
    var SuLinkUtils = window.SuLinkUtils;
    if (!SuLinkUtils || !SuLinkUtils.classifyUri) {
      // Fallback to legacy behavior if link-utils not loaded
      var destination;
      try {
        destination = new URL(href, window.location.href);
      } catch (e) {
        return false;
      }

      if (isUrlBlocked(destination)) {
        if (event) event.preventDefault();
        if (window.SuBlockedModal && typeof window.SuBlockedModal.show === "function") {
          window.SuBlockedModal.show(destination, { variant: "domain" });
        }
        return true;
      }

      if (shouldWarnForUrl(destination)) {
        if (event) event.preventDefault();
        show(destination, linkTarget, { variant: "standard" });
        return true;
      }

      return false;
    }

    var classification = SuLinkUtils.classifyUri(href);

    switch (classification.classification) {
      case SuLinkUtils.URI_CLASSIFICATION.BLOCKED:
        // Show blocked modal (uri variant)
        if (event) event.preventDefault();
        if (window.SuBlockedModal && typeof window.SuBlockedModal.show === "function") {
          window.SuBlockedModal.show(classification.displayUri, { variant: "uri" });
        }
        return true;

      case SuLinkUtils.URI_CLASSIFICATION.DEEPLINK:
        // Show deeplink warning modal
        if (event) event.preventDefault();
        show(classification.displayUri, linkTarget, { variant: "deeplink" });
        return true;

      case SuLinkUtils.URI_CLASSIFICATION.EXTERNAL:
        // Check domain blocklist first
        if (classification.url && isUrlBlocked(classification.url)) {
          if (event) event.preventDefault();
          if (window.SuBlockedModal && typeof window.SuBlockedModal.show === "function") {
            window.SuBlockedModal.show(classification.url, { variant: "domain" });
          }
          return true;
        }
        // Show standard leaving modal
        if (event) event.preventDefault();
        show(classification.url || classification.displayUri, linkTarget, { variant: "standard" });
        return true;

      case SuLinkUtils.URI_CLASSIFICATION.INTERNAL:
        // Check for safe internal paths (like /mint)
        if (classification.url && SuLinkUtils.isSafeInternalPath(classification.url)) {
          return false; // Allow direct navigation
        }
        // For other internal links, allow navigation
        return false;

      default:
        return false;
    }
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
      var href = anchor.getAttribute("href");
      if (!href) {
        return;
      }

      var target = anchor.getAttribute("target") || "_self";
      gateLinkNavigation(href, event, target);
    });
  }

  function gateAnchors(selector) {
    if (!selector) {
      return;
    }

    var anchors;
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
      init: init,
      show: show,
      hide: hide,
      shouldWarnForUrl: shouldWarnForUrl,
      isUrlBlocked: isUrlBlocked,
      gateAnchor: gateAnchor,
      gateAnchors: gateAnchors,
      gateLinkNavigation: gateLinkNavigation,
      loadBlocklist: loadBlocklist,
      configure: configure,
    };
  }

  init();
})();
