(function () {
  "use strict";

  const DEFAULT_HINT_TEXT = "Pinch to zoom, drag to pan, double tap Squares to activate";
  const DEFAULT_RESET_TEXT = "Reset zoom";

  function isTouchDevice() {
    if (window.SuBillboardPanZoom && typeof window.SuBillboardPanZoom.isTouchDevice === "function") {
      return window.SuBillboardPanZoom.isTouchDevice();
    }

    return "ontouchstart" in window || navigator.maxTouchPoints > 0;
  }

  function attach(options) {
    const settings = options || {};
    const wrapper = settings.wrapper;
    const uiMount = settings.uiMount;
    const onReset = settings.onReset;
    const hintText = settings.hintText || DEFAULT_HINT_TEXT;
    const resetText = settings.resetText || DEFAULT_RESET_TEXT;

    if (!wrapper || !uiMount || !isTouchDevice()) {
      return {
        onZoomChange: function () { },
        restore: function () { },
        destroy: function () { },
        elements: { hint: null, resetButton: null }
      };
    }

    let isZoomed = false;
    let hasPanZoomStarted = false;

    const hint = document.createElement("div");
    hint.className = "map-panzoom-hint";
    hint.textContent = hintText;
    hint.setAttribute("aria-hidden", "true");

    const resetButton = document.createElement("button");
    resetButton.type = "button";
    resetButton.className = "map-panzoom-reset";
    resetButton.textContent = resetText;

    function sync() {
      const showOverlay = hasPanZoomStarted || isZoomed;
      hint.classList.toggle("is-hidden", showOverlay);
      resetButton.classList.toggle("is-visible", showOverlay);
    }

    function handleTouchMove(event) {
      if (!hasPanZoomStarted && event.touches.length >= 2) {
        hasPanZoomStarted = true;
        sync();
      }
    }

    function handleResetClick() {
      hasPanZoomStarted = false;
      isZoomed = false;
      if (typeof onReset === "function") {
        onReset();
      }
      sync();
    }

    wrapper.appendChild(hint);
    uiMount.appendChild(resetButton);
    wrapper.addEventListener("touchmove", handleTouchMove, { passive: true });
    resetButton.addEventListener("click", handleResetClick);
    sync();

    return {
      onZoomChange: function (nextZoomed) {
        isZoomed = Boolean(nextZoomed);
        sync();
      },
      restore: function () {
        hasPanZoomStarted = false;
        isZoomed = false;
        sync();
      },
      destroy: function () {
        wrapper.removeEventListener("touchmove", handleTouchMove);
        resetButton.removeEventListener("click", handleResetClick);
        hint.remove();
        resetButton.remove();
      },
      elements: { hint: hint, resetButton: resetButton }
    };
  }

  window.SuBillboardTouchUi = {
    attach: attach,
    DEFAULT_HINT_TEXT: DEFAULT_HINT_TEXT,
    DEFAULT_RESET_TEXT: DEFAULT_RESET_TEXT
  };
}());
