import { hasWalletConnectSession, openWalletFromStore } from "../foundation.js";

const DEFAULT_PRICING = {
  mintPriceEth: 0.5,
  personalizePriceEth: 0.001,
  personalizeFreeCount: 3,
};

function normalizePricing(pricing) {
  const safe = pricing && typeof pricing === "object" ? pricing : {};
  const asNumber = (value, fallback) => {
    const num = typeof value === "string" ? Number.parseFloat(value) : value;
    return Number.isFinite(num) ? num : fallback;
  };
  return {
    mintPriceEth: asNumber(safe.mintPriceEth, DEFAULT_PRICING.mintPriceEth),
    personalizePriceEth: asNumber(safe.personalizePriceEth, DEFAULT_PRICING.personalizePriceEth),
    personalizeFreeCount: Number.isFinite(safe.personalizeFreeCount)
      ? safe.personalizeFreeCount
      : DEFAULT_PRICING.personalizeFreeCount,
  };
}

function formatHash(hash) {
  if (!hash || typeof hash !== "string" || hash.length < 12) return hash || "";
  return `${hash.slice(0, 8)}...${hash.slice(-6)}`;
}

function buildBarState(status) {
  if (status === "pending") return "processing";
  return status;
}

function renderTxView(target, state, actions, options = {}) {
  if (!target) return;
  const showBar = state.status !== "idle";
  const barState = buildBarState(state.status);
  const barLabel =
    state.status === "success"
      ? "Success!"
      : state.status === "error"
      ? "Error!"
      : state.status === "pending"
      ? "Pending..."
      : "Processing...";

  const walletButtonVisible = state.showWalletButton && state.status !== "idle" && state.status !== "success";
  const cancelButtonVisible = state.status !== "idle";

  const pendingList = state.pending || [];
  const confirmedList = state.confirmed || [];

  target.innerHTML = `
    <div class="su-tx-card ${options.variant === "modal" ? "su-tx-card--modal" : "su-tx-card--fixture"}">
      <div class="su-tx-card__header">
        <h3 class="su-tx-card__title">${state.title || "Transaction status"}</h3>
        ${
          options.showClose
            ? '<button type="button" class="su-tx-btn su-tx-btn--ghost" data-tx-close>Close</button>'
            : ""
        }
      </div>

      ${
        state.status === "idle"
          ? `
        <div class="su-tx-card__section su-tx-price">
          <div class="su-tx-price__item">
            <span class="su-tx-price__label">Mint price:</span>
            <span>${state.pricing.mintPriceEth} ETH per mint</span>
          </div>
          <div class="su-tx-price__item">
            <span class="su-tx-price__label">Personalize:</span>
            <span>First ${state.pricing.personalizeFreeCount} free, then ${state.pricing.personalizePriceEth} ETH each</span>
          </div>
        </div>
      `
          : ""
      }

      ${
        showBar
          ? `
        <div class="su-tx-card__section su-tx-card__section--status">
          <div class="su-tx-bar su-tx-bar--${barState}">
            <span>${barLabel}</span>
          </div>
          ${state.message ? `<div class="su-tx-message">${state.message}</div>` : ""}
        </div>
      `
          : ""
      }

      ${
        pendingList.length || confirmedList.length
          ? `
        <div class="su-tx-card__section">
          <div class="su-tx-card__note">Transactions</div>
          <ul class="su-tx-list">
            ${pendingList
              .map(
                (tx) => `
              <li class="su-tx-list__item">
                <span class="su-tx-list__badge su-tx-list__badge--pending">Pending</span>
                ${tx.url ? `<a href="${tx.url}" target="_blank" rel="noreferrer">${formatHash(tx.hash)}</a>` : formatHash(tx.hash)}
              </li>`
              )
              .join("")}
            ${confirmedList
              .map(
                (tx) => `
              <li class="su-tx-list__item">
                <span class="su-tx-list__badge su-tx-list__badge--success">Confirmed</span>
                ${tx.url ? `<a href="${tx.url}" target="_blank" rel="noreferrer">${formatHash(tx.hash)}</a>` : formatHash(tx.hash)}
              </li>`
              )
              .join("")}
          </ul>
        </div>
      `
          : ""
      }

      <div class="su-tx-actions">
        ${
          walletButtonVisible
            ? '<button type="button" class="su-tx-btn" data-tx-open-wallet>Open mobile wallet</button>'
            : ""
        }
        ${
          cancelButtonVisible
            ? '<button type="button" class="su-tx-btn su-tx-btn--ghost" data-tx-cancel>Cancel (clear UI only; cancel in wallet manually)</button>'
            : ""
        }
      </div>

      ${
        state.helpText
          ? `<p class="su-tx-help">${state.helpText}</p>`
          : '<p class="su-tx-help">Need to retry? You can restart the transaction or clear this panel.</p>'
      }
    </div>
  `;

  const closeBtn = target.querySelector("[data-tx-close]");
  if (closeBtn) {
    closeBtn.addEventListener("click", (event) => {
      event.preventDefault();
      actions.onClose?.();
    });
  }

  const walletBtn = target.querySelector("[data-tx-open-wallet]");
  if (walletBtn) {
    walletBtn.addEventListener("click", (event) => {
      event.preventDefault();
      actions.onOpenWallet?.();
    });
  }

  const cancelBtn = target.querySelector("[data-tx-cancel]");
  if (cancelBtn) {
    cancelBtn.addEventListener("click", (event) => {
      event.preventDefault();
      actions.onCancel?.();
    });
  }
}

