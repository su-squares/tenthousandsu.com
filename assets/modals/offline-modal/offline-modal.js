(function () {
  const TEMPLATE = `
    <div class="su-offline-banner" role="status" aria-live="polite" aria-hidden="true">
      <svg class="su-offline-banner__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <line x1="12" y1="20" x2="12" y2="20.01" stroke-width="2" stroke-linecap="round"></line>
        <path d="M8 15.5a5 5 0 0 1 8 0" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"></path>
        <path d="M5 11.5a10 10 0 0 1 14 0" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"></path>
        <line x1="4.8" y1="4.8" x2="19.2" y2="19.2" stroke-width="2" stroke-linecap="round"></line>
      </svg>
      <div class="su-offline-banner__title">You are offline</div>
      <div class="su-offline-banner__message">Please reconnect to a network.</div>
    </div>
  `;
  const VISIBLE_CLASS = "is-visible";
  let banner;

  function ensureBanner() {
    if (banner) {
      return banner;
    }

    const wrapper = document.createElement("div");
    wrapper.innerHTML = TEMPLATE.trim();
    banner = wrapper.firstElementChild;

    if (!banner) {
      return null;
    }

    const append = function () {
      if (!document.body || document.body.contains(banner)) {
        return;
      }
      document.body.appendChild(banner);
    };

    if (document.body) {
      append();
    } else {
      document.addEventListener("DOMContentLoaded", append, { once: true });
    }

    return banner;
  }

  function show() {
    const node = ensureBanner();
    if (!node) {
      return;
    }
    node.setAttribute("aria-hidden", "false");
    node.classList.add(VISIBLE_CLASS);
  }

  function hide() {
    if (!banner) {
      return;
    }
    banner.setAttribute("aria-hidden", "true");
    banner.classList.remove(VISIBLE_CLASS);
  }

  function handleChange(isOnline) {
    if (isOnline) {
      hide();
    } else {
      show();
    }
  }

  window.addEventListener("online", function () { handleChange(true); });
  window.addEventListener("offline", function () { handleChange(false); });

  // Initial state
  handleChange(typeof navigator !== "undefined" ? navigator.onLine : true);
})();
