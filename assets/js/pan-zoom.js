/**
 * Creates pan-zoom functionality for a wrapper element.
 * Mobile-only: uses touch events for pinch-zoom and drag-pan.
 * Applies CSS transforms to the wrapper, with coordinate conversion for hit detection.
 *
 * @param {HTMLElement} wrapper - Element to apply transforms to
 * @param {Object} options
 * @param {number} [options.minScale=1] - Minimum zoom level
 * @param {number} [options.maxScale=5] - Maximum zoom level
 * @returns {Object} Pan-zoom controller with screenToCanvas(), reset(), destroy()
 */
export function createPanZoom(wrapper, options = {}) {
  const { minScale = 1, maxScale = 6 } = options;

  // Check for touch support - only activate on touch devices
  const isTouchDevice = "ontouchstart" in window || navigator.maxTouchPoints > 0;
  if (!isTouchDevice) {
    return {
      screenToCanvas: (clientX, clientY) => {
        const rect = wrapper.getBoundingClientRect();
        return { x: clientX - rect.left, y: clientY - rect.top };
      },
      reset: () => { },
      destroy: () => { },
      isActive: false,
    };
  }

  // Transform state
  let scale = 1;
  let translateX = 0;
  let translateY = 0;

  // Touch tracking
  let initialTouches = null;
  let initialScale = 1;
  let initialTranslateX = 0;
  let initialTranslateY = 0;
  let didPan = false;
  let hasEverPinched = false; // Track if user has pinched at least once

  // Get dimensions dynamically - wrapper may not be visible at creation time (e.g., in modals)
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
      y: (touch1.clientY + touch2.clientY) / 2,
    };
  }

  function applyTransform() {
    wrapper.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scale})`;
  }

  function constrainBounds() {
    // Ensure at least 20% of canvas remains visible
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

  function handleTouchStart(e) {
    if (e.touches.length === 1 || e.touches.length === 2) {
      initialTouches = Array.from(e.touches);
      initialScale = scale;
      initialTranslateX = translateX;
      initialTranslateY = translateY;
      didPan = false;
    }
  }

  function handleTouchMove(e) {
    if (!initialTouches) return;

    if (e.touches.length === 2 && initialTouches.length === 2) {
      // Pinch-zoom
      e.preventDefault();
      didPan = true;
      hasEverPinched = true; // User has performed a pinch, unlock panning

      const currentDistance = getDistance(e.touches[0], e.touches[1]);
      const initialDistance = getDistance(initialTouches[0], initialTouches[1]);
      const scaleRatio = currentDistance / initialDistance;

      const newScale = clamp(initialScale * scaleRatio, minScale, maxScale);

      // Focal point zoom - keep the same canvas point under the midpoint
      const rect = wrapper.parentElement.getBoundingClientRect();
      const midpoint = getMidpoint(e.touches[0], e.touches[1]);
      const screenX = midpoint.x - rect.left;
      const screenY = midpoint.y - rect.top;

      const canvasX = (screenX - initialTranslateX) / initialScale;
      const canvasY = (screenY - initialTranslateY) / initialScale;

      translateX = screenX - canvasX * newScale;
      translateY = screenY - canvasY * newScale;
      scale = newScale;

      constrainBounds();
      applyTransform();
    } else if (e.touches.length === 1 && hasEverPinched) {
      // Single finger pan (only allowed after user has pinched at least once)
      e.preventDefault();
      didPan = true;

      const deltaX = e.touches[0].clientX - initialTouches[0].clientX;
      const deltaY = e.touches[0].clientY - initialTouches[0].clientY;

      translateX = initialTranslateX + deltaX;
      translateY = initialTranslateY + deltaY;

      constrainBounds();
      applyTransform();
    }
  }

  function handleTouchEnd(e) {
    if (e.touches.length === 0) {
      initialTouches = null;
    } else if (e.touches.length === 1) {
      // Went from 2 fingers to 1 - reset for single-finger pan
      initialTouches = Array.from(e.touches);
      initialScale = scale;
      initialTranslateX = translateX;
      initialTranslateY = translateY;
    }
  }

  /**
   * Convert screen coordinates to canvas-space coordinates.
   * Use this for hit detection after transforms are applied.
   */
  function screenToCanvas(clientX, clientY) {
    const rect = wrapper.parentElement.getBoundingClientRect();
    const screenX = clientX - rect.left;
    const screenY = clientY - rect.top;

    // Reverse the transform: visual = (original * scale) + translate
    // So: original = (visual - translate) / scale
    const canvasX = (screenX - translateX) / scale;
    const canvasY = (screenY - translateY) / scale;

    return { x: canvasX, y: canvasY };
  }

  /**
   * Check if user panned/zoomed since last touchstart.
   * Useful for suppressing click events after pan gestures.
   */
  function hasPanned() {
    return didPan;
  }

  /**
   * Reset to initial state (scale=1, no translation).
   */
  function reset() {
    scale = 1;
    translateX = 0;
    translateY = 0;
    initialTouches = null;
    didPan = false;
    hasEverPinched = false; // Re-lock panning until next pinch
    wrapper.style.transform = "";
  }

  /**
   * Remove event listeners and clean up.
   */
  function destroy() {
    wrapper.removeEventListener("touchstart", handleTouchStart);
    wrapper.removeEventListener("touchmove", handleTouchMove);
    wrapper.removeEventListener("touchend", handleTouchEnd);
    wrapper.removeEventListener("touchcancel", handleTouchEnd);
    reset();
  }

  // Attach event listeners
  wrapper.addEventListener("touchstart", handleTouchStart, { passive: true });
  wrapper.addEventListener("touchmove", handleTouchMove, { passive: false });
  wrapper.addEventListener("touchend", handleTouchEnd, { passive: true });
  wrapper.addEventListener("touchcancel", handleTouchEnd, { passive: true });

  return {
    screenToCanvas,
    hasPanned,
    reset,
    destroy,
    isActive: true,
    get scale() {
      return scale;
    },
  };
}
