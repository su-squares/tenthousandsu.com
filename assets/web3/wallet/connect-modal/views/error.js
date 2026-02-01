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
      <h2 id="wallet-error-title">Error</h2>
    </div>
    <p class="wallet-helper" id="wallet-error-message" role="alert"></p>
    <div class="wallet-actions">
      <button class="wallet-btn" type="button" data-back>Try again</button>
    </div>
  `;
  const messageNode = target.querySelector("#wallet-error-message");
  if (messageNode) {
    messageNode.textContent = message || "Something went wrong.";
  }
  target.querySelector("[data-back]")?.addEventListener("click", onBack);
}
