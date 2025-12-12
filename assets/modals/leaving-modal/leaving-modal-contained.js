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

const TEMPLATE_HTML = `
  <div class="su-leaving-backdrop su-leaving-backdrop--contained" aria-hidden="true">
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

/**
 * Get all domain parts for matching (domain + all parent domains)
 * e.g., "a.b.c.com" → ["a.b.c.com", "b.c.com", "c.com", "com"]
 */
function getDomainParts(domain) {
  if (!domain) return [];
  const parts = domain.split(".");
  const result = [];
  for (let i = 0; i < parts.length; i++) {
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
 * @param {string[]} [options.allowlist] - Additional allowed domains
 * @param {string[]} [options.blocklist] - Additional blocked domains
 * @param {string} [options.baseStylesheetHref] - Path to base modal.css (if not already loaded)
 * @param {string} [options.containedStylesheetHref] - Path to modal-contained.css (if not already loaded)
 * @returns {Object} Modal controller
 */
export function createContainedLeavingModal(container, options = {}) {
  if (!container || !(container instanceof HTMLElement)) {
    console.error("[ContainedLeavingModal] Invalid container element");
    return null;
  }

  // Ensure container has proper positioning
  const containerStyle = window.getComputedStyle(container);
  if (containerStyle.position === "static") {
    container.style.position = "relative";
  }

  // Instance state
  const allowlist = new Set(BUILT_IN_ALLOWED);
  const blocklist = new Set();
  let backdrop = null;
  let urlNode = null;
  let stayButton = null;
  let goButton = null;
  let lastFocusedElement = null;
  let pendingUrl = null;
  let pendingTarget = null;
  let destroyed = false;

  // Add custom allowlist/blocklist entries
  if (options.allowlist && Array.isArray(options.allowlist)) {
    options.allowlist.forEach((d) => {
      if (typeof d === "string" && d.trim()) {
        allowlist.add(d.trim().toLowerCase());
      }
    });
  }

  if (options.blocklist && Array.isArray(options.blocklist)) {
    options.blocklist.forEach((d) => {
      if (typeof d === "string" && d.trim()) {
        blocklist.add(d.trim().toLowerCase());
      }
    });
  }

  /**
   * Ensure stylesheets are loaded
   */
  function ensureStylesheets() {
    const baseurl = window.SITE_BASEURL || "";

    // Base modal styles
    const baseHref = options.baseStylesheetHref || baseurl + "/assets/modals/leaving-modal/modal.css";
    if (!document.querySelector(`link[href="${baseHref}"]`)) {
      const baseLink = document.createElement("link");
      baseLink.rel = "stylesheet";
      baseLink.href = baseHref;
      document.head.appendChild(baseLink);
    }

    // Contained variant styles
    const containedHref = options.containedStylesheetHref || baseurl + "/assets/modals/leaving-modal/modal-contained.css";
    if (!document.querySelector(`link[href="${containedHref}"]`)) {
      const containedLink = document.createElement("link");
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

    const wrapper = document.createElement("div");
    wrapper.innerHTML = TEMPLATE_HTML.trim();
    backdrop = wrapper.firstElementChild;
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

    goButton.addEventListener("click", () => {
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

    // Click backdrop to close
    backdrop.addEventListener("click", (event) => {
      if (event.target === backdrop) {
        hide();
      }
    });

    // Escape key to close
    backdrop.addEventListener("keydown", (event) => {
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
    const normalized = domain.toLowerCase();

    if (blocklist.has(normalized)) return true;

    const domainParts = getDomainParts(normalized);
    for (const part of domainParts) {
      if (blocklist.has(part)) return true;
    }

    for (const blockedDomain of blocklist) {
      const blockedParts = getDomainParts(blockedDomain);
      if (blockedParts.includes(normalized)) return true;
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
   * Check if we should show warning for this URL
   */
  function shouldWarnForUrl(url) {
    if (!url || !isHttpUrl(url)) return false;

    const currentHost = window.location.hostname.toLowerCase();
    const hostname = url.hostname.toLowerCase();

    if (hostname === currentHost) return false;
    if (allowlist.has(hostname)) return false;

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

    // Restore focus within container
    if (lastFocusedElement && container.contains(lastFocusedElement)) {
      lastFocusedElement.focus({ preventScroll: true });
    }
  }

  /**
   * Show the modal for a target URL
   */
  function show(targetUrl, target = "_self") {
    if (destroyed) return;

    createModal();

    if (!backdrop || !urlNode || !stayButton) {
      // Fallback: navigate directly
      if (target === "_self") {
        window.location.assign(targetUrl.href);
      } else {
        window.open(targetUrl.href, target, "noopener");
      }
      return;
    }

    // Save focus for restoration
    const active = document.activeElement;
    lastFocusedElement = active && container.contains(active) ? active : null;

    pendingUrl = targetUrl;
    pendingTarget = target;

    urlNode.textContent = targetUrl.href;
    urlNode.href = targetUrl.href;
    backdrop.setAttribute("aria-hidden", "false");
    backdrop.classList.add(VISIBLE_CLASS);

    // Focus the stay button
    setTimeout(() => {
      if (stayButton) stayButton.focus({ preventScroll: true });
    }, 0);
  }

  /**
   * Gate an anchor element - intercept clicks and show modal if needed
   */
  function gateAnchor(anchor) {
    if (destroyed || !anchor) return;

    createModal();

    if (anchor.dataset.suLeavingContainedGuarded === "1") return;
    anchor.dataset.suLeavingContainedGuarded = "1";

    anchor.addEventListener("click", (event) => {
      const href = anchor.getAttribute("href");
      if (!href) return;

      let destination;
      try {
        destination = new URL(href, window.location.href);
      } catch {
        return;
      }

      // Check blocklist first
      if (isUrlBlocked(destination)) {
        event.preventDefault();
        // For blocked URLs in contained context, just prevent navigation
        // Could show a "blocked" message here if needed
        return;
      }

      if (!shouldWarnForUrl(destination)) return;

      event.preventDefault();
      show(destination, anchor.getAttribute("target") || "_self");
    });
  }

  /**
   * Add domains to the blocklist at runtime
   */
  function addBlockedDomains(domains) {
    if (!Array.isArray(domains)) return;
    domains.forEach((d) => {
      if (typeof d === "string" && d.trim()) {
        blocklist.add(d.trim().toLowerCase());
      }
    });
  }

  /**
   * Add domains to the allowlist at runtime
   */
  function addAllowedDomains(domains) {
    if (!Array.isArray(domains)) return;
    domains.forEach((d) => {
      if (typeof d === "string" && d.trim()) {
        allowlist.add(d.trim().toLowerCase());
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
    urlNode = null;
    stayButton = null;
    goButton = null;
    lastFocusedElement = null;
    pendingUrl = null;
    pendingTarget = null;
  }

  // Initialize modal DOM on creation
  createModal();

  // Return the controller API
  return {
    show,
    hide,
    gateAnchor,
    shouldWarnForUrl,
    isUrlBlocked,
    addBlockedDomains,
    addAllowedDomains,
    destroy,

    // Expose state for debugging
    get isVisible() {
      return backdrop && backdrop.classList.contains(VISIBLE_CLASS);
    },
    get isDestroyed() {
      return destroyed;
    },
  };
}
