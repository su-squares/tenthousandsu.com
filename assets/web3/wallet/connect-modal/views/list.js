import { WALLETCONNECT_ICON } from "../constants.js";

/**
 * @param {import("@wagmi/core").Connector} connector
 * @returns {string|null}
 */
function connectorIcon(connector) {
  if (connector._eip6963?.icon) return connector._eip6963.icon;
  if (connector.id === "walletConnect") return `${window.location.origin}${WALLETCONNECT_ICON}`;
  if (connector?.icon && typeof connector.icon === "string") return connector.icon;
  return null;
}

/**
 * @param {import("@wagmi/core").Connector} connector
 * @returns {string}
 */
function connectorName(connector) {
  if (connector._eip6963?.name) return connector._eip6963.name;
  if (connector.name) return connector.name;
  if (connector.id === "walletConnect") return "WalletConnect";
  return "Wallet";
}

/**
 * @param {import("@wagmi/core").Connector} connector
 * @returns {string}
 */
function connectorUid(connector) {
  if (connector._eip6963?.uuid) return connector._eip6963.uuid;
  return connector.id;
}

/**
 * Render the wallet list view.
 * @param {HTMLElement} target
 * @param {Object} params
 * @param {Array<import("@wagmi/core").Connector>} params.connectors
 * @param {(connector: import("@wagmi/core").Connector) => void} params.onSelect
 * @param {() => void} params.onOpenInfo
 */
export function renderListView(target, { connectors, onSelect, onOpenInfo }) {
  if (!target) return;
  if (!connectors || connectors.length === 0) {
    target.innerHTML = `
      <div class="wallet-modal__header">
        <h2>No wallets found</h2>
      </div>
      <p class="wallet-helper">No wallet connectors are available in this browser.</p>
    `;
    return;
  }

  const items = connectors
    .map((connector) => {
      const icon = connectorIcon(connector);
      const label = connectorName(connector);
      const uid = connectorUid(connector);
      return `
        <button type="button" data-connector-uid="${uid}">
          ${
            icon
              ? `<img src="${icon}" alt="" class="wallet-btn-icon">`
              : '<span class="wallet-btn-icon-placeholder"></span>'
          }
          <span>${label}</span>
        </button>
      `;
    })
    .join("");

  target.innerHTML = `
    <div class="wallet-modal__logo">
      <img src="${window.location.origin}/assets/images/logo-su-squares.png" alt="Su Squares">
    </div>
    <div class="wallet-modal__header">
      <h2 id="wallet-connect-title">Connect your wallet</h2>
    </div>
    <div class="wallet-list" aria-labelledby="wallet-connect-title">
      ${items}
    </div>
    <div class="wallet-helper">
      <p>Use a browser wallet or WalletConnect on mobile.</p>
      <button type="button" class="wallet-helper-link" data-info-modal aria-controls="wallet-info-modal">
        Don't have a wallet yet?
      </button>
    </div>
  `;

  target.querySelectorAll("[data-connector-uid]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const uid = btn.dataset.connectorUid;
      const targetConnector = connectors.find((c) => connectorUid(c) === uid);
      if (targetConnector) onSelect(targetConnector);
    });
  });

  target.querySelector("[data-info-modal]")?.addEventListener("click", () => {
    onOpenInfo();
  });
}
