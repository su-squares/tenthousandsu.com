import { getStoredSession, openWalletDeepLink } from "../wc-store.js";
import { truncateAddress } from "../../client/wagmi.js";
import {
  getRefreshButtonHTML,
  ensureRefreshButtonStyles,
  attachRefreshHandler,
} from "../balance-refresh-button.js";

function getChainIcon(activeNetwork, presets) {
  const baseurl = window.SITE_BASEURL || '';
  if (activeNetwork.chainId === presets.mainnet) {
    return {
      src: `${window.location.origin}${baseurl}/assets/images/ethereum_logo.png`,
      alt: "Ethereum logo",
    };
  }
  if (activeNetwork.chainId === presets.sepolia) {
    return {
      src: `${window.location.origin}${baseurl}/assets/images/sepolia-logo.png`,
      alt: "Sepolia logo",
    };
  }
  return {
    src: `${window.location.origin}${baseurl}/assets/images/logomark-su-squares.png`,
    alt: `${activeNetwork.label} logo`,
  };
}

/**
 * Render the normal account view.
 * @param {HTMLElement} target
 * @param {{ account: any, ensName: string|null, balance: any }} data
 * @param {{ activeNetwork: any, presets: { mainnet: number, sepolia: number }, wagmiClient: any, onDisconnect: Function, loadingEns?: boolean, loadingBalance?: boolean }} options
 */
export function renderAccountView(target, data, options) {
  if (!target) return;
  const { account, ensName, balance } = data;
  const {
    activeNetwork,
    presets,
    wagmiClient,
    onDisconnect,
    onRefresh,
    loadingEns = false,
    loadingBalance = false,
  } = options;

  // Ensure refresh button styles are injected
  ensureRefreshButtonStyles();

  const chainIcon = getChainIcon(activeNetwork, presets);
  const ensLoading = loadingEns && !!account?.address && !ensName;
  const balanceLoading = loadingBalance && !!account?.address && !balance;
  const wcSession = getStoredSession();
  const primaryFallback = account?.address ? truncateAddress(account.address) : "Not connected";
  const addressDisplay = ensName || (ensLoading ? "Fetching ENS..." : primaryFallback);

  target.innerHTML = `
    <div class="wallet-modal__header">
      <h2 id="wallet-account-title">Wallet</h2>
    </div>
    <div class="wallet-status wallet-fade" id="wallet-account-status">
      <div class="wallet-status__details">
        <div class="${ensLoading ? "wallet-placeholder" : ""}">${addressDisplay || "Not connected"}</div>
        <div class="wallet-small">${account?.address || ""}</div>
      </div>
      <div class="wallet-status__aside">
        <button class="wallet-btn wallet-btn--ghost wallet-btn--inline" type="button" data-copy>Copy</button>
      </div>
    </div>
    <div class="wallet-status wallet-fade">
      <div class="wallet-status__details wallet-status__details--chain">
        <div class="wallet-chain">
          <div class="wallet-chain__icon">
            <img src="${chainIcon.src}" alt="${chainIcon.alt}" style="height: 24px; width: auto;">
          </div>
          <div>
            <div>${activeNetwork.label}</div>
            <div class="wallet-small">Chain ID: ${activeNetwork.chainId}</div>
          </div>
        </div>
      </div>
      <div class="wallet-status__aside wallet-balance-wrapper">
        ${balanceLoading
      ? `<div class="wallet-balance wallet-placeholder">Fetching balance...</div>`
      : `<div class="wallet-balance">${balance ? `${balance.formatted} ${balance.symbol || "ETH"}` : ""
      }</div>`
    }
        ${onRefresh ? getRefreshButtonHTML({ loading: balanceLoading }) : ""}
      </div>
    </div>
    <div class="wallet-actions" style="margin-top: 1rem;">
      ${wcSession
      ? `<button class="wallet-btn" type="button" data-open-wallet>Open mobile wallet</button>`
      : ""
    }
      <button class="wallet-btn wallet-btn--ghost" type="button" data-disconnect>
        Disconnect
        <svg viewBox="0 0 36 24" fill="none" style="width: 24px; height: 16px; margin-left: 0.5rem; vertical-align: middle;">
          <path
            d="M18 3H5C3.89543 3 3 3.89543 3 5V19C3 20.1046 3.89543 21 5 21H18"
            stroke="var(--color-accent)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <line
            x1="14"
            y1="12"
            x2="28"
            y2="12"
            stroke="var(--color-accent)"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <polygon
            points="28 8, 35 12, 28 16"
            fill="var(--color-accent)"
          />
        </svg>
      </button>
    </div>
  `;

  target.querySelector("[data-copy]")?.addEventListener("click", () => {
    if (account?.address) navigator.clipboard.writeText(account.address);
  });

  target.querySelector("[data-disconnect]")?.addEventListener("click", async () => {
    try {
      await wagmiClient?.disconnect();
    } catch (error) {
      console.warn("Disconnect failed", error);
    }
    onDisconnect?.();
  });

  target.querySelector("[data-open-wallet]")?.addEventListener("click", () => {
    openWalletDeepLink(undefined, { userInitiated: true });
  });

  // Attach refresh button handler if onRefresh is provided
  if (onRefresh) {
    attachRefreshHandler(target, onRefresh);
  }
}
