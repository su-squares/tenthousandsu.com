(function () {
  "use strict";

  function isTouchDevice() {
    return "ontouchstart" in window || navigator.maxTouchPoints > 0;
  }

  function create(wrapper, options) {
    const settings = options || {};
    const minScale = settings.minScale || 1;
    const maxScale = settings.maxScale || 6;
    const onZoomChange = settings.onZoomChange;

    if (!wrapper || !isTouchDevice()) {
      return {
        screenToCanvas: function (clientX, clientY) {
          if (!wrapper) return { x: clientX, y: clientY };
          const rect = wrapper.getBoundingClientRect();
          return { x: clientX - rect.left, y: clientY - rect.top };
        },
        reset: function () { },
        destroy: function () { },
        hasPanned: function () { return false; },
        isActive: false,
        scale: 1
      };
    }

    let scale = 1;
    let translateX = 0;
    let translateY = 0;
    let initialTouches = null;
    let initialScale = 1;
    let initialTranslateX = 0;
    let initialTranslateY = 0;
    let didPan = false;
    let hasEverPinched = false;
    let wasZoomed = false;

    function notifyZoomChange() {
      const isZoomed = scale !== 1 || translateX !== 0 || translateY !== 0;
      if (isZoomed !== wasZoomed) {
        wasZoomed = isZoomed;
        if (typeof onZoomChange === "function") {
          onZoomChange(isZoomed);
        }
      }
    }

    function getViewport() {
      return wrapper.parentElement || wrapper;
    }

    function getOriginalWidth() {
      return wrapper.offsetWidth || wrapper.clientWidth || 0;
    }

    function getOriginalHeight() {
      return wrapper.offsetHeight || wrapper.clientHeight || 0;
    }

    function clamp(value, min, max) {
      return Math.min(Math.max(value, min), max);
    }

    function getDistance(touch1, touch2) {
      const dx = touch2.clientX - touch1.clientX;
      const dy = touch2.clientY - touch1.clientY;
      return Math.sqrt(dx * dx + dy * dy);
    }

    function getMidpoint(touch1, touch2) {
      return {
        x: (touch1.clientX + touch2.clientX) / 2,
        y: (touch1.clientY + touch2.clientY) / 2
      };
    }

    function applyTransform() {
      wrapper.style.transform = scale === 1 && translateX === 0 && translateY === 0
        ? ""
        : "translate(" + translateX + "px, " + translateY + "px) scale(" + scale + ")";
      notifyZoomChange();
    }

    function constrainBounds() {
      const originalWidth = getOriginalWidth();
      const originalHeight = getOriginalHeight();
      const scaledWidth = originalWidth * scale;
      const scaledHeight = originalHeight * scale;
      const minVisible = 0.2;

      const minX = originalWidth * minVisible - scaledWidth;
      const maxX = originalWidth * (1 - minVisible);
      const minY = originalHeight * minVisible - scaledHeight;
      const maxY = originalHeight * (1 - minVisible);

      translateX = clamp(translateX, minX, maxX);
      translateY = clamp(translateY, minY, maxY);
    }

    function handleTouchStart(event) {
      if (event.touches.length === 1 || event.touches.length === 2) {
        initialTouches = Array.from(event.touches);
        initialScale = scale;
        initialTranslateX = translateX;
        initialTranslateY = translateY;
        didPan = false;
      }
    }

    function handleTouchMove(event) {
      if (!initialTouches) return;

      if (event.touches.length === 2 && initialTouches.length === 2) {
        event.preventDefault();
        didPan = true;
        hasEverPinched = true;

        const currentDistance = getDistance(event.touches[0], event.touches[1]);
        const initialDistance = getDistance(initialTouches[0], initialTouches[1]);
        const scaleRatio = currentDistance / initialDistance;
        const newScale = clamp(initialScale * scaleRatio, minScale, maxScale);

        const viewportRect = getViewport().getBoundingClientRect();
        const midpoint = getMidpoint(event.touches[0], event.touches[1]);
        const screenX = midpoint.x - viewportRect.left;
        const screenY = midpoint.y - viewportRect.top;

        const canvasX = (screenX - initialTranslateX) / initialScale;
        const canvasY = (screenY - initialTranslateY) / initialScale;

        translateX = screenX - canvasX * newScale;
        translateY = screenY - canvasY * newScale;
        scale = newScale;

        constrainBounds();
        applyTransform();
      } else if (event.touches.length === 1 && hasEverPinched) {
        event.preventDefault();
        didPan = true;

        const deltaX = event.touches[0].clientX - initialTouches[0].clientX;
        const deltaY = event.touches[0].clientY - initialTouches[0].clientY;

        translateX = initialTranslateX + deltaX;
        translateY = initialTranslateY + deltaY;

        constrainBounds();
        applyTransform();
      }
    }

    function handleTouchEnd(event) {
      if (event.touches.length === 0) {
        initialTouches = null;
      } else if (event.touches.length === 1) {
        initialTouches = Array.from(event.touches);
        initialScale = scale;
        initialTranslateX = translateX;
        initialTranslateY = translateY;
      }
    }

    function screenToCanvas(clientX, clientY) {
      const viewportRect = getViewport().getBoundingClientRect();
      const screenX = clientX - viewportRect.left;
      const screenY = clientY - viewportRect.top;

      return {
        x: (screenX - translateX) / scale,
        y: (screenY - translateY) / scale
      };
    }

    function canvasToScreen(x, y) {
      return {
        x: x * scale + translateX,
        y: y * scale + translateY
      };
    }

    function reset() {
      scale = 1;
      translateX = 0;
      translateY = 0;
      initialTouches = null;
      didPan = false;
      hasEverPinched = false;
      wrapper.style.transform = "";
      notifyZoomChange();
    }

    function destroy() {
      wrapper.removeEventListener("touchstart", handleTouchStart);
      wrapper.removeEventListener("touchmove", handleTouchMove);
      wrapper.removeEventListener("touchend", handleTouchEnd);
      wrapper.removeEventListener("touchcancel", handleTouchEnd);
      reset();
    }

    wrapper.addEventListener("touchstart", handleTouchStart, { passive: true });
    wrapper.addEventListener("touchmove", handleTouchMove, { passive: false });
    wrapper.addEventListener("touchend", handleTouchEnd, { passive: true });
    wrapper.addEventListener("touchcancel", handleTouchEnd, { passive: true });

    return {
      screenToCanvas: screenToCanvas,
      canvasToScreen: canvasToScreen,
      hasPanned: function () { return didPan; },
      reset: reset,
      destroy: destroy,
      isActive: true,
      get scale() {
        return scale;
      }
    };
  }

  window.SuBillboardPanZoom = {
    create: create,
    isTouchDevice: isTouchDevice
  };
}());
