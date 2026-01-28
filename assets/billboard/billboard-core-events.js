/**
 * Billboard core events
 * Owns:
 * - Pointer + click behavior
 * - Grid focus + keyboard navigation
 * - Resize reflow
 *
 * It does NOT own:
 * - Rendering (that stays in billboard-core.js via setSquare/showSquare)
 * - Business rules (filtering, activation meaning)
 */

import { GRID_DIMENSION, getSquareFromPosition, isTouchDevice } from "./billboard-utils.js";
import { getSquareFromCell, updateGridSelection } from "./billboard-view.js";

/**
 * @param {Object} ctx
 * @param {boolean} ctx.enableGrid
 * @param {boolean} ctx.enableKeyboard
 * @param {Object} ctx.elements
 * @param {HTMLElement} ctx.elements.wrapper
 * @param {HTMLImageElement} ctx.elements.image
 * @param {HTMLElement|null} ctx.elements.grid
 * @param {HTMLElement[]} ctx.elements.cells
 * @param {Object|null} ctx.panZoom
 * @param {string|null} ctx.cellClosestSelector
 * @param {Object} ctx.gridState
 * @param {() => number|null} ctx.getCurrentSquare
 * @param {(squareNumber:number) => void} ctx.setSquare
 * @param {() => void} ctx.clearSelection
 * @param {(squareNumber:number|null, event:Event) => boolean} ctx.activateSquare
 * @returns {{ destroy: () => void }}
 */
