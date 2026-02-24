/**
 * Canvas glow overlay for personalize billboard.
 * Supports two modes:
 * - Glow mode: animated pulsing glow borders around highlighted squares
 * - Static mode: solid colored squares with X marks (no animation, better perf)
 */

const DEFAULT_MAX_RESOLUTION = 1000;
const DEFAULT_DURATION_MS = 2600;
const FRAME_INTERVAL_MS = 1000 / 10;

function createCanvas(wrapper) {
  const canvas = document.createElement("canvas");
  canvas.className = "personalize-billboard__glow-canvas";
  wrapper.appendChild(canvas);
  return canvas;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

export function createPersonalizeGlowCanvas({
  wrapper,
  pulseTarget = null,
  maxResolution = DEFAULT_MAX_RESOLUTION,
  durationMs = DEFAULT_DURATION_MS,
} = {}) {
  if (!wrapper) return null;

  const canvas = createCanvas(wrapper);
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  let highlights = [];
  let staticHighlights = []; // For static mode: [{squareNumber, bgColor, xColor}]
  let mode = "glow"; // "glow" or "static"
  let size = 0;
  let scale = 1;
  let rafId = null;
  let start = null;
  let running = false;
  let lastDraw = 0;
  let glowLayer = null;
  let underlayLayer = null;
  let occluderLayer = null;
  let cacheDirty = true;

  function ensureLayerCanvas(existing) {
    if (existing) return existing;
    return document.createElement("canvas");
  }

  function updateCanvasSize() {
    const rect = wrapper.getBoundingClientRect();
    const nextSize = Math.floor(Math.min(rect.width, rect.height));
    if (!nextSize) return;

    const dpr = window.devicePixelRatio || 1;
    const target = Math.min(Math.floor(nextSize * dpr), maxResolution);
    if (canvas.width === target && canvas.height === target && size === nextSize) return;

    canvas.width = target;
    canvas.height = target;
    size = nextSize;
    scale = target / nextSize;
    cacheDirty = true;
  }

  function clearCanvas() {
    if (!size) return;
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.clearRect(0, 0, size, size);
  }

  function drawGlowLayer(pulse, targetCtx) {
    if (!size) return;
    targetCtx.setTransform(scale, 0, 0, scale, 0, 0);
    targetCtx.clearRect(0, 0, size, size);

    const cell = size / 100;
    const border = Math.max(2, Math.round(cell * 0.25));
    const scaleFactor = Math.max(0.75, cell / 12);
    const blurPrimary = (2 + 14 * pulse) * scaleFactor;
    const blurSecondary = (4 + 20 * pulse) * scaleFactor;

    // First pass: draw all glows
    targetCtx.globalAlpha = 1;
    for (const highlight of highlights) {
      const squareNumber = highlight.squareNumber;
      if (!squareNumber || squareNumber < 1 || squareNumber > 10000) continue;

      const index = squareNumber - 1;
      const row = Math.floor(index / 100);
      const col = index % 100;
      const x = col * cell;
      const y = row * cell;
      const color = highlight.color || "#fff";

      targetCtx.lineWidth = border;
      targetCtx.strokeStyle = color;
      targetCtx.shadowColor = color;

      const inset = border / 2;
      const width = cell - border;
      const height = cell - border;

      targetCtx.shadowBlur = blurPrimary;
      targetCtx.strokeRect(x + inset, y + inset, width, height);

      targetCtx.shadowBlur = blurSecondary;
      targetCtx.strokeRect(x + inset, y + inset, width, height);
    }
    targetCtx.shadowColor = "transparent";
    targetCtx.shadowBlur = 0;
  }

  function drawUnderlayLayer(targetCtx) {
    if (!size) return;
    targetCtx.setTransform(scale, 0, 0, scale, 0, 0);
    targetCtx.clearRect(0, 0, size, size);

    const cell = size / 100;
    const border = Math.max(2, Math.round(cell * 0.25));
    const inset = border / 2;
    const width = cell - border;
    const height = cell - border;

    targetCtx.lineWidth = border;
    targetCtx.strokeStyle = "#fff";

    for (const highlight of highlights) {
      const squareNumber = highlight.squareNumber;
      if (!squareNumber || squareNumber < 1 || squareNumber > 10000) continue;

      const index = squareNumber - 1;
      const row = Math.floor(index / 100);
      const col = index % 100;
      const x = col * cell;
      const y = row * cell;

      targetCtx.strokeRect(x + inset, y + inset, width, height);
    }
  }

  function drawOccluderLayer(targetCtx) {
    if (!size) return;
    targetCtx.setTransform(scale, 0, 0, scale, 0, 0);
    targetCtx.clearRect(0, 0, size, size);

    const cell = size / 100;
    const border = Math.max(2, Math.round(cell * 0.25));
    const whiteBorder = Math.max(1, Math.round(cell * 0.12));

    for (const highlight of highlights) {
      const squareNumber = highlight.squareNumber;
      if (!squareNumber || squareNumber < 1 || squareNumber > 10000) continue;

      const index = squareNumber - 1;
      const row = Math.floor(index / 100);
      const col = index % 100;
      const x = col * cell;
      const y = row * cell;

      // White square frame
      const whiteInset = border + whiteBorder / 2;
      const whiteSize = cell - border * 2 - whiteBorder;
      if (whiteSize > 0) {
        targetCtx.strokeStyle = "#fff";
        targetCtx.lineWidth = whiteBorder;
        targetCtx.strokeRect(x + whiteInset, y + whiteInset, whiteSize, whiteSize);
      }

      // White filled center to occlude glow bleed
      const centerInset = border + whiteBorder;
      const centerSize = cell - (border + whiteBorder) * 2;
      if (centerSize > 0) {
        targetCtx.fillStyle = "#fff";
        targetCtx.fillRect(x + centerInset, y + centerInset, centerSize, centerSize);
      } else {
        const fallbackSize = Math.min(cell, Math.max(1, cell * 0.4));
        const fallbackInset = (cell - fallbackSize) / 2;
        targetCtx.fillStyle = "#fff";
        targetCtx.fillRect(x + fallbackInset, y + fallbackInset, fallbackSize, fallbackSize);
      }
    }
  }

  function rebuildCache() {
    if (!size) return;
    glowLayer = ensureLayerCanvas(glowLayer);
    underlayLayer = ensureLayerCanvas(underlayLayer);
    occluderLayer = ensureLayerCanvas(occluderLayer);
    glowLayer.width = canvas.width;
    glowLayer.height = canvas.height;
    underlayLayer.width = canvas.width;
    underlayLayer.height = canvas.height;
    occluderLayer.width = canvas.width;
    occluderLayer.height = canvas.height;
    const glowCtx = glowLayer.getContext("2d");
    const underlayCtx = underlayLayer.getContext("2d");
    const occluderCtx = occluderLayer.getContext("2d");
    drawGlowLayer(1, glowCtx);
    drawUnderlayLayer(underlayCtx);
    drawOccluderLayer(occluderCtx);
    cacheDirty = false;
  }

  function drawHighlights(pulse) {
    if (cacheDirty) {
      rebuildCache();
    }
    if (!size || !glowLayer || !underlayLayer || !occluderLayer) return;
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.clearRect(0, 0, size, size);
    ctx.globalAlpha = 1;
    ctx.drawImage(underlayLayer, 0, 0, size, size);
    ctx.globalAlpha = 0.3 + 0.7 * pulse;
    ctx.drawImage(glowLayer, 0, 0, size, size);
    ctx.globalAlpha = 1;
    ctx.drawImage(occluderLayer, 0, 0, size, size);
  }

  function drawStaticMode() {
    if (!size) return;
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.clearRect(0, 0, size, size);

    const cell = size / 100;
    const xInset = cell * 0.15;
    const xThickness = Math.max(1, cell * 0.14);

    for (const highlight of staticHighlights) {
      const squareNumber = highlight.squareNumber;
      if (!squareNumber || squareNumber < 1 || squareNumber > 10000) continue;

      const index = squareNumber - 1;
      const row = Math.floor(index / 100);
      const col = index % 100;
      const x = col * cell;
      const y = row * cell;
      const bgColor = highlight.bgColor || "#fff";
      const xColor = highlight.xColor || "#000";

      // Draw filled background square
      ctx.fillStyle = bgColor;
      ctx.fillRect(x, y, cell, cell);

      // Draw X mark
      ctx.strokeStyle = xColor;
      ctx.lineWidth = xThickness;
      ctx.lineCap = "round";

      const x1 = x + xInset;
      const y1 = y + xInset;
      const x2 = x + cell - xInset;
      const y2 = y + cell - xInset;

      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(x2, y1);
      ctx.lineTo(x1, y2);
      ctx.stroke();
    }
  }

  function updatePulseTarget(pulse) {
    if (!pulseTarget) return;
    pulseTarget.style.setProperty("--glow-pulse", pulse.toFixed(3));
  }

  function tick(now) {
    if (!running) return;
    if (!start) start = now;
    if (now - lastDraw < FRAME_INTERVAL_MS) {
      rafId = requestAnimationFrame(tick);
      return;
    }
    lastDraw = now;
    const phase = ((now - start) / durationMs) * Math.PI * 2;
    const pulse = 0.5 + 0.5 * Math.cos(phase); // 0 to 1, starts at full glow
    const clamped = clamp(pulse, 0.05, 1);
    drawHighlights(clamped);
    updatePulseTarget(clamped);
    rafId = requestAnimationFrame(tick);
  }

  function startLoop() {
    if (running) return;
    running = true;
    start = null;
    lastDraw = 0;
    rafId = requestAnimationFrame(tick);
  }

  function stopLoop() {
    running = false;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
    start = null;
    cacheDirty = true;
    updatePulseTarget(0.5);
  }

  const resizeObserver = new ResizeObserver(() => {
    updateCanvasSize();
    if (mode === "glow" && highlights.length) {
      cacheDirty = true;
      drawHighlights(0.5);
    } else if (mode === "static" && staticHighlights.length) {
      drawStaticMode();
    }
  });

  resizeObserver.observe(wrapper);
  updateCanvasSize();

  let enabled = true;

  function setHighlights(nextHighlights) {
    highlights = Array.isArray(nextHighlights) ? nextHighlights : [];
    mode = "glow";
    staticHighlights = [];
    cacheDirty = true;
    if (enabled && highlights.length) {
      startLoop();
    } else {
      stopLoop();
      clearCanvas();
    }
  }

  function setStaticHighlights(nextHighlights) {
    staticHighlights = Array.isArray(nextHighlights) ? nextHighlights : [];
    mode = "static";
    highlights = [];
    stopLoop();
    if (enabled && staticHighlights.length) {
      canvas.style.display = "";
      drawStaticMode();
    } else {
      clearCanvas();
    }
  }

  function setEnabled(nextEnabled) {
    enabled = Boolean(nextEnabled);
    if (!enabled) {
      stopLoop();
      canvas.style.display = "none";
    } else {
      canvas.style.display = "";
      if (mode === "glow" && highlights.length) {
        cacheDirty = true;
        startLoop();
      } else if (mode === "static" && staticHighlights.length) {
        drawStaticMode();
      }
    }
  }

  function isEnabled() {
    return enabled;
  }

  function destroy() {
    stopLoop();
    resizeObserver.disconnect();
    canvas.remove();
  }

  return {
    setHighlights,
    setStaticHighlights,
    setEnabled,
    isEnabled,
    destroy,
  };
}
