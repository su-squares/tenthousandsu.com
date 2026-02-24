import { escapeAttr, escapeHtml } from "../base/utils.js";

/**
 * Render the "add network manually" instructions view.
 * @param {HTMLElement} target
 * @param {{ activeNetwork: any, onDisconnect: Function }} options
 */
export function renderAddNetworkView(target, { activeNetwork, onDisconnect }) {
  if (!target || !activeNetwork) return;

  const nativeCurrency = activeNetwork.nativeCurrency || { symbol: "ETH" };
  const rpcUrl = activeNetwork.rpcUrls?.[0] || "";
  const explorerUrl = activeNetwork.explorerBaseUrl || "";

  const fields = [
    { label: "Network Name", value: activeNetwork.label },
    { label: "Chain ID", value: String(activeNetwork.chainId) },
    { label: "RPC URL", value: rpcUrl },
    { label: "Currency Symbol", value: nativeCurrency.symbol },
  ];

  if (explorerUrl) {
    fields.push({ label: "Block Explorer", value: explorerUrl });
  }

  target.innerHTML = `
    <div class="wallet-modal__header">
      <h2 id="wallet-account-title">Add Network</h2>
    </div>
    <p class="wallet-helper" id="wallet-add-network-desc">
      To use this app, add <strong>${escapeHtml(activeNetwork.label)}</strong> to your wallet, then disconnect and reconnect.
    </p>
    <p class="wallet-helper wallet-helper--secondary">
      Find the option to <em>Add a custom network</em> in your wallet settings, then add these:
    </p>
    <div class="wallet-add-network-fields">
      ${fields
        .map(
          (field, index) => `
        <button type="button" class="wallet-copy-field" data-copy-index="${index}" data-copy-value="${escapeAttr(
            field.value
          )}">
          <span class="wallet-copy-field__label">${field.label}</span>
          <span class="wallet-copy-field__value">${escapeHtml(field.value)}</span>
          <span class="wallet-copy-field__status"></span>
        </button>
      `
        )
        .join("")}
    </div>
    <div class="wallet-actions" style="margin-top: 1.5rem;">
      <button class="wallet-btn wallet-btn--ghost" type="button" data-disconnect>
        Disconnect
      </button>
    </div>
  `;

  target.querySelectorAll("[data-copy-index]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const value = btn.dataset.copyValue;
      const statusEl = btn.querySelector(".wallet-copy-field__status");
      navigator.clipboard.writeText(value).then(() => {
        statusEl.textContent = "Copied!";
        btn.classList.add("is-copied");
        setTimeout(() => {
          statusEl.textContent = "";
          btn.classList.remove("is-copied");
        }, 1500);
      });
    });
  });

  target.querySelector("[data-disconnect]")?.addEventListener("click", onDisconnect);
}
