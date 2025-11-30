import { loadWagmiClient } from "./wagmi-client.js";
import { renderQr as renderQrCanvas } from "./qr.js";
import { rememberUri, rememberTopic, openWalletDeepLink } from "./wc-store.js";

let overlayEl = null;
let modalEl = null;
let contentEl = null;
let closeHandler = null;
let connectorsRef = [];
let onSelectRef = () => {};
let onCloseRef = () => {};

const MOBILE_QUERY = "(max-width: 730px)";

const STATE = {
  view: "list",
  qrUri: "",
  copied: false,
  connectingName: "",
  errorMessage: "",
};

const DEBUG = Boolean(window?.suWeb3?.debug);
const log = (...args) => {
  if (DEBUG) console.debug("[wallet]", ...args);
};

function isMobile() {
  return window.matchMedia && window.matchMedia(MOBILE_QUERY).matches;
}

function ensureElements() {
  if (overlayEl) return;
  overlayEl = document.createElement("div");
  overlayEl.className = "wallet-overlay";
  overlayEl.setAttribute("role", "dialog");
  overlayEl.setAttribute("aria-modal", "true");
  overlayEl.addEventListener("click", (event) => {
    if (event.target === overlayEl) {
      closeConnectModal();
    }
  });

  modalEl = document.createElement("div");
  modalEl.className = "wallet-modal";
  contentEl = document.createElement("div");

  modalEl.appendChild(contentEl);
  overlayEl.appendChild(modalEl);
  document.body.appendChild(overlayEl);
}

function showOverlay() {
  ensureElements();
  overlayEl.classList.add("is-visible");
}

export function closeConnectModal() {
  if (!overlayEl) return;
  overlayEl.classList.remove("is-visible");
  STATE.view = "list";
  STATE.qrUri = "";
  STATE.copied = false;
  STATE.connectingName = "";
  STATE.errorMessage = "";
  if (closeHandler) closeHandler();
}

function setView(view) {
  log("setView", view);
  STATE.view = view;
  render();
}

function setQr(uri) {
  log("setQr", uri);
  STATE.qrUri = uri;
  render();
}

function setCopied(flag) {
  STATE.copied = flag;
  render();
  if (flag) {
    setTimeout(() => {
      STATE.copied = false;
      render();
    }, 1600);
  }
}

function setError(message) {
  log("error", message);
  STATE.errorMessage = message;
  setView("error");
}

function connectorIcon(connector) {
  if (connector?.icon && typeof connector.icon === "string") return connector.icon;
  if (connector?.id === "walletConnect") {
    return `${window.location.origin}/assets/images/ethereum_logo.png`;
  }
  return null;
}

function renderList(connectors, onSelect, onClose) {
  const items = connectors
    .map((connector) => {
      const icon = connectorIcon(connector);
      const label = connector.name || (connector.id === "walletConnect" ? "WalletConnect" : "Wallet");
      return `
        <button type="button" data-connector-id="${connector.id}">
          <span>${label}</span>
          ${icon ? `<img src="${icon}" alt="${label}">` : ""}
        </button>
      `;
    })
    .join("");

  contentEl.innerHTML = `
    <div class="wallet-modal__header">
      <h2 id="wallet-connect-title">Connect your wallet</h2>
      <button class="wallet-close" type="button" aria-label="Close" data-close>&#10005;</button>
    </div>
    <div class="wallet-list" aria-labelledby="wallet-connect-title">
      ${items}
    </div>
    <div class="wallet-helper">
      <p>Use a browser wallet or WalletConnect on mobile.</p>
    </div>
  `;

  contentEl.querySelectorAll("[data-connector-id]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const target = connectors.find((c) => c.id === btn.dataset.connectorId);
      if (target) onSelect(target);
    });
  });
  const closeBtn = contentEl.querySelector("[data-close]");
  closeBtn?.addEventListener("click", onClose);
}

