/**
 * Contained Blocked Modal Factory
 *
 * Creates blocked modal instances that are contained within a parent element
 * rather than fixed to the viewport. Use for embedded contexts where
 * the modal should only cover a specific container (like the billboard).
 *
 * Key differences from the global modal (blocked-modal.js):
 * - Creates new DOM per instance (not a singleton)
 * - Appends to container instead of document.body
 * - Uses --contained CSS variant (position: absolute)
 * - Provides destroy() method for cleanup
 * - Focus trap scoped to container
 */

// SVG X icon
var X_ICON_SVG = '\
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">\
    <line x1="18" y1="6" x2="6" y2="18"></line>\
    <line x1="6" y1="6" x2="18" y2="18"></line>\
  </svg>\
';

// Modal variant configurations
var VARIANTS = {
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

var TEMPLATE_HTML = '\
  <div class="su-blocked-backdrop su-blocked-backdrop--contained" aria-hidden="true" hidden>\
    <div class="su-blocked" role="alertdialog" aria-modal="true" aria-labelledby="su-blocked-contained-title">\
      <div class="su-blocked__icon">' + X_ICON_SVG + '</div>\
      <div class="su-blocked__title" id="su-blocked-contained-title">This link has been blocked for your protection</div>\
      <p class="su-blocked__message"></p>\
      <div class="su-blocked__url"></div>\
      <div class="su-blocked__actions">\
        <button type="button" class="su-blocked__button">Okay</button>\
      </div>\
    </div>\
  </div>\
';

var VISIBLE_CLASS = "is-visible";

/**
 * @typedef {"domain" | "uri" | "square"} BlockedModalVariant
 */

/**
 * @typedef {Object} BlockedModalOptions
 * @property {BlockedModalVariant} [variant]
 */

/**
 * @typedef {Object} BlockedModalController
 * @property {(url: string | URL, options?: BlockedModalOptions) => void} show
 * @property {() => void} hide
 * @property {() => void} destroy
 * @property {boolean | null} isVisible
 * @property {boolean} isDestroyed
 */

/**
 * Create a contained blocked modal instance
 * @param {HTMLElement | null} container - The parent element to contain the modal
 * @param {Object} [options] - Configuration options
 * @param {string} [options.baseStylesheetHref] - Path to base blocked-modal.css (if not already loaded)
 * @param {string} [options.containedStylesheetHref] - Path to blocked-modal-contained.css (if not already loaded)
 * @returns {BlockedModalController | null} Modal controller
 */
export function createContainedBlockedModal(container, options) {
  var opts = options || {};

  if (!container || !(container instanceof HTMLElement)) {
    console.error("[ContainedBlockedModal] Invalid container element");
    return null;
  }

  // Ensure container has proper positioning
  var containerStyle = window.getComputedStyle(container);
  if (containerStyle.position === "static") {
    container.style.position = "relative";
  }

  // Instance state
  var backdrop = null;
  var titleNode = null;
  var messageNode = null;
  var urlNode = null;
  var okayButton = null;
  var lastFocusedElement = null;
  var destroyed = false;

  /**
   * Ensure stylesheets are loaded
   */
  function ensureStylesheets() {
    var baseurl = window.SITE_BASEURL || "";

    // Base blocked modal styles
    var baseHref = opts.baseStylesheetHref || baseurl + "/assets/modals/blocked-modal/blocked-modal.css";
    if (!document.querySelector('link[href="' + baseHref + '"]')) {
      var baseLink = document.createElement("link");
      baseLink.rel = "stylesheet";
      baseLink.href = baseHref;
      document.head.appendChild(baseLink);
    }

    // Contained variant styles
    var containedHref = opts.containedStylesheetHref || baseurl + "/assets/modals/blocked-modal/blocked-modal-contained.css";
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
    backdrop.hidden = true;
    titleNode = backdrop.querySelector(".su-blocked__title");
    messageNode = backdrop.querySelector(".su-blocked__message");
    urlNode = backdrop.querySelector(".su-blocked__url");
    okayButton = backdrop.querySelector(".su-blocked__button");

    if (!urlNode || !okayButton) {
      console.error("[ContainedBlockedModal] Missing modal parts");
      backdrop = null;
      return;
    }

    // Event handlers
    okayButton.addEventListener("click", hide);

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
   * Hide the modal
   */
  function hide() {
    if (destroyed || !backdrop) return;

    backdrop.classList.remove(VISIBLE_CLASS);
    backdrop.setAttribute("aria-hidden", "true");
    window.setTimeout(function () {
      if (!destroyed && backdrop && !backdrop.classList.contains(VISIBLE_CLASS)) {
        backdrop.hidden = true;
      }
    }, 300);

    // Restore focus within container
    if (lastFocusedElement && container.contains(lastFocusedElement)) {
      lastFocusedElement.focus({ preventScroll: true });
    }
  }

  /**
   * Show the blocked modal
   * @param {URL|string} targetUrl - The blocked URL/URI to display
   * @param {Object} [showOptions] - Display options
   * @param {string} [showOptions.variant='domain'] - Modal variant: 'domain' or 'uri'
   */
  function show(targetUrl, showOptions) {
    if (destroyed) return;

    var showOpts = showOptions || {};
    var variant = showOpts.variant || "domain";
    var config = VARIANTS[variant] || VARIANTS.domain;

    createModal();

    if (!backdrop || !urlNode || !okayButton) {
      return;
    }

    // Save focus for restoration
    var active = document.activeElement;
    lastFocusedElement = active && container.contains(active) ? active : null;

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

    backdrop.hidden = false;
    backdrop.setAttribute("aria-hidden", "false");
    backdrop.classList.add(VISIBLE_CLASS);

    // Focus the okay button
    setTimeout(function () {
      if (okayButton) okayButton.focus({ preventScroll: true });
    }, 0);
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
    okayButton = null;
    lastFocusedElement = null;
  }

  // Preload stylesheets early, but create DOM lazily to avoid flash-of-unstyled modal.
  if (document.head) {
    ensureStylesheets();
  } else {
    document.addEventListener("DOMContentLoaded", ensureStylesheets, { once: true });
  }

  // Return the controller API
  return {
    show: show,
    hide: hide,
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
