/**
 * @param {HTMLElement} target
 * @param {Object} options
 * @param {string} options.message
 * @param {() => void} options.onBack
 */
export function renderErrorView(target, { message, onBack }) {
  if (!target) return;
  target.innerHTML = `
    <div class="wallet-modal__header">
      <h2>Error</h2>
    </div>
    <p class="wallet-helper">${message || "Something went wrong."}</p>
    <div class="wallet-actions">
      <button class="wallet-btn" type="button" data-back>Try again</button>
    </div>
  `;
  target.querySelector("[data-back]")?.addEventListener("click", onBack);
}