export function attachBillboardEvents(ctx) {
  const {
    enableGrid,
    enableKeyboard,
    elements,
    panZoom,
    cellClosestSelector,
    gridState,
    getCurrentSquare,
    setSquare,
    clearSelection,
    activateSquare,
  } = ctx;

  const { wrapper, image, grid, cells } = elements;
  const touchEnvironment = isTouchDevice();
  const DOUBLE_TAP_WINDOW_MS = 1200;
  const POINTER_TYPE_WINDOW_MS = 1200;
  const SUPPRESS_CLICK_WINDOW_MS = 1000;
  const TAP_MOVE_TOLERANCE_PX = 12;
  const TAP_MAX_DURATION_MS = 700;
  let pendingTouchSquare = null;
  let pendingTouchAt = 0;
  let lastPointerWasTouch = false;
  let lastPointerTypeAt = 0;
  let suppressClickUntil = 0;
  let touchStartX = null;
  let touchStartY = null;
  let touchStartAt = 0;

  function recordPointerType(event) {
    if (!event) return;
    if ("pointerType" in event) {
      if (event.pointerType === "touch") {
        lastPointerWasTouch = true;
        lastPointerTypeAt = Date.now();
        return;
      }
      if (event.pointerType === "mouse" || event.pointerType === "pen") {
        lastPointerWasTouch = false;
        lastPointerTypeAt = Date.now();
        return;
      }
    }

    if (event.touches || event.changedTouches) {
      lastPointerWasTouch = true;
      lastPointerTypeAt = Date.now();
    }
  }

  function shouldRequireDoubleTap(event) {
    if (!touchEnvironment) return false;
    const now = Date.now();
    if (lastPointerTypeAt && now - lastPointerTypeAt < POINTER_TYPE_WINDOW_MS) {
      return lastPointerWasTouch;
    }
    return true;
  }

  function wasTouchTap(event) {
    if (touchStartX === null || touchStartY === null || !touchStartAt) {
      return false;
    }
    if (!event || !event.changedTouches || !event.changedTouches[0]) {
      return false;
    }

    const touch = event.changedTouches[0];
    const dx = touch.clientX - touchStartX;
    const dy = touch.clientY - touchStartY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const duration = Date.now() - touchStartAt;

    return distance <= TAP_MOVE_TOLERANCE_PX && duration <= TAP_MAX_DURATION_MS;
  }

  function handleTouchStart(event) {
    recordPointerType(event);
    if (!event || !event.touches || event.touches.length !== 1) {
      touchStartX = null;
      touchStartY = null;
      touchStartAt = 0;
      return;
    }
    touchStartX = event.touches[0].clientX;
    touchStartY = event.touches[0].clientY;
    touchStartAt = Date.now();
  }

  function isTouchLikeEvent(event) {
    if (!event) return false;
    if ("pointerType" in event && event.pointerType === "touch") return true;
    if (event.touches || event.changedTouches) return true;
    if (touchEnvironment && event.type === "click") return true;
    return Boolean(panZoom && panZoom.isActive);
  }

  function getSquareFromEvent(event) {
    let clientX = event.clientX;
    let clientY = event.clientY;

    if (event.touches && event.touches[0]) {
      clientX = event.touches[0].clientX;
      clientY = event.touches[0].clientY;
    } else if (event.changedTouches && event.changedTouches[0]) {
      clientX = event.changedTouches[0].clientX;
      clientY = event.changedTouches[0].clientY;
    }

    let x, y, effectiveWidth;

    if (panZoom && panZoom.isActive) {
      const canvasCoords = panZoom.screenToCanvas(clientX, clientY);
      x = canvasCoords.x;
      y = canvasCoords.y;
      effectiveWidth = wrapper.offsetWidth || wrapper.clientWidth;
    } else {
      const rect = image.getBoundingClientRect();
      x = clientX - rect.left;
      y = clientY - rect.top;
      effectiveWidth = rect.width;
    }

    return getSquareFromPosition(x, y, effectiveWidth);
  }

  function getSquareFromEventOrCell(event) {
    if (cellClosestSelector && event && event.target && typeof event.target.closest === "function") {
      const cell = event.target.closest(cellClosestSelector);
      if (cell) {
        return getSquareFromCell(cell);
      }
    }
    return getSquareFromEvent(event);
  }

  function handlePointerMove(event) {
    recordPointerType(event);
    if (event && "pointerType" in event && event.pointerType === "touch") {
      return;
    }

    const squareNumber = getSquareFromEventOrCell(event);
    if (!squareNumber) {
      if (!grid || !grid.contains(document.activeElement)) {
        clearSelection();
      }
      return;
    }

    setSquare(squareNumber);
  }

  function handlePointerLeave() {
    if (grid && grid.contains(document.activeElement)) {
      return;
    }
    clearSelection();
  }

  function handleClick(event) {
    recordPointerType(event);
    if (panZoom && panZoom.hasPanned && panZoom.hasPanned()) {
      return;
    }

    const squareNumber = getSquareFromEventOrCell(event);
    if (!squareNumber) {
      return;
    }

    const now = Date.now();
    if (suppressClickUntil && now < suppressClickUntil) {
      return;
    }

    // Touch UX: first tap previews (shows tooltip), second tap activates.
    if (shouldRequireDoubleTap(event) || isTouchLikeEvent(event)) {
      const isSameSquare = pendingTouchSquare === squareNumber;
      const isWithinWindow = now - pendingTouchAt < DOUBLE_TAP_WINDOW_MS;
      if (!isSameSquare || !isWithinWindow) {
        pendingTouchSquare = squareNumber;
        pendingTouchAt = now;
        if (event.preventDefault) event.preventDefault();
        if (event.stopPropagation) event.stopPropagation();
        setSquare(squareNumber);
        return;
      }
      pendingTouchSquare = null;
      pendingTouchAt = 0;
    }

    if (squareNumber && enableGrid && cellClosestSelector && event?.target?.closest) {
      const cell = event.target.closest(cellClosestSelector);
      if (cell) {
        updateGridSelection(cells, squareNumber, gridState, {
          focusCell: true,
          updateTabStop: true,
        });
      }
    }

    activateSquare(squareNumber, event);
  }

  function handleTouchEnd(event) {
    recordPointerType(event);
    if (!shouldRequireDoubleTap(event)) return;

    if (panZoom && panZoom.hasPanned && panZoom.hasPanned()) {
      pendingTouchSquare = null;
      pendingTouchAt = 0;
      suppressClickUntil = Date.now() + SUPPRESS_CLICK_WINDOW_MS;
      return;
    }

    if (!wasTouchTap(event)) {
      pendingTouchSquare = null;
      pendingTouchAt = 0;
      suppressClickUntil = Date.now() + SUPPRESS_CLICK_WINDOW_MS;
      return;
    }

    const squareNumber = getSquareFromEventOrCell(event);
    if (!squareNumber) return;

    const now = Date.now();
    const isSameSquare = pendingTouchSquare === squareNumber;
    const isWithinWindow = now - pendingTouchAt < DOUBLE_TAP_WINDOW_MS;

    suppressClickUntil = now + SUPPRESS_CLICK_WINDOW_MS;

    if (!isSameSquare || !isWithinWindow) {
      pendingTouchSquare = squareNumber;
      pendingTouchAt = now;
      if (event.preventDefault) event.preventDefault();
      if (event.stopPropagation) event.stopPropagation();
      setSquare(squareNumber);
      return;
    }

    pendingTouchSquare = null;
    pendingTouchAt = 0;
    if (event.preventDefault) event.preventDefault();
    if (event.stopPropagation) event.stopPropagation();
    activateSquare(squareNumber, event);
  }

  function handleGridFocus(event) {
    if (!cellClosestSelector || !event?.target?.closest) return;

    const cell = event.target.closest(cellClosestSelector);
    const squareNumber = getSquareFromCell(cell);
    if (!squareNumber) return;

    updateGridSelection(cells, squareNumber, gridState, { updateTabStop: true });
    setSquare(squareNumber);
  }

  function handleGridFocusOut(event) {
    const nextFocus = event.relatedTarget;
    if (!nextFocus || !grid || !grid.contains(nextFocus)) {
      clearSelection();
    }
  }

  function handleGridKeydown(event) {
    if (!cellClosestSelector || !event?.target?.closest) return;

    const cell = event.target.closest(cellClosestSelector);
    if (!cell) return;

    const squareNumber = getSquareFromCell(cell);
    if (!squareNumber) return;

    const key = event.key.toLowerCase();
    let nextSquare = null;

    if (key === "w" || key === "," || key === "arrowup") {
      if (squareNumber > GRID_DIMENSION) nextSquare = squareNumber - GRID_DIMENSION;
    } else if (key === "a" || key === "arrowleft") {
      if ((squareNumber - 1) % GRID_DIMENSION !== 0) nextSquare = squareNumber - 1;
    } else if (key === "s" || key === "o" || key === "arrowdown") {
      if (squareNumber <= GRID_DIMENSION * (GRID_DIMENSION - 1)) nextSquare = squareNumber + GRID_DIMENSION;
    } else if (key === "d" || key === "e" || key === "arrowright") {
      if (squareNumber % GRID_DIMENSION !== 0) nextSquare = squareNumber + 1;
    } else if (key === "enter" || key === " " || key === "spacebar") {
      event.preventDefault();
      event.stopPropagation();
      activateSquare(squareNumber, event);
      return;
    } else {
      return;
    }

    if (nextSquare) {
      event.preventDefault();
      event.stopPropagation();
      updateGridSelection(cells, nextSquare, gridState, {
        focusCell: true,
        updateTabStop: true,
      });
      setSquare(nextSquare);
    }
  }

  function handleResize() {
    const current = getCurrentSquare();
    if (current) {
      setSquare(current);
    }
  }

  const pointerSurface = grid || image;
  pointerSurface.addEventListener("pointermove", handlePointerMove);
  pointerSurface.addEventListener("pointerdown", handlePointerMove);
  pointerSurface.addEventListener("pointerleave", handlePointerLeave);
  pointerSurface.addEventListener("click", handleClick);
  pointerSurface.addEventListener("touchstart", handleTouchStart, { passive: true });
  pointerSurface.addEventListener("touchend", handleTouchEnd, { passive: false });

  if (grid && enableKeyboard) {
    grid.addEventListener("focusin", handleGridFocus);
    grid.addEventListener("focusout", handleGridFocusOut);
    grid.addEventListener("keydown", handleGridKeydown);
  }

  wrapper.addEventListener("pointerleave", handlePointerLeave);
  window.addEventListener("resize", handleResize);

  function destroy() {
    pointerSurface.removeEventListener("pointermove", handlePointerMove);
    pointerSurface.removeEventListener("pointerdown", handlePointerMove);
    pointerSurface.removeEventListener("pointerleave", handlePointerLeave);
    pointerSurface.removeEventListener("click", handleClick);
    pointerSurface.removeEventListener("touchstart", handleTouchStart);
    pointerSurface.removeEventListener("touchend", handleTouchEnd);

    if (grid && enableKeyboard) {
      grid.removeEventListener("focusin", handleGridFocus);
      grid.removeEventListener("focusout", handleGridFocusOut);
      grid.removeEventListener("keydown", handleGridKeydown);
    }

    wrapper.removeEventListener("pointerleave", handlePointerLeave);
    window.removeEventListener("resize", handleResize);
  }

  return { destroy };
}
