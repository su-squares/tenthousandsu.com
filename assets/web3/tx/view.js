import { getRefreshButtonHTML, attachRefreshHandler } from "../wallet/balance-refresh-button.js";
import { formatBalance, formatHash, buildBarState } from "./formatting.js";
import { normalizeHref } from "../../js/link-utils.js";

function escapeHtml(value) {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttribute(value) {
  return escapeHtml(value);
}

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
  const safeTitle = escapeHtml(state.title || "Transaction status");
  const safeMessage = escapeHtml(state.message || "");
  const safeHelpText = escapeHtml(
    state.helpText || "Need to retry? You can restart the transaction or clear this panel."
  );

  const walletButtonVisible = state.showWalletButton && state.status !== "idle" && state.status !== "success";
  const cancelButtonVisible = state.status !== "idle";

  const pendingList = state.pending || [];
  const confirmedList = state.confirmed || [];
  const txStatus = state.status;

  target.innerHTML = `
    <div class="su-tx-card ${options.variant === "modal" ? "su-tx-card--modal" : "su-tx-card--fixture"}">
      <div class="su-tx-card__header">
        <h3 class="su-tx-card__title">${safeTitle}</h3>
        ${options.showClose
      ? '<button type="button" class="su-tx-btn su-tx-btn--ghost" data-tx-close>Close</button>'
      : ""
    }
      </div>

      ${renderPricing(state)}

      ${renderBalance(state)}

      ${showBar
      ? `
        <div class="su-tx-card__section su-tx-card__section--status" data-testid="tx-status" data-status="${escapeAttribute(state.status)}">
          <div class="su-tx-bar su-tx-bar--${barState}">
            <span>${barLabel}</span>
          </div>
          ${state.message ? `<div class="su-tx-message">${safeMessage}</div>` : ""}
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
      ? `<p class="su-tx-help">${safeHelpText}</p>`
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
    const mintPrice = escapeHtml(state.pricing.mintPriceEth);
    blocks.push(`
      <div class="su-tx-card__section su-tx-price">
        <div class="su-tx-price__item">
          <span class="su-tx-price__label">Mint price:</span>
          <span>${mintPrice} ETH per mint</span>
        </div>
      </div>
    `);
  }

  if (state.mode === "personalize" || state.mode === "both") {
    const personalizePrice = escapeHtml(state.pricing.personalizePriceEth);
    blocks.push(`
      <div class="su-tx-card__section su-tx-price">
        <div class="su-tx-price__item">
          <span class="su-tx-price__label">Personalize:</span>
          <span>${personalizePrice} ETH each</span>
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
    const safeCount = escapeHtml(personalizeCount);
    const safePrice = escapeHtml(personalizePrice);
    const safeTotal = escapeHtml(total);
    blocks.push(`
      <div class="su-tx-card__section su-tx-price">
        <div class="su-tx-price__item">
          <span class="su-tx-price__label">Total:</span>
          <span>${safeCount} * ${safePrice} = ${safeTotal} ETH</span>
        </div>
      </div>
    `);
  }

  if (state.mode === "unpersonalize") {
    const personalizePrice = escapeHtml(state.pricing.personalizePriceEth);
    blocks.push(`
      <div class="su-tx-card__section su-tx-price">
        <div class="su-tx-price__item">
          <span class="su-tx-price__label">Unpersonalize:</span>
          <span>${personalizePrice} ETH</span>
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

  const balanceText = state.balanceLoading
    ? "Loading..."
    : state.balance
      ? `${formatBalance(state.balance.formatted)} ${state.balance.symbol || "ETH"}`
      : "—";
  const safeBalanceText = escapeHtml(balanceText);

  return `
    <div class="su-tx-card__section su-tx-balance">
      <div class="su-tx-balance__item">
        <span class="su-tx-balance__label">Your balance:</span>
        <span class="su-tx-balance__value">${safeBalanceText}</span>
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

  const renderTxLink = (tx) => {
    const label = escapeHtml(formatHash(tx.hash));
    const safeUrl = tx.url ? normalizeHref(tx.url) : "";
    if (!safeUrl) return label;
    return `<a href="${escapeAttribute(safeUrl)}" target="_blank" rel="noreferrer">${label}</a>`;
  };

  return `
    <div class="su-tx-card__section">
      <div class="su-tx-card__note">Transactions</div>
      <ul class="su-tx-list">
        ${pending
      .map(
        (tx) => `
            <li class="su-tx-list__item">
              <span class="su-tx-list__badge ${pendingBadge.className}">${pendingBadge.label}</span>
              ${renderTxLink(tx)}
            </li>`
      )
      .join("")}
        ${confirmed
      .map(
        (tx) => `
            <li class="su-tx-list__item">
              <span class="su-tx-list__badge su-tx-list__badge--success">Confirmed</span>
              ${renderTxLink(tx)}
            </li>`
      )
      .join("")}
      </ul>
    </div>
  `;
}
