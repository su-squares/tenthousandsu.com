(function () {
  const overlay = document.querySelector(".su-nav-overlay");
  const mainModal = document.getElementById("su-nav-main-modal");
  const articlesModal = document.getElementById("su-nav-articles-modal");
  const hamburger = document.querySelector(".su-nav-hamburger");
  const articlesTrigger = document.querySelector(".su-nav-btn-articles");
  const backButton = document.querySelector(".su-nav-back");
  const closeButtons = document.querySelectorAll(".su-nav-close");
  const articleLinks = Array.from(document.querySelectorAll(".su-nav-article-link"));
  const navLinks = Array.from(document.querySelectorAll("[data-nav-path]"));
  const batchButton = document.querySelector(".su-nav-btn--batch");
  const batchMediaQuery = window.matchMedia("(max-width: 380px)");
  let lastFocusedElement = null;

  if (!overlay || !mainModal || !articlesModal || !hamburger) {
    return;
  }

  function normalizePath(pathname) {
    if (!pathname) {
      return "/";
    }
    let path = pathname.split("?")[0].split("#")[0];
    path = path.replace(/index\.html$/, "");
    path = path.replace(/\.html$/, "");
    if (path.length > 1 && path.endsWith("/")) {
      path = path.slice(0, -1);
    }
    return path || "/";
  }

  function markActiveLinks() {
    const currentPath = normalizePath(window.location.pathname);
    const aliases = new Set([
      currentPath,
      currentPath + "/",
      currentPath + ".html",
    ]);
    navLinks.forEach((link) => {
      const targetPath = normalizePath(link.dataset.navPath || link.getAttribute("href"));
      if (aliases.has(targetPath) || aliases.has(targetPath + "/") || aliases.has(targetPath + ".html")) {
        link.classList.add("is-active");
        link.setAttribute("aria-current", "page");
      }
    });
  }

  function setBatchLabel() {
    if (!batchButton) {
      return;
    }
    batchButton.textContent = batchMediaQuery.matches ? "Personalize Batch" : "Batch mode";
  }

  function showOverlay() {
    overlay.classList.add("is-visible");
    overlay.setAttribute("aria-hidden", "false");
  }

  function hideOverlay() {
    overlay.classList.remove("is-visible");
    overlay.setAttribute("aria-hidden", "true");
  }

  function openMainModal() {
    showOverlay();
    mainModal.classList.add("is-active");
    mainModal.setAttribute("aria-hidden", "false");
    articlesModal.classList.remove("is-active");
    articlesModal.setAttribute("aria-hidden", "true");
    hamburger.setAttribute("aria-expanded", "true");
    setTimeout(() => {
      mainModal.focus({ preventScroll: true });
    }, 0);
  }

  function openArticlesModal() {
    showOverlay();
    mainModal.classList.remove("is-active");
    mainModal.setAttribute("aria-hidden", "true");
    articlesModal.classList.add("is-active");
    articlesModal.setAttribute("aria-hidden", "false");
    hamburger.setAttribute("aria-expanded", "true");
    setTimeout(() => {
      const target = articleLinks[0] || articlesModal;
      target.focus({ preventScroll: true });
    }, 0);
  }

  function closeAll() {
    mainModal.classList.remove("is-active");
    mainModal.setAttribute("aria-hidden", "true");
    articlesModal.classList.remove("is-active");
    articlesModal.setAttribute("aria-hidden", "true");
    hideOverlay();
    hamburger.setAttribute("aria-expanded", "false");
    if (lastFocusedElement && document.contains(lastFocusedElement)) {
      lastFocusedElement.focus({ preventScroll: true });
    }
  }

  hamburger.addEventListener("click", function () {
    lastFocusedElement = document.activeElement;
    if (overlay.classList.contains("is-visible") && mainModal.classList.contains("is-active")) {
      closeAll();
    } else {
      openMainModal();
    }
  });

  if (articlesTrigger) {
    articlesTrigger.addEventListener("click", function (event) {
      event.preventDefault();
      openArticlesModal();
    });
  }

  if (backButton) {
    backButton.addEventListener("click", function () {
      openMainModal();
    });
  }

  closeButtons.forEach((btn) => {
    btn.addEventListener("click", closeAll);
  });

  overlay.addEventListener("click", function (event) {
    if (event.target === overlay) {
      closeAll();
    }
  });

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && overlay.classList.contains("is-visible")) {
      closeAll();
    }
  });

  markActiveLinks();
  setBatchLabel();
  batchMediaQuery.addEventListener("change", setBatchLabel);
})();
