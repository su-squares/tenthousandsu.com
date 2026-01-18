import { GRID_DIMENSION } from "../billboard-utils.js";

export function createPersonalizeImagePlacementOverlay({ wrapper, panZoom }) {
  if (!wrapper) return null;

  const overlay = document.createElement("div");
  overlay.className = "personalize-billboard__placement-overlay";
  overlay.hidden = true;
  overlay.tabIndex = 0;
  overlay.style.touchAction = "none";

  const image = document.createElement("img");
  image.className = "personalize-billboard__placement-image";
  image.alt = "";
  image.setAttribute("aria-hidden", "true");
  overlay.appendChild(image);

  wrapper.appendChild(overlay);

  const getCellSize = () => {
    const width = wrapper.offsetWidth || wrapper.clientWidth || 0;
    return width / GRID_DIMENSION;
  };

  const screenToCanvas = (clientX, clientY) => {
    if (panZoom?.isActive && typeof panZoom.screenToCanvas === "function") {
      return panZoom.screenToCanvas(clientX, clientY);
    }
    const rect = wrapper.getBoundingClientRect();
    return { x: clientX - rect.left, y: clientY - rect.top };
  };

  const updateBounds = (state) => {
    if (!state) return;
    const cellSize = getCellSize();
    overlay.style.width = `${state.widthSquares * cellSize}px`;
    overlay.style.height = `${state.heightSquares * cellSize}px`;
    overlay.style.left = `${state.col * cellSize}px`;
    overlay.style.top = `${state.row * cellSize}px`;
  };

  const setImageSource = (src) => {
    image.src = src || "";
  };

  const setVisible = (visible) => {
    overlay.hidden = !visible;
  };

  const setInvalid = (isInvalid) => {
    overlay.classList.toggle("is-invalid", Boolean(isInvalid));
  };

  const destroy = () => {
    overlay.remove();
  };

  return {
    element: overlay,
    updateBounds,
    setImageSource,
    setVisible,
    setInvalid,
    getCellSize,
    screenToCanvas,
    destroy,
  };
}