function renderConnecting(hasUri, onCancel, onOpenWallet) {
  contentEl.innerHTML = `
    <div class="wallet-modal__header">
      <h2>Connecting</h2>
      <button class="wallet-close" type="button" aria-label="Close" data-close>&#10005;</button>
    </div>
    <p class="wallet-helper">Check your wallet to approve the request.</p>
    <div class="wallet-actions">
      <button class="wallet-btn wallet-btn--ghost" type="button" data-cancel>Cancel</button>
      ${
        hasUri
          ? `<button class="wallet-btn" type="button" data-open-wallet>Open wallet app</button>`
          : ""
      }
    </div>
  `;
  contentEl.querySelector("[data-cancel]")?.addEventListener("click", onCancel);
  contentEl.querySelector("[data-close]")?.addEventListener("click", onCancel);
  contentEl.querySelector("[data-open-wallet]")?.addEventListener("click", onOpenWallet);
}

function renderQrView(onBack, onCopy, onOpenWallet) {
  contentEl.innerHTML = `
    <div class="wallet-modal__header">
      <h2>Scan with wallet</h2>
      <button class="wallet-close" type="button" aria-label="Close" data-close>&#10005;</button>
    </div>
    <div class="wallet-qr">
      <div><canvas id="wallet-qr-canvas" width="220" height="220" aria-label="Wallet QR"></canvas></div>
      <div class="wallet-actions">
        <button class="wallet-btn wallet-btn--ghost" type="button" data-back>Back</button>
        <button class="wallet-btn" type="button" data-copy>${STATE.copied ? "Copied!" : "Copy link"}</button>
        <button class="wallet-btn" type="button" data-open-wallet>Open wallet</button>
      </div>
    </div>
  `;
  contentEl.querySelector("[data-back]")?.addEventListener("click", onBack);
  contentEl.querySelector("[data-close]")?.addEventListener("click", closeConnectModal);
  contentEl.querySelector("[data-copy]")?.addEventListener("click", onCopy);
  contentEl.querySelector("[data-open-wallet]")?.addEventListener("click", onOpenWallet);

  const canvas = contentEl.querySelector("#wallet-qr-canvas");
  if (canvas && STATE.qrUri) {
    renderQrCanvas(canvas, STATE.qrUri).catch((error) => {
      console.error("QR render failed", error);
    });
  }
}

function renderError(onBack) {
  contentEl.innerHTML = `
    <div class="wallet-modal__header">
      <h2>Error</h2>
      <button class="wallet-close" type="button" aria-label="Close" data-close>&#10005;</button>
    </div>
    <p class="wallet-helper">${STATE.errorMessage || "Something went wrong."}</p>
    <div class="wallet-actions">
      <button class="wallet-btn" type="button" data-back>Try again</button>
    </div>
  `;
  contentEl.querySelector("[data-back]")?.addEventListener("click", onBack);
  contentEl.querySelector("[data-close]")?.addEventListener("click", closeConnectModal);
}

function renderCanceled(onBack) {
  contentEl.innerHTML = `
    <div class="wallet-modal__header">
      <h2>Request canceled</h2>
      <button class="wallet-close" type="button" aria-label="Close" data-close>&#10005;</button>
    </div>
    <p class="wallet-helper">You denied the connection request.</p>
    <div class="wallet-actions">
      <button class="wallet-btn" type="button" data-back>Back</button>
    </div>
  `;
  contentEl.querySelector("[data-back]")?.addEventListener("click", onBack);
  contentEl.querySelector("[data-close]")?.addEventListener("click", closeConnectModal);
}

