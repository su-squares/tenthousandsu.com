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

function isUnsafeIconUrl(url) {
  if (!url || typeof url !== "string") return true;
  const trimmed = url.trim();
  const match = trimmed.match(/^([a-zA-Z][a-zA-Z0-9+.-]*):/);
  if (!match) return false;
  const scheme = match[1].toLowerCase();
  if (scheme === "javascript" || scheme === "vbscript") return true;
  if (scheme === "data") {
    // Allow data image URIs (EIP-6963 icons are commonly data: URLs).
    return !/^data:image\/(png|jpe?g|webp|gif|svg\+xml)(;[^,]*)?,/i.test(trimmed);
  }
  return false;
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
    target.textContent = "";
    const header = document.createElement("div");
    header.className = "wallet-modal__header";
    const title = document.createElement("h2");
    title.textContent = "No wallets found";
    header.appendChild(title);
    const helper = document.createElement("p");
    helper.className = "wallet-helper";
    helper.textContent = "No wallet connectors are available in this browser.";
    target.appendChild(header);
    target.appendChild(helper);
    return;
  }

  const baseurl = window.SITE_BASEURL || '';
  target.textContent = "";

  const logo = document.createElement("div");
  logo.className = "wallet-modal__logo";
  const logoImg = document.createElement("img");
  logoImg.src = `${window.location.origin}${baseurl}/assets/images/logo-su-squares.png`;
  logoImg.alt = "Su Squares";
  logo.appendChild(logoImg);

  const header = document.createElement("div");
  header.className = "wallet-modal__header";
  const title = document.createElement("h2");
  title.id = "wallet-connect-title";
  title.textContent = "Connect your wallet";
  header.appendChild(title);

  const list = document.createElement("div");
  list.className = "wallet-list";
  list.setAttribute("aria-labelledby", "wallet-connect-title");
  connectors.forEach((connector) => {
    const icon = connectorIcon(connector);
    const label = connectorName(connector);
    const uid = connectorUid(connector);
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.connectorUid = uid;

    if (icon && !isUnsafeIconUrl(icon)) {
      const iconImg = document.createElement("img");
      iconImg.src = icon;
      iconImg.alt = "";
      iconImg.className = "wallet-btn-icon";
      button.appendChild(iconImg);
    } else {
      const placeholder = document.createElement("span");
      placeholder.className = "wallet-btn-icon-placeholder";
      button.appendChild(placeholder);
    }

    const labelSpan = document.createElement("span");
    labelSpan.textContent = label;
    button.appendChild(labelSpan);

    list.appendChild(button);
  });

  const helper = document.createElement("div");
  helper.className = "wallet-helper";
  const helperText = document.createElement("p");
  helperText.id = "wallet-connect-helper";
  helperText.textContent = "Use a browser wallet or WalletConnect on mobile.";
  const infoButton = document.createElement("button");
  infoButton.type = "button";
  infoButton.className = "wallet-helper-link";
  infoButton.dataset.infoModal = "";
  infoButton.setAttribute("aria-controls", "wallet-info-modal");
  infoButton.textContent = "Don't have a wallet yet?";
  helper.appendChild(helperText);
  helper.appendChild(infoButton);

  target.appendChild(logo);
  target.appendChild(header);
  target.appendChild(list);
  target.appendChild(helper);

  target.querySelectorAll("[data-connector-uid]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const uid = btn.dataset.connectorUid;
      const targetConnector = connectors.find((c) => connectorUid(c) === uid);
      if (targetConnector) onSelect(targetConnector);
    });

    btn.addEventListener("keydown", (event) => {
      if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
      event.preventDefault();
      const buttons = Array.from(target.querySelectorAll("[data-connector-uid]"));
      const currentIndex = buttons.indexOf(btn);
      if (currentIndex === -1) return;
      const nextIndex = event.key === "ArrowDown"
        ? (currentIndex + 1) % buttons.length
        : (currentIndex - 1 + buttons.length) % buttons.length;
      const nextBtn = buttons[nextIndex];
      if (nextBtn) nextBtn.focus();
    });
  });

  target.querySelector("[data-info-modal]")?.addEventListener("click", () => {
    onOpenInfo();
  });
}
