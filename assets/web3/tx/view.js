import { getRefreshButtonHTML, attachRefreshHandler } from "../wallet/balance-refresh-button.js";
import { formatBalance, formatHash, buildBarState } from "./formatting.js";

/**
 * @typedef {import("./state.js").TxState} TxState
 */

/**
 * @typedef {Object} TxViewHandlers
 * @property {() => void} [onClose]
 * @property {() => void} [onOpenWallet]
 * @property {() => void} [onCancel]
 * @property {() => Promise<void>} [onRefreshBalance]
 */

/**
 * @typedef {Object} TxViewOptions
 * @property {"fixture"|"modal"} [variant]
 * @property {boolean} [showClose]
 */

/**
 * Render the transaction card UI.
 * @param {HTMLElement} target
 * @param {TxState} state
 * @param {TxViewHandlers} handlers
 * @param {TxViewOptions} [options]
 */
export function renderTxView(target, state, handlers, options = {}) {
  if (!target) return;
  const showBar = state.status !== "idle";
  const barState = buildBarState(state.status);
  const barLabel = getBarLabel(state.status);

  const walletButtonVisible = state.showWalletButton && state.status !== "idle" && state.status !== "success";
  const cancelButtonVisible = state.status !== "idle";

  const pendingList = state.pending || [];
  const confirmedList = state.confirmed || [];
  const txStatus = state.status;

  target.innerHTML = `
    <div class="su-tx-card ${options.variant === "modal" ? "su-tx-card--modal" : "su-tx-card--fixture"}">
      <div class="su-tx-card__header">
        <h3 class="su-tx-card__title">${state.title || "Transaction status"}</h3>
        ${options.showClose
      ? '<button type="button" class="su-tx-btn su-tx-btn--ghost" data-tx-close>Close</button>'
      : ""
    }
      </div>

      ${renderPricing(state)}

      ${renderBalance(state)}

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

      ${renderTransactions(pendingList, confirmedList, txStatus)}

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

  attachEvent(target, "[data-tx-close]", handlers.onClose);
  attachEvent(target, "[data-tx-open-wallet]", handlers.onOpenWallet);
  attachEvent(target, "[data-tx-cancel]", handlers.onCancel);

  if (handlers.onRefreshBalance) {
    attachRefreshHandler(target, handlers.onRefreshBalance);
  }
}

/**
 * @param {HTMLElement} target
 * @param {string} selector
 * @param {Function} [handler]
 */
function attachEvent(target, selector, handler) {
  if (!handler) return;
  const btn = target.querySelector(selector);
  if (!btn) return;
  btn.addEventListener("click", (event) => {
    event.preventDefault();
    handler();
  });
}

/**
 * @param {"idle"|"processing"|"pending"|"success"|"error"} status
 * @returns {string}
 */
function getBarLabel(status) {
  switch (status) {
    case "success":
      return "Success!";
    case "error":
      return "Error!";
    case "pending":
      return "Pending...";
    case "processing":
      return "Processing...";
    default:
      return "Processing...";
  }
}

/**
 * @param {TxState} state
 * @returns {string}
 */
function renderPricing(state) {
  if (state.status !== "idle") return "";
  const blocks = [];

  const formatEthAmount = (value) => {
    if (!Number.isFinite(value)) return "0";
    const rounded = Math.round(value * 1e6) / 1e6;
    const fixed = rounded.toFixed(6);
    return fixed.replace(/\.?0+$/, "");
  };

  if (state.mode === "mint" || state.mode === "both") {
    blocks.push(`
      <div class="su-tx-card__section su-tx-price">
        <div class="su-tx-price__item">
          <span class="su-tx-price__label">Mint price:</span>
          <span>${state.pricing.mintPriceEth} ETH per mint</span>
        </div>
      </div>
    `);
  }

  if (state.mode === "personalize" || state.mode === "both") {
    blocks.push(`
      <div class="su-tx-card__section su-tx-price">
        <div class="su-tx-price__item">
          <span class="su-tx-price__label">Personalize:</span>
          <span>${state.pricing.personalizePriceEth} ETH each</span>
        </div>
      </div>
    `);
  }

  if (state.mode === "personalize" && state.showPersonalizeTotal) {
    const personalizeCount = Number.isFinite(state.personalizeCount)
      ? state.personalizeCount
      : 0;
    const personalizePrice = state.pricing.personalizePriceEth;
    const total = formatEthAmount(personalizeCount * personalizePrice);
    blocks.push(`
      <div class="su-tx-card__section su-tx-price">
        <div class="su-tx-price__item">
          <span class="su-tx-price__label">Total:</span>
          <span>${personalizeCount} * ${personalizePrice} = ${total} ETH</span>
        </div>
      </div>
    `);
  }

  if (state.mode === "unpersonalize") {
    blocks.push(`
      <div class="su-tx-card__section su-tx-price">
        <div class="su-tx-price__item">
          <span class="su-tx-price__label">Unpersonalize:</span>
          <span>${state.pricing.personalizePriceEth} ETH</span>
        </div>
      </div>
    `);
  }

  return blocks.join("");
}

/**
 * @param {TxState} state
 * @returns {string}
 */
function renderBalance(state) {
  if (!state.showBalance) return "";
  if (state.status !== "idle" && state.status !== "processing" && state.status !== "pending") return "";
  if (!state.balanceContext) return "";

  return `
    <div class="su-tx-card__section su-tx-balance">
      <div class="su-tx-balance__item">
        <span class="su-tx-balance__label">Your balance:</span>
        <span class="su-tx-balance__value">${state.balanceLoading
    ? "Loading..."
    : state.balance
      ? `${formatBalance(state.balance.formatted)} ${state.balance.symbol || "ETH"}`
      : "â€”"
  }</span>
        ${getRefreshButtonHTML({ loading: state.balanceLoading })}
      </div>
    </div>
  `;
}

/**
 * @param {Array<{hash:string,url?:string}>} pending
 * @param {Array<{hash:string,url?:string}>} confirmed
 * @param {"idle"|"processing"|"pending"|"success"|"error"} status
 * @returns {string}
 */
function renderTransactions(pending, confirmed, status) {
  if (!pending.length && !confirmed.length) return "";

  const pendingBadge = status === "error"
    ? { label: "Failed", className: "su-tx-list__badge--error" }
    : { label: "Pending", className: "su-tx-list__badge--pending" };

  return `
    <div class="su-tx-card__section">
      <div class="su-tx-card__note">Transactions</div>
      <ul class="su-tx-list">
        ${pending
      .map(
        (tx) => `
            <li class="su-tx-list__item">
              <span class="su-tx-list__badge ${pendingBadge.className}">${pendingBadge.label}</span>
              ${tx.url ? `<a href="${tx.url}" target="_blank" rel="noreferrer">${formatHash(tx.hash)}</a>` : formatHash(tx.hash)}
            </li>`
      )
      .join("")}
        ${confirmed
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
  `;
}
