import { hasWalletConnectSession, openWalletFromStore } from "../foundation.js";
import {
  getRefreshButtonHTML,
  ensureRefreshButtonStyles,
  attachRefreshHandler,
} from "../wallet/balance-refresh-button.js";
import {
  initActiveWalletContext,
  getBalanceContextForComponent,
  WALLET_CONTEXT_CHANGE_EVENT,
} from "../wallet/active-wallet-context.js";

const DEFAULT_PRICING = {
  mintPriceEth: 0.5,
  personalizePriceEth: 0.001,
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
  };
}

function formatHash(hash) {
  if (!hash || typeof hash !== "string" || hash.length < 12) return hash || "";
  return `${hash.slice(0, 8)}...${hash.slice(-6)}`;
}

/**
 * Format balance for display.
 * - Under 1 ETH → 5 decimals
 * - 1-999 ETH → 4 decimals
 * - 1000+ ETH → 2 decimals
 * - Commas for thousands, drop trailing zeros, truncate (don't round)
 * @param {string} formatted - The raw formatted balance string
 * @returns {string}
 */
function formatBalance(formatted) {
  if (!formatted || typeof formatted !== "string") return "—";

  const num = Number.parseFloat(formatted);
  if (!Number.isFinite(num)) return formatted;

  // Dust check
  if (num > 0 && num < 0.00001) return "<0.00001";

  // Determine decimal places based on size
  let decimals;
  if (num < 1) {
    decimals = 5;
  } else if (num < 1000) {
    decimals = 4;
  } else {
    decimals = 2;
  }

  // Truncate (not round) by using floor on scaled value
  const scale = Math.pow(10, decimals);
  const truncated = Math.floor(num * scale) / scale;

  // Format with commas and remove trailing zeros
  const parts = truncated.toFixed(decimals).split(".");
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");

  // Drop trailing zeros from decimal part
  if (parts[1]) {
    parts[1] = parts[1].replace(/0+$/, "");
    if (parts[1] === "") {
      return parts[0];
    }
  }

  return parts.join(".");
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
        ${options.showClose
      ? '<button type="button" class="su-tx-btn su-tx-btn--ghost" data-tx-close>Close</button>'
      : ""
    }
      </div>

      ${state.status === "idle" && (state.mode === "mint" || state.mode === "both")
      ? `
        <div class="su-tx-card__section su-tx-price">
          <div class="su-tx-price__item">
            <span class="su-tx-price__label">Mint price:</span>
            <span>${state.pricing.mintPriceEth} ETH per mint</span>
          </div>
        </div>
      `
      : ""
    }

      ${state.status === "idle" && (state.mode === "personalize" || state.mode === "both")
      ? `
        <div class="su-tx-card__section su-tx-price">
          <div class="su-tx-price__item">
            <span class="su-tx-price__label">Personalize:</span>
            <span>${state.pricing.personalizePriceEth} ETH each</span>
          </div>
        </div>
      `
      : ""
    }

      ${state.status === "idle" && state.mode === "unpersonalize"
      ? `
        <div class="su-tx-card__section su-tx-price">
          <div class="su-tx-price__item">
            <span class="su-tx-price__label">Unpersonalize:</span>
            <span>${state.pricing.personalizePriceEth} ETH</span>
          </div>
        </div>
      `
      : ""
    }

      ${["idle", "processing", "pending"].includes(state.status) && state.showBalance && (state.balanceContext || state.balance !== undefined)
      ? `
        <div class="su-tx-card__section su-tx-balance">
          <div class="su-tx-balance__item">
            <span class="su-tx-balance__label">Your balance:</span>
            <span class="su-tx-balance__value">${state.balanceLoading
        ? "Loading..."
        : state.balance
          ? `${formatBalance(state.balance.formatted)} ${state.balance.symbol || "ETH"}`
          : "—"
      }</span>
            ${getRefreshButtonHTML({ loading: state.balanceLoading })}
          </div>
        </div>
      `
      : ""
    }

      ${showBar
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

      ${pendingList.length || confirmedList.length
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
        ${walletButtonVisible
      ? '<button type="button" class="su-tx-btn" data-tx-open-wallet>Open mobile wallet</button>'
      : ""
    }
        ${cancelButtonVisible
      ? '<button type="button" class="su-tx-btn su-tx-btn--ghost" data-tx-cancel>Cancel (clear UI only; cancel in wallet manually)</button>'
      : ""
    }
      </div>

      ${state.status !== "idle"
      ? `<p class="su-tx-help">${state.helpText || "Need to retry? You can restart the transaction or clear this panel."}</p>`
      : ""
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

  // Attach balance refresh handler
  if (actions.onRefreshBalance) {
    attachRefreshHandler(target, actions.onRefreshBalance);
  }
}

function createBaseController(target, options = {}) {
  // Ensure refresh button styles are injected
  ensureRefreshButtonStyles();

  const state = {
    status: "idle",
    title: options.title || "Transaction status",
    message: options.message || "",
    helpText: "",
    pending: [],
    confirmed: [],
    pricing: normalizePricing(options.pricing),
    mode: options.mode || "both", // "mint", "personalize", or "both"
    showWalletButton: false,
    // Balance state
    showBalance: options.showBalance ?? true,
    balance: null,
    balanceLoading: false,
    balanceContext: null, // { address, chainId, fetcher }
  };

  let hasWcSession = hasWalletConnectSession();
  let isWcConnector = false;
  let balanceUnsubscribe = null;

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
        onRefreshBalance: state.balanceContext ? async () => {
          const { address, chainId, fetcher } = state.balanceContext;
          if (!address || !chainId || !fetcher) return;
          const { refreshBalance } = await import("../wallet/balance-store.js");
          await refreshBalance(address, chainId, fetcher);
        } : null,
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
    /**
     * Set balance context for fetching and displaying balance.
     * @param {{ address: string, chainId: number, fetcher: Function }} context
     */
    async setBalanceContext(context) {
      const { address, chainId, fetcher } = context || {};
      if (!address || !chainId || !fetcher) {
        state.showBalance = false;
        state.balanceContext = null;
        render();
        return;
      }

      state.balanceContext = { address, chainId, fetcher };
      state.showBalance = true;
      state.balanceLoading = true;
      render();

      try {
        const { getBalance, getCachedBalance, subscribeBalance } = await import("../wallet/balance-store.js");

        // Check for cached balance first
        const cached = getCachedBalance(address, chainId);
        if (cached) {
          state.balance = cached;
          state.balanceLoading = false;
          render();
        }

        // Subscribe to balance updates
        if (balanceUnsubscribe) balanceUnsubscribe();
        balanceUnsubscribe = subscribeBalance((payload) => {
          if (payload.address?.toLowerCase() === address.toLowerCase()) {
            state.balance = payload.balance;
            state.balanceLoading = false;
            render();
          }
        });

        // Fetch fresh balance
        const result = await getBalance({ address, chainId, fetcher });
        state.balance = result?.balance || null;
        state.balanceLoading = false;
        render();
      } catch (error) {
        console.warn("TX fixture: Balance fetch failed", error);
        state.balanceLoading = false;
        render();
      }
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
    async markSuccess(hash, url, message) {
      state.status = "success";
      state.message = message || "Transaction confirmed.";
      state.pending = state.pending.filter((tx) => tx.hash !== hash);
      if (hash) {
        const exists = state.confirmed.some((tx) => tx.hash === hash);
        if (!exists) state.confirmed.push({ hash, url });
      }
      refreshWalletState();
      render();

      // Invalidate balance cache after successful transaction
      if (state.balanceContext) {
        try {
          const { invalidateBalance, refreshBalance } = await import("../wallet/balance-store.js");
          const { address, chainId, fetcher } = state.balanceContext;
          invalidateBalance(address, chainId);
          // Fetch fresh balance
          if (fetcher) {
            state.balanceLoading = true;
            render();
            await refreshBalance(address, chainId, fetcher);
          }
        } catch (error) {
          console.warn("TX fixture: Balance invalidation failed", error);
        }
      }
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
    destroy() {
      if (balanceUnsubscribe) {
        balanceUnsubscribe();
        balanceUnsubscribe = null;
      }
    },
    getState() {
      return { ...state };
    },
  };

  window.addEventListener("su-wc-session-change", (event) => {
    const hasSession = Boolean(event?.detail?.hasSession);
    controller.setWalletContext({ hasSession });
  });

  // Listen for wallet context changes to auto-update balance
  window.addEventListener(WALLET_CONTEXT_CHANGE_EVENT, async (event) => {
    const { isConnected, address } = event?.detail || {};

    if (isConnected && address) {
      // Wallet connected/changed - set balance context
      const balanceContext = await getBalanceContextForComponent();
      if (balanceContext) {
        controller.setBalanceContext(balanceContext);
      }
    } else {
      // Wallet disconnected - clear balance display
      state.balance = null;
      state.balanceContext = null;
      state.balanceLoading = false;
      render();
    }
  });

  // Auto-init balance if wallet is already connected (respects lazy loading)
  initActiveWalletContext().then(async (context) => {
    if (context.isConnected && context.address) {
      const balanceContext = await getBalanceContextForComponent();
      if (balanceContext) {
        controller.setBalanceContext(balanceContext);
      }
    }
  }).catch(() => {
    // Ignore init errors - wallet context is optional
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