function render(connectors = [], onSelect = () => {}, onClose = () => {}) {
  connectorsRef = connectors.length ? connectors : connectorsRef;
  onSelectRef = onSelect || onSelectRef;
  onCloseRef = onClose || onCloseRef;
  if (!contentEl) return;
  if (!connectorsRef || connectorsRef.length === 0) {
    contentEl.innerHTML = `
      <div class="wallet-modal__header">
        <h2>No wallets found</h2>
        <button class="wallet-close" type="button" aria-label="Close" data-close>&#10005;</button>
      </div>
      <p class="wallet-helper">No wallet connectors are available in this browser.</p>
    `;
    contentEl.querySelector("[data-close]")?.addEventListener("click", closeConnectModal);
    return;
  }
  switch (STATE.view) {
    case "qr":
      renderQrView(
        () => setView("list"),
        () => {
          if (STATE.qrUri) {
            navigator.clipboard.writeText(STATE.qrUri).then(() => setCopied(true));
          }
        },
        () => openWalletDeepLink(STATE.qrUri)
      );
      break;
    case "connecting":
      renderConnecting(Boolean(STATE.qrUri), () => {
        setView("list");
        onCloseRef();
      }, () => openWalletDeepLink(STATE.qrUri));
      break;
    case "error":
      renderError(() => setView("list"));
      break;
    case "canceled":
      renderCanceled(() => setView("list"));
      break;
    case "list":
    default:
      renderList(connectorsRef, onSelectRef, onCloseRef);
      break;
  }
}

/**
 * Open the connect modal and attempt to connect using wagmi connectors.
 * Resolves when connected or the modal is closed.
 * @returns {Promise<import("@wagmi/core").GetAccountResult | null>}
 */
export async function openConnectModal() {
  log("openConnectModal");
  const wagmi = await loadWagmiClient();
  const { connectors, connect, watchAccount } = wagmi;
  // Filter injected to only ready connectors; keep WC regardless.
  const filteredConnectors = connectors.filter((connector) => {
    if (connector.id === "walletConnect") return true;
    // For injected, require ready() if present.
    if (typeof connector.ready === "boolean") return connector.ready;
    if (typeof connector.ready === "function") {
      try {
        return connector.ready();
      } catch (_e) {
        return false;
      }
    }
    return true;
  });
  showOverlay();

  let done = false;
  const complete = (result) => {
    if (done) return;
    done = true;
    log("complete", result);
    closeConnectModal();
    cleanup();
    resolver(result);
  };

  const onAccount = watchAccount((account) => {
    if (account.isConnected) complete(account);
  });

  const cleanup = () => {
    try {
      onAccount?.();
    } catch (_error) {
      /* noop */
    }
  };

  closeHandler = () => complete(null);

  const handleConnector = async (connector) => {
    let removeDisplayListener = null;
    try {
      if (connector.id === "walletConnect") {
        const provider = await connector.getProvider();
        if (provider && typeof provider.on === "function") {
          const displayHandler = (uri) => {
            log("display_uri", uri);
            const stored = rememberUri(uri);
            setQr(stored.uri);
            rememberTopic(stored.topic);
            if (isMobile()) {
              openWalletDeepLink(stored.uri);
              setView("connecting");
            } else {
              setView("qr");
            }
          };
          provider.on("display_uri", displayHandler);
          removeDisplayListener = () => {
            if (typeof provider.removeListener === "function") {
              provider.removeListener("display_uri", displayHandler);
            } else if (typeof provider.off === "function") {
              provider.off("display_uri", displayHandler);
            }
          };
        }
      }

      setView("connecting");
      await connect({ connector });
      const account = wagmi.getAccount();
      if (account?.isConnected) {
        complete(account);
      } else {
        complete(null);
      }
    } catch (error) {
      log("connect error", error);
      const message = typeof error?.message === "string" ? error.message : "";
      if (message.includes("User rejected") || message.includes("User denied")) {
        setView("canceled");
      } else {
        setError(message || "Connection failed");
      }
    } finally {
      removeDisplayListener?.();
      STATE.qrUri = "";
      STATE.copied = false;
    }
  };

  render(filteredConnectors, handleConnector, closeConnectModal);

  let resolver;
  const waitForResult = new Promise((resolve) => {
    resolver = resolve;
  });
  return waitForResult.finally(cleanup);
}
