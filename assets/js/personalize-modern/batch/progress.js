export function createBatchProgressOverlay({ title, mount } = {}) {
  let overlay = null;
  let messageNode = null;
  let countNode = null;

  const overlayTitle = title || "Processing";
  const overlayMount = mount && mount.nodeType === 1 ? mount : document.body;

  const setMountState = (active) => {
    if (overlayMount && overlayMount !== document.body) {
      overlayMount.classList.toggle("is-batch-overlay-active", active);
    }
  };

  const ensureOverlay = () => {
    if (overlay) return;
    overlay = document.createElement("div");
    overlay.className = "personalize-batch__overlay";
    overlay.hidden = true;
    overlay.setAttribute("aria-hidden", "true");
    overlay.innerHTML = `
      <div class="personalize-batch__overlay-card" role="status" aria-live="polite">
        <div class="personalize-batch__overlay-title">${overlayTitle}</div>
        <div class="personalize-batch__overlay-message">
          <span class="personalize-batch__overlay-text"></span>
          <span class="personalize-batch__overlay-count"></span>
        </div>
      </div>
    `;
    messageNode = overlay.querySelector(".personalize-batch__overlay-text");
    countNode = overlay.querySelector(".personalize-batch__overlay-count");
    overlayMount.appendChild(overlay);
  };

  const show = (message, processed, total) => {
    ensureOverlay();
    if (!overlay || !messageNode || !countNode) return;
    overlay.hidden = false;
    overlay.setAttribute("aria-hidden", "false");
    setMountState(true);
    messageNode.textContent = message || overlayTitle;
    if (Number.isFinite(total) && total > 0) {
      const capped = Math.min(processed, total);
      countNode.textContent = ` (${capped}/${total})`;
    } else if (Number.isFinite(processed) && processed > 0) {
      countNode.textContent = ` (${processed})`;
    } else {
      countNode.textContent = "";
    }
  };

  const update = (message, processed, total) => {
    if (!overlay || overlay.hidden) {
      show(message, processed, total);
      return;
    }
    if (messageNode) {
      messageNode.textContent = message || overlayTitle;
    }
    if (countNode) {
      if (Number.isFinite(total) && total > 0) {
        const capped = Math.min(processed, total);
        countNode.textContent = ` (${capped}/${total})`;
      } else if (Number.isFinite(processed) && processed > 0) {
        countNode.textContent = ` (${processed})`;
      } else {
        countNode.textContent = "";
      }
    }
  };

  const hide = () => {
    if (!overlay) return;
    overlay.hidden = true;
    overlay.setAttribute("aria-hidden", "true");
    setMountState(false);
  };

  return { show, update, hide };
}

export function createBatchProgressController(options = {}) {
  const {
    title = "Processing",
    threshold = 50,
    delayMs = 200,
    mount = null,
  } = options;
  const overlay = createBatchProgressOverlay({ title, mount });
  let visible = false;
  let timer = null;

  const clearTimer = () => {
    if (!timer) return;
    window.clearTimeout(timer);
    timer = null;
  };

  const maybeShow = (message, processed, total) => {
    if (visible) {
      overlay.update(message, processed, total);
      return;
    }
    if (!Number.isFinite(total) || total < threshold) return;
    if (timer) return;
    timer = window.setTimeout(() => {
      timer = null;
      visible = true;
      overlay.show(message, processed, total);
    }, delayMs);
  };

  const update = (message, processed, total) => {
    if (visible) {
      overlay.update(message, processed, total);
      return;
    }
    maybeShow(message, processed, total);
  };

  const hide = () => {
    clearTimer();
    if (visible) {
      overlay.hide();
    }
    visible = false;
  };

  return { update, hide };
}