function createBaseController(target, options = {}) {
  const state = {
    status: "idle",
    title: options.title || "Transaction status",
    message: options.message || "",
    helpText: "",
    pending: [],
    confirmed: [],
    pricing: normalizePricing(options.pricing),
    showWalletButton: false,
  };

  let hasWcSession = hasWalletConnectSession();
  let isWcConnector = false;

  const refreshWalletState = () => {
    state.showWalletButton = Boolean(hasWcSession || isWcConnector);
  };

  const render = () =>
    renderTxView(
      target,
      state,
      {
        onCancel: () => controller.reset(),
        onOpenWallet: () => {
          const opened = openWalletFromStore();
          if (!opened) {
            window.alert("No WalletConnect session found yet. Tap Connect Wallet first.");
          }
        },
        onClose: () => controller.hide?.(),
      },
      options
    );

  const controller = {
    setWalletContext({ hasSession, isWalletConnect }) {
      if (typeof hasSession === "boolean") hasWcSession = hasSession;
      if (typeof isWalletConnect === "boolean") isWcConnector = isWalletConnect;
      refreshWalletState();
      render();
    },
    setPricing(pricing) {
      state.pricing = normalizePricing(pricing);
      render();
    },
    setTitle(title) {
      state.title = title || "Transaction status";
      render();
    },
    setMessage(message) {
      state.message = message || "";
      render();
    },
    setHelp(helpText) {
      state.helpText = helpText || "";
      render();
    },
    startProcessing(message) {
      state.status = "processing";
      state.message = message || "Check your wallet to continue.";
      refreshWalletState();
      render();
    },
    addPending(hash, url) {
      state.status = "pending";
      if (hash) {
        const exists = state.pending.some((tx) => tx.hash === hash);
        if (!exists) state.pending.push({ hash, url });
      }
      refreshWalletState();
      render();
    },
    markSuccess(hash, url, message) {
      state.status = "success";
      state.message = message || "Transaction confirmed.";
      state.pending = state.pending.filter((tx) => tx.hash !== hash);
      if (hash) {
        const exists = state.confirmed.some((tx) => tx.hash === hash);
        if (!exists) state.confirmed.push({ hash, url });
      }
      refreshWalletState();
      render();
    },
    markError(message, hash, url) {
      state.status = "error";
      state.message = message || "There was an issue with your transaction.";
      if (hash) {
        const existsPending = state.pending.some((tx) => tx.hash === hash);
        if (!existsPending) state.pending.push({ hash, url });
      }
      refreshWalletState();
      render();
    },
    reset(message) {
      state.status = "idle";
      state.message = message || "";
      state.helpText = "";
      state.pending = [];
      state.confirmed = [];
      refreshWalletState();
      render();
    },
    getState() {
      return { ...state };
    },
  };

  window.addEventListener("su-wc-session-change", (event) => {
    const hasSession = Boolean(event?.detail?.hasSession);
    controller.setWalletContext({ hasSession });
  });

  refreshWalletState();
  render();
  return controller;
}

export function createTxFixture(options = {}) {
  const target = options.target || document.createElement("div");
  return createBaseController(target, { ...options, variant: "fixture" });
}

export function createTxModal(options = {}) {
  const overlay = document.createElement("div");
  overlay.className = "su-tx-overlay";
  overlay.setAttribute("aria-hidden", "true");
  const target = document.createElement("div");
  overlay.appendChild(target);
  document.body.appendChild(overlay);

  const controller = createBaseController(target, { ...options, variant: "modal", showClose: true });

  controller.show = () => {
    overlay.classList.add("is-visible");
    overlay.setAttribute("aria-hidden", "false");
  };
  controller.hide = () => {
    overlay.classList.remove("is-visible");
    overlay.setAttribute("aria-hidden", "true");
    controller.reset();
  };

  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) {
      controller.hide();
    }
  });

  return controller;
}
