import { enableSepolia } from "../config.js";
import {
  MAINNET_CHAIN_ID,
  SEPOLIA_CHAIN_ID,
  loadWagmiClient,
  truncateAddress,
} from "./wagmi-client.js";
import { clearStoredSession, getStoredSession, openWalletDeepLink } from "./wc-store.js";

let overlayEl = null;
let modalEl = null;
let contentEl = null;
let wagmiClient = null;

function ensureElements() {
  if (overlayEl) return;
  overlayEl = document.createElement("div");
  overlayEl.className = "wallet-overlay";
  overlayEl.setAttribute("role", "dialog");
  overlayEl.setAttribute("aria-modal", "true");
  overlayEl.addEventListener("click", (event) => {
    if (event.target === overlayEl) closeAccountModal();
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

export function closeAccountModal() {
  if (!overlayEl) return;
  overlayEl.classList.remove("is-visible");
}

async function fetchDisplayData(wagmi) {
  const account = wagmi.getAccount();
  const network = wagmi.getNetwork();
  let ensName = null;
  let balance = null;
  try {
    if (account?.address) {
      const chainId = network?.chain?.id;
      try {
        if (chainId === MAINNET_CHAIN_ID) {
          ensName = await wagmi.fetchEnsName({
            address: account.address,
            chainId: MAINNET_CHAIN_ID,
          });
        }
      } catch (error) {
        if (window?.suWeb3?.debug) {
          console.warn("ENS lookup failed", error);
        }
      }
      try {
        balance = await wagmi.fetchBalance({
          address: account.address,
          chainId: chainId || MAINNET_CHAIN_ID,
        });
      } catch (error) {
        if (window?.suWeb3?.debug) {
          console.warn("Balance lookup failed", error);
        }
      }
    }
  } catch (error) {
    console.warn("Failed to fetch ENS or balance", error);
  }
  return { account, network, ensName, balance };
}

function render({ account, network, ensName, balance }) {
  if (!contentEl) return;
  const chainId = network?.chain?.id;
  const onMainnet = chainId === MAINNET_CHAIN_ID;
  const onSepolia = enableSepolia && chainId === SEPOLIA_CHAIN_ID;
  const chainMismatch = !(onMainnet || onSepolia);
  const ethLogo = `${window.location.origin}/assets/images/ethereum_logo.png`;
  const addressDisplay = ensName || truncateAddress(account?.address || "");
  const wcSession = getStoredSession();

  contentEl.innerHTML = `
    <div class="wallet-modal__header">
      <h2>Wallet</h2>
      <button class="wallet-close" type="button" aria-label="Close" data-close>&#10005;</button>
    </div>
    <div class="wallet-status">
      <div>
        <div>${addressDisplay || "Not connected"}</div>
        <div class="wallet-small">${account?.address || ""}</div>
      </div>
      <button class="wallet-btn wallet-btn--ghost" type="button" data-copy>Copy</button>
    </div>
    <div class="wallet-status">
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
      <div class="wallet-balance">${
        balance ? `${balance.formatted} ${balance.symbol || "ETH"}` : ""
      }</div>
    </div>
    <div class="wallet-actions">
      ${
        wcSession
          ? `<button class="wallet-btn" type="button" data-open-wallet>Open wallet</button>`
          : ""
      }
      <button class="wallet-btn wallet-btn--ghost" type="button" data-disconnect>Disconnect</button>
    </div>
  `;

  contentEl.querySelector("[data-close]")?.addEventListener("click", closeAccountModal);
  contentEl.querySelector("[data-copy]")?.addEventListener("click", () => {
    if (account?.address) navigator.clipboard.writeText(account.address);
  });
  contentEl.querySelector("[data-disconnect]")?.addEventListener("click", async () => {
    try {
      await wagmiClient?.disconnect();
    } catch (error) {
      console.warn("Disconnect failed", error);
    }
    clearStoredSession();
    closeAccountModal();
  });
  contentEl.querySelector("[data-open-wallet]")?.addEventListener("click", () => {
    openWalletDeepLink();
  });
}

/** Open the account modal showing ENS/address, balance, network, and actions. */
export async function openAccountModal() {
  wagmiClient = await loadWagmiClient();
  const data = await fetchDisplayData(wagmiClient);
  showOverlay();
  render(data);
}
