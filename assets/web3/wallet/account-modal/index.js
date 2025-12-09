import { ChainKey, NETWORK_PRESETS, getWeb3Config } from "../../config/index.js";
import { loadWagmiClient } from "../../client/wagmi.js";
import { clearAllWalletStorage } from "../../foundation.js";
import { createModalShell } from "../base/modal-shell.js";
import { createDebugLogger } from "../../config/logger.js";
import { renderAddNetworkView } from "./add-network-view.js";
import { renderAccountView } from "./account-view.js";
import { probeNetworkAvailable, shouldProbeNetworkAvailability } from "./network-probe.js";
import { getCachedEnsName, getEnsName } from "../ens-store.js";
import { getBalance, getCachedBalance, subscribeBalance, clearAllBalanceCache } from "../balance-store.js";

const log = createDebugLogger("account-modal");

let shell = null;
let wagmiClient = null;
let lastDisplayData = null;
let networkUnsubscribe = null;
let balanceUnsubscribe = null;
let networkAvailable = null; // null = unknown, true = available, false = not added
const ENS_CHAIN_ID = NETWORK_PRESETS[ChainKey.MAINNET].chainId;

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

function cleanupWatchers() {
  try {
    networkUnsubscribe?.();
  } catch (_error) {
    /* ignore */
  }
  try {
    balanceUnsubscribe?.();
  } catch (_error) {
    /* ignore */
  }
  networkUnsubscribe = null;
  balanceUnsubscribe = null;
}

export function closeAccountModal() {
  if (!shell) return;
  const wasVisible = shell.overlay.classList.contains("is-visible");
  shell.hide();
  cleanupWatchers();
  networkAvailable = null;
  if (wasVisible) {
    document.dispatchEvent(
      new CustomEvent("wallet:modal-closed", { detail: { modal: "account" } })
    );
  }
}

async function fetchDisplayData(wagmi) {
  const appConfig = getWeb3Config();
  const account = wagmi.getAccount();
  const network = wagmi.getNetwork();

  let ensName = null;
  let balance = null;

  if (!account?.address) {
    console.warn("Account modal: no connected address, skipping ENS/balance fetch.");
    return { account, network, ensName, balance };
  }

  // Fetch ENS from mainnet (with cache)
  try {
    const result = await getEnsName({
      address: account.address,
      chainId: ENS_CHAIN_ID,
      fetcher: (address, chainId) =>
        wagmi.fetchEnsName({
          address,
          chainId,
        }),
    });
    ensName = result?.name || null;
  } catch (error) {
    console.warn("Account modal: ENS lookup failed", error);
  }

  // Fetch balance on TARGET chain via balance store (with caching)
  try {
    const balanceResult = await getBalance({
      address: account.address,
      chainId: appConfig.activeNetwork.chainId,
      fetcher: (addr, chain) =>
        wagmi.fetchBalance({
          address: addr,
          chainId: chain,
        }),
    });
    balance = balanceResult?.balance || null;
  } catch (error) {
    console.warn("Account modal: Balance lookup failed", error);
  }

  return { account, network, ensName, balance };
}

function render(data, options = {}) {
  const appConfig = getWeb3Config();
  const modalShell = ensureShell();
  const target = modalShell.content;
  if (!target) return;

  const onDisconnect = async () => {
    try {
      await wagmiClient?.disconnect();
    } catch (error) {
      console.warn("Disconnect failed", error);
    }
    clearAllWalletStorage();
    lastDisplayData = null;
    closeAccountModal();
  };

  if (networkAvailable === false) {
    renderAddNetworkView(target, { activeNetwork: appConfig.activeNetwork, onDisconnect });
  } else {
    renderAccountView(target, data, {
      activeNetwork: appConfig.activeNetwork,
      presets: {
        mainnet: NETWORK_PRESETS[ChainKey.MAINNET].chainId,
        sepolia: NETWORK_PRESETS[ChainKey.SEPOLIA].chainId,
      },
      wagmiClient,
      onDisconnect,
      onRefresh: async () => {
        if (!wagmiClient || !data.account?.address) return;
        const { refreshBalance } = await import("../balance-store.js");
        await refreshBalance(
          data.account.address,
          appConfig.activeNetwork.chainId,
          (addr, chain) => wagmiClient.fetchBalance({ address: addr, chainId: chain })
        );
      },
      loadingEns: options.loadingEns,
      loadingBalance: options.loadingBalance,
    });
  }
}

/** Open the account modal showing ENS/address, balance, network, and actions. */
export async function openAccountModal() {
  wagmiClient = await loadWagmiClient();
  cleanupWatchers();
  networkAvailable = null;
  const appConfig = getWeb3Config();

  const account = wagmiClient.getAccount();
  const network = wagmiClient.getNetwork();
  const cachedEns = getCachedEnsName(account?.address, ENS_CHAIN_ID);
  const cachedBalance = getCachedBalance(account?.address, appConfig.activeNetwork.chainId);

  const initialData = { account, network, ensName: cachedEns, balance: cachedBalance };
  showOverlay();
  render(initialData, {
    loadingEns: Boolean(account?.address && !cachedEns),
    loadingBalance: Boolean(account?.address && !cachedBalance),
  });

  // Subscribe to balance updates for reactive re-renders
  if (account?.address) {
    balanceUnsubscribe = subscribeBalance((payload) => {
      if (payload.address?.toLowerCase() === account.address?.toLowerCase()) {
        log("Balance update received", payload);
        if (lastDisplayData) {
          lastDisplayData = { ...lastDisplayData, balance: payload.balance };
          render(lastDisplayData);
        }
      }
    });
  }

  // Probe if network is available (only for custom chains)
  if (shouldProbeNetworkAvailability()) {
    const probeResult = await probeNetworkAvailable(wagmiClient);
    networkAvailable = probeResult.available;
    log("Network available:", networkAvailable);
  } else {
    networkAvailable = true;
  }

  if (!networkAvailable) {
    render(initialData);
    return;
  }

  try {
    const data = await fetchDisplayData(wagmiClient);
    lastDisplayData = data;
    render(data);
  } catch (error) {
    console.warn("Account modal fetch failed", error);
    render(initialData);
  }

  if (wagmiClient?.watchNetwork) {
    networkUnsubscribe = wagmiClient.watchNetwork(async () => {
      if (!networkAvailable) return;
      try {
        const updated = await fetchDisplayData(wagmiClient);
        lastDisplayData = updated;
        render(updated);
      } catch (error) {
        console.warn("Account modal network watch failed", error);
      }
    });
  }
}
