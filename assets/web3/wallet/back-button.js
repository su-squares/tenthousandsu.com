/**
 * Ensure a reusable back button exists on the modal and wire a handler.
 * The button mirrors the close icon positioning on the left side.
 * @param {HTMLElement} modalEl
 * @param {Function|null} onBack
 * @returns {HTMLButtonElement|null}
 */
export function ensureBackButton(modalEl, onBack) {
  if (!modalEl) return null;
  let backBtn = modalEl.querySelector(".wallet-back");
  if (!backBtn) {
    backBtn = document.createElement("button");
    backBtn.type = "button";
    backBtn.className = "wallet-back";
    backBtn.setAttribute("aria-label", "Back");
    backBtn.textContent = "←";
    modalEl.appendChild(backBtn);
  }
  backBtn.style.display = onBack ? "block" : "none";
  backBtn.onclick = onBack || null;
  return backBtn;
}
