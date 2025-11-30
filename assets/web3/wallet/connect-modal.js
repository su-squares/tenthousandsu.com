import { loadWagmiClient } from "./wagmi-client.js";
import { attemptNetworkSwitch } from "./network.js";
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

/** WalletConnect icon path */
const WALLETCONNECT_ICON = "/assets/images/walletconnect.png";

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

/**
 * Get icon for a connector
 * @param {Object} connector
 * @returns {string|null}
 */
function connectorIcon(connector) {
  // EIP-6963 metadata takes priority
  if (connector._eip6963?.icon) {
    return connector._eip6963.icon;
  }
  // WalletConnect gets its own icon
  if (connector.id === "walletConnect") {
    return `${window.location.origin}${WALLETCONNECT_ICON}`;
  }
  // Fallback to connector's own icon property
  if (connector?.icon && typeof connector.icon === "string") {
    return connector.icon;
  }
  return null;
}

/**
 * Get display name for a connector
 * @param {Object} connector
 * @returns {string}
 */
function connectorName(connector) {
  // EIP-6963 name
  if (connector._eip6963?.name) {
    return connector._eip6963.name;
  }
  // Standard name
  if (connector.name) {
    return connector.name;
  }
  // Fallback
  if (connector.id === "walletConnect") {
    return "WalletConnect";
  }
  return "Wallet";
}

/**
 * Get unique ID for connector (for deduplication and data attributes)
 * @param {Object} connector
 * @returns {string}
 */
function connectorUid(connector) {
  if (connector._eip6963?.uuid) {
    return connector._eip6963.uuid;
  }
  return connector.id;
}

function renderList(connectors, onSelect, onClose) {
  const items = connectors
    .map((connector) => {
      const icon = connectorIcon(connector);
      const label = connectorName(connector);
      const uid = connectorUid(connector);
      return `
        <button type="button" data-connector-uid="${uid}">
          ${icon ? `<img src="${icon}" alt="" class="wallet-btn-icon">` : '<span class="wallet-btn-icon-placeholder"></span>'}
          <span>${label}</span>
        </button>
      `;
    })
    .join("");

  contentEl.innerHTML = `
    <div class="wallet-modal__logo">
      <img src="${window.location.origin}/assets/images/logo-su-squares.png" alt="Su Squares">
    </div>
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

  contentEl.querySelectorAll("[data-connector-uid]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const uid = btn.dataset.connectorUid;
      const target = connectors.find((c) => connectorUid(c) === uid);
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
      <div class="wallet-qr__container">
        <div class="wallet-qr__placeholder" id="wallet-qr-placeholder">
          <span class="wallet-qr__loading-text">Generating QR...</span>
        </div>
        <canvas
          id="wallet-qr-canvas"
          width="220"
          height="220"
          aria-label="Wallet QR"
          style="display: none;"
        ></canvas>
        <img
          src="${window.location.origin}/assets/images/logo-su-squares.png"
          alt="Su Squares"
          class="wallet-qr__logo"
        />
      </div>
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
  const placeholder = contentEl.querySelector("#wallet-qr-placeholder");

  if (canvas && STATE.qrUri) {
    renderQrCanvas(canvas, STATE.qrUri)
      .then(() => {
        if (placeholder) placeholder.style.display = "none";
        canvas.style.display = "block";
        canvas.classList.add("wallet-fade");
      })
      .catch((error) => {
        console.error("QR render failed", error);
        if (placeholder) {
          placeholder.innerHTML = '<span class="wallet-qr__loading-text">QR generation failed</span>';
        }
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
  let networkSwitchPromise = null;
  const autoSwitchIfUnsupported = () => {
    if (networkSwitchPromise) return networkSwitchPromise;
    networkSwitchPromise = attemptNetworkSwitch(wagmi).catch(() => false);
    return networkSwitchPromise;
  };

  // Filter injected to only ready connectors; keep WC regardless.
  const filteredConnectors = connectors.filter((connector) => {
    if (connector.id === "walletConnect") return true;
    // EIP-6963 connectors are always ready (provider already exists)
    if (connector._eip6963) return true;
    // For legacy injected, require ready() if present.
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
    if (account.isConnected) {
      autoSwitchIfUnsupported()
        .catch(() => false)
        .finally(() => complete(wagmi.getAccount()));
    }
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
        await autoSwitchIfUnsupported();
        complete(wagmi.getAccount());
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