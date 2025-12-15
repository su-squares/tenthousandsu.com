/**
 * Contained Leaving Modal Factory
 *
 * Creates modal instances that are contained within a parent element
 * rather than fixed to the viewport. Use for embedded contexts where
 * the modal should only cover a specific container (like the billboard).
 *
 * Key differences from the global modal (modal-core.js):
 * - Creates new DOM per instance (not a singleton)
 * - Appends to container instead of document.body
 * - Uses --contained CSS variant (position: absolute)
 * - Provides destroy() method for cleanup
 * - Focus trap scoped to container
 */

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
  <div class="su-leaving-backdrop su-leaving-backdrop--contained" aria-hidden="true">\
    <div class="su-leaving" role="dialog" aria-modal="true" aria-labelledby="su-leaving-contained-title">\
      <div class="su-leaving__title" id="su-leaving-contained-title">You are leaving this site</div>\
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
 * Check if URL is http/https
 */
function isHttpUrl(url) {
  return url && (url.protocol === "http:" || url.protocol === "https:");
}

/**
 * Create a contained leaving modal instance
 * @param {HTMLElement} container - The parent element to contain the modal
 * @param {Object} [options] - Configuration options
 * @param {string[]} [options.blocklist] - Additional blocked domains
 * @param {Object} [options.blockedModal] - Contained blocked modal instance to show for blocked URIs/domains
 * @param {string} [options.baseStylesheetHref] - Path to base modal.css (if not already loaded)
 * @param {string} [options.containedStylesheetHref] - Path to modal-contained.css (if not already loaded)
 * @returns {Object} Modal controller
 */
