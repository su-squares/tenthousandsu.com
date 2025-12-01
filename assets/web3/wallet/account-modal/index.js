import { enableSepolia } from "../../config.js";
import {
  MAINNET_CHAIN_ID,
  SEPOLIA_CHAIN_ID,
  loadWagmiClient,
  truncateAddress,
} from "../wagmi-client.js";
import { clearAllWalletStorage } from "../../foundation.js";
import {
  PREFERRED_CHAIN_LABEL,
  attemptNetworkSwitch,
  canSwitchNetwork,
  isAllowedChain,
} from "../network.js";
import { getStoredSession, openWalletDeepLink } from "../wc-store.js";
import { createModalShell } from "../base/modal-shell.js";

let shell = null;
let wagmiClient = null;
let lastDisplayData = null;

const ensureShell = () => {
  if (shell) return shell;
  shell = createModalShell({
    onRequestClose: () => closeAccountModal(),
    onOverlayDismiss: () => closeAccountModal(),
  });
  return shell;
};

const showOverlay = () => {
  const modalShell = ensureShell();
  modalShell.show();
};

export function closeAccountModal() {
  if (!shell) return;
  const wasVisible = shell.overlay.classList.contains("is-visible");
  shell.hide();
  if (wasVisible) {
    document.dispatchEvent(
      new CustomEvent("wallet:modal-closed", { detail: { modal: "account" } })
    );
  }
}

async function fetchDisplayData(wagmi) {
  const account = wagmi.getAccount();
  const network = wagmi.getNetwork();
  const chainId = network?.chain?.id;
  let ensName = null;
  let balance = null;
  if (!account?.address) {
    console.warn("Account modal: no connected address, skipping ENS/balance fetch.");
  }
  try {
    if (account?.address) {
      try {
        if (chainId === MAINNET_CHAIN_ID) {
          ensName = await wagmi.fetchEnsName({
            address: account.address,
            chainId: MAINNET_CHAIN_ID,
          });
          if (!ensName) {
            console.warn("Account modal: ENS lookup returned empty result for address", account.address);
          }
        } else {
          console.warn("Account modal: ENS lookup skipped because chain is not mainnet", chainId);
        }
      } catch (error) {
        console.warn("Account modal: ENS lookup failed", error);
      }
      try {
        balance = await wagmi.fetchBalance({
          address: account.address,
          chainId: chainId || MAINNET_CHAIN_ID,
        });
        if (!balance) {
          console.warn("Account modal: Balance lookup returned empty result", {
            address: account.address,
            chainId: chainId || MAINNET_CHAIN_ID,
          });
        }
      } catch (error) {
        console.warn("Account modal: Balance lookup failed", error);
      }
    }
  } catch (error) {
    console.warn("Failed to fetch ENS or balance", error);
  }
  return { account, network, ensName, balance };
}

function render({ account, network, ensName, balance }, options = {}) {
  const modalShell = ensureShell();
  const target = modalShell.content;
  if (!target) return;

  const { loadingEns = false, loadingBalance = false } = options;
  const chainId = network?.chain?.id;
  const onMainnet = chainId === MAINNET_CHAIN_ID;
  const onSepolia = enableSepolia && chainId === SEPOLIA_CHAIN_ID;
  const chainMismatch = !isAllowedChain(chainId);
  const ethLogo = `${window.location.origin}/assets/images/ethereum_logo.png`;
  const ensLoading = loadingEns && !!account?.address && !ensName;
  const balanceLoading = loadingBalance && !!account?.address && !balance;
  const addressDisplay =
    ensName || (ensLoading ? "Fetching ENS..." : truncateAddress(account?.address || ""));
  const wcSession = getStoredSession();
  const switchable = canSwitchNetwork(wagmiClient);
  const describedById = chainMismatch && !switchable ? "wallet-account-note" : "wallet-account-status";

  modalShell.setAria({ labelledBy: "wallet-account-title", describedBy: describedById });

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
          <div class="wallet-chain__icon ${chainMismatch ? "wallet-chain__icon--mismatch" : ""}">
            <img src="${ethLogo}" alt="Ethereum logo">
            ${chainMismatch ? '<span class="wallet-chain__cross" aria-hidden="true"></span>' : ""}
          </div>
          <div>
            <div>${onMainnet ? "Ethereum Mainnet" : onSepolia ? "Sepolia" : "Unsupported network"}</div>
            <div class="wallet-small">Chain ID: ${chainId ?? "unknown"}</div>
          </div>
        </div>
      </div>
      <div class="wallet-status__aside">
        ${
          chainMismatch && switchable
            ? `<button class="wallet-btn wallet-btn--inline" type="button" data-switch-network>Switch to ${PREFERRED_CHAIN_LABEL}</button>`
            : balanceLoading
            ? `<div class="wallet-balance wallet-placeholder">Fetching balance...</div>`
            : `<div class="wallet-balance">${
                balance ? `${balance.formatted} ${balance.symbol || "ETH"}` : ""
              }</div>`
        }
      </div>
    </div>
    ${
      chainMismatch && !switchable
        ? `<div class="wallet-note" id="wallet-account-note">Switch networks in your wallet to continue.</div>`
        : ""
    }
    <div class="wallet-actions" style="margin-top: 1rem;">
      ${
        wcSession
          ? `<button class="wallet-btn" type="button" data-open-wallet>Open wallet</button>`
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
    clearAllWalletStorage();
    lastDisplayData = null;
    closeAccountModal();
  });
  target.querySelector("[data-open-wallet]")?.addEventListener("click", () => {
    openWalletDeepLink(undefined, { userInitiated: true });
  });
  const switchBtn = target.querySelector("[data-switch-network]");
  if (switchBtn) {
    switchBtn.addEventListener("click", async () => {
      switchBtn.disabled = true;
      switchBtn.textContent = "Switching...";
      const switched = await attemptNetworkSwitch(wagmiClient);
      if (switched) {
        const data = await fetchDisplayData(wagmiClient);
        lastDisplayData = data;
        render(data);
      } else {
        switchBtn.disabled = false;
        switchBtn.textContent = `Switch to ${PREFERRED_CHAIN_LABEL}`;
      }
    });
  }
}

/** Open the account modal showing ENS/address, balance, network, and actions. */
export async function openAccountModal() {
  wagmiClient = await loadWagmiClient();
  const account = wagmiClient.getAccount();
  const network = wagmiClient.getNetwork();
  const cached =
    lastDisplayData && lastDisplayData.account?.address === account?.address ? lastDisplayData : null;
  const initialData = cached || { account, network, ensName: null, balance: null };
  const loadingFlags = {
    loadingEns: Boolean(account?.address) && !initialData.ensName,
    loadingBalance: Boolean(account?.address) && !initialData.balance,
  };
  showOverlay();
  render({ ...initialData, account, network }, loadingFlags);
  try {
    const data = await fetchDisplayData(wagmiClient);
    lastDisplayData = data;
    render(data);
  } catch (error) {
    console.warn("Account modal fetch failed", error);
  }
}
