/**
 * @param {HTMLElement} target
 * @param {() => void} onBack
 */
export function renderCanceledView(target, onBack) {
  if (!target) return;
  target.innerHTML = `
    <div class="wallet-modal__header">
      <h2>Request canceled</h2>
    </div>
    <p class="wallet-helper">You denied the connection request.</p>
    <div class="wallet-actions">
      <button class="wallet-btn" type="button" data-back>Back</button>
    </div>
  `;
  target.querySelector("[data-back]")?.addEventListener("click", onBack);
}