export function createContainedLeavingModal(container, options) {
  var opts = options || {};

  if (!container || !(container instanceof HTMLElement)) {
    console.error("[ContainedLeavingModal] Invalid container element");
    return null;
  }

  var baseurl = window.SITE_BASEURL || "";

  // Ensure container has proper positioning
  var containerStyle = window.getComputedStyle(container);
  if (containerStyle.position === "static") {
    container.style.position = "relative";
  }

  // Blocked modal reference (optional, for showing blocked URI/domain modals)
  var blockedModal = opts.blockedModal || null;

  // Instance state
  var blocklist = new Set();
  var blocklistLoaded = false;
  var blocklistUrl = opts.blocklistUrl || baseurl + "/assets/blocklist/blocklist-domains.json";
  var backdrop = null;
  var titleNode = null;
  var messageNode = null;
  var urlNode = null;
  var stayButton = null;
  var goButton = null;
  var lastFocusedElement = null;
  var pendingUrl = null;
  var pendingTarget = null;
  var currentVariant = "standard";
  var destroyed = false;

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

  // Add custom blocklist entries
  if (opts.blocklist && Array.isArray(opts.blocklist)) {
    opts.blocklist.forEach(function (d) {
      if (typeof d === "string" && d.trim()) {
        blocklist.add(d.trim().toLowerCase());
      }
    });
  }

  function loadBlocklist(url) {
    var fetchUrl = url || blocklistUrl;
    if (blocklistLoaded && fetchUrl === blocklistUrl) {
      return Promise.resolve();
    }

    blocklistLoaded = true;
    blocklistUrl = fetchUrl;

    return fetch(fetchUrl)
      .then(function (response) {
        if (!response.ok) throw new Error("Blocklist fetch failed");
        return response.json();
      })
      .then(function (entries) {
        addBlockedDomains(entries);
      })
      .catch(function () {
        // Ignore errors, we still have any user-provided blocklist entries.
      });
  }

  /**
   * Ensure stylesheets are loaded
   */
  function ensureStylesheets() {
    var baseurl = window.SITE_BASEURL || "";

    // Base modal styles
    var baseHref = opts.baseStylesheetHref || baseurl + "/assets/modals/leaving-modal/modal.css";
    if (!document.querySelector('link[href="' + baseHref + '"]')) {
      var baseLink = document.createElement("link");
      baseLink.rel = "stylesheet";
      baseLink.href = baseHref;
      document.head.appendChild(baseLink);
    }

    // Contained variant styles
    var containedHref = opts.containedStylesheetHref || baseurl + "/assets/modals/leaving-modal/modal-contained.css";
    if (!document.querySelector('link[href="' + containedHref + '"]')) {
      var containedLink = document.createElement("link");
      containedLink.rel = "stylesheet";
      containedLink.href = containedHref;
      document.head.appendChild(containedLink);
    }
  }

  /**
   * Create and append the modal DOM
   */
  function createModal() {
    if (backdrop) return;

    ensureStylesheets();

    var wrapper = document.createElement("div");
    wrapper.innerHTML = TEMPLATE_HTML.trim();
    backdrop = wrapper.firstElementChild;
    titleNode = backdrop.querySelector(".su-leaving__title");
    messageNode = backdrop.querySelector(".su-leaving__message");
    urlNode = backdrop.querySelector(".su-leaving__url");
    stayButton = backdrop.querySelector(".su-leaving__button--stay");
    goButton = backdrop.querySelector(".su-leaving__button--go");

    if (!urlNode || !stayButton || !goButton) {
      console.error("[ContainedLeavingModal] Missing modal parts");
      backdrop = null;
      return;
    }

    // Event handlers
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

    // Click backdrop to close
    backdrop.addEventListener("click", function (event) {
      if (event.target === backdrop) {
        hide();
      }
    });

    // Escape key to close
    backdrop.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && backdrop.classList.contains(VISIBLE_CLASS)) {
        event.stopPropagation();
        hide();
      }
    });

    // Append to container (not document.body)
    container.appendChild(backdrop);
  }

  /**
   * Check if a domain is blocked
   */
  function isDomainBlocked(domain) {
    if (!domain) return false;
    var normalized = domain.toLowerCase();

    if (blocklist.has(normalized)) return true;

    var domainParts = getDomainParts(normalized);
    for (var i = 0; i < domainParts.length; i++) {
      if (blocklist.has(domainParts[i])) return true;
    }

    var blockedArray = Array.from(blocklist);
    for (var j = 0; j < blockedArray.length; j++) {
      var blockedParts = getDomainParts(blockedArray[j]);
      if (blockedParts.indexOf(normalized) !== -1) return true;
    }

    return false;
  }

  /**
   * Check if a URL is blocked
   */
  function isUrlBlocked(url) {
    if (!url || !isHttpUrl(url)) return false;
    return isDomainBlocked(url.hostname);
  }

  /**
   * Check if we should show warning for this URL (any external HTTP/HTTPS URL)
   */
  function shouldWarnForUrl(url) {
    if (!url || !isHttpUrl(url)) return false;

    var currentHost = window.location.hostname.toLowerCase();
    var hostname = url.hostname.toLowerCase();

    if (hostname === currentHost) return false;

    return true;
  }

  /**
   * Hide the modal
   */
  function hide() {
    if (destroyed || !backdrop) return;

    backdrop.classList.remove(VISIBLE_CLASS);
    backdrop.setAttribute("aria-hidden", "true");
    pendingUrl = null;
    pendingTarget = null;
    currentVariant = "standard";

    // Restore focus within container
    if (lastFocusedElement && container.contains(lastFocusedElement)) {
      lastFocusedElement.focus({ preventScroll: true });
    }
  }

  /**
   * Show the modal for a target URL
   * @param {URL|string} targetUrl - The target URL/URI to display
   * @param {string} [target='_self'] - Link target attribute
   * @param {Object} [showOptions] - Display options
   * @param {string} [showOptions.variant='standard'] - Modal variant: 'standard' or 'deeplink'
   */
  function show(targetUrl, target, showOptions) {
    if (destroyed) return;

    var showOpts = showOptions || {};
    var variant = showOpts.variant || "standard";
    var config = VARIANTS[variant] || VARIANTS.standard;
    currentVariant = variant;

    createModal();

    if (!backdrop || !urlNode || !stayButton) {
      // Fallback: navigate directly
      var fallbackUrl = typeof targetUrl === "string" ? targetUrl : targetUrl.href;
      if (variant === "deeplink") {
        window.location.href = fallbackUrl;
      } else if (target === "_self") {
        window.location.assign(fallbackUrl);
      } else {
        window.open(fallbackUrl, target || "_self", "noopener");
      }
      return;
    }

    // Save focus for restoration
    var active = document.activeElement;
    lastFocusedElement = active && container.contains(active) ? active : null;

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

    backdrop.setAttribute("aria-hidden", "false");
    backdrop.classList.add(VISIBLE_CLASS);

    // Focus the stay button
    setTimeout(function () {
      if (stayButton) stayButton.focus({ preventScroll: true });
    }, 0);
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
        // Show blocked modal if available
        if (blockedModal && typeof blockedModal.show === "function") {
          blockedModal.show(destination, { variant: "domain" });
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
        // Block dangerous URIs - show blocked modal if available
        if (event) event.preventDefault();
        if (blockedModal && typeof blockedModal.show === "function") {
          blockedModal.show(classification.displayUri, { variant: "uri" });
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
          if (blockedModal && typeof blockedModal.show === "function") {
            blockedModal.show(classification.url, { variant: "domain" });
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

  /**
   * Gate an anchor element - intercept clicks and show modal if needed
   */
  function gateAnchor(anchor) {
    if (destroyed || !anchor) return;

    createModal();

    if (anchor.dataset.suLeavingContainedGuarded === "1") return;
    anchor.dataset.suLeavingContainedGuarded = "1";

    anchor.addEventListener("click", function (event) {
      var href = anchor.getAttribute("href");
      if (!href) return;

      var target = anchor.getAttribute("target") || "_self";
      gateLinkNavigation(href, event, target);
    });
  }

  /**
   * Add domains to the blocklist at runtime
   */
  function addBlockedDomains(domains) {
    if (!Array.isArray(domains)) return;
    domains.forEach(function (d) {
      if (typeof d === "string" && d.trim()) {
        blocklist.add(d.trim().toLowerCase());
      }
    });
  }

  /**
   * Clean up the modal instance
   */
  function destroy() {
    if (destroyed) return;
    destroyed = true;

    if (backdrop && backdrop.parentNode) {
      backdrop.parentNode.removeChild(backdrop);
    }

    backdrop = null;
    titleNode = null;
    messageNode = null;
    urlNode = null;
    stayButton = null;
    goButton = null;
    lastFocusedElement = null;
    pendingUrl = null;
    pendingTarget = null;
  }

  // Initialize modal DOM on creation
  createModal();
  loadBlocklist();

  // Return the controller API
  return {
    show: show,
    hide: hide,
    gateAnchor: gateAnchor,
    gateLinkNavigation: gateLinkNavigation,
    shouldWarnForUrl: shouldWarnForUrl,
    isUrlBlocked: isUrlBlocked,
    addBlockedDomains: addBlockedDomains,
    destroy: destroy,

    // Expose state for debugging
    get isVisible() {
      return backdrop && backdrop.classList.contains(VISIBLE_CLASS);
    },
    get isDestroyed() {
      return destroyed;
    },
  };
}
