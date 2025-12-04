import {
  loadWeb3,
  onWeb3Ready,
  shouldEagerLoadWeb3,
} from "./foundation.js";
import { openConnectModal } from "./wallet/connect-modal/index.js";
import { openAccountModal } from "./wallet/account-modal/index.js";
import { truncateAddress } from "./client/wagmi.js";

const connectWalletButton = document.getElementById("connect-wallet");

if (connectWalletButton) {
  let accountUnsubscribe;
  let lastEnsAddress = null;
  let cachedEnsName = null;

  const isWalletModalOpen = () => Boolean(document.querySelector(".wallet-overlay.is-visible"));
  const releaseButtonIfIdle = () => {
    if (!isWalletModalOpen()) {
      connectWalletButton.disabled = false;
    }
  };

  document.addEventListener("wallet:modal-closed", releaseButtonIfIdle);

  const updateButton = (account) => {
    if (!account?.isConnected) {
      connectWalletButton.innerText = "Connect\nWallet";
      return;
    }
    const label = cachedEnsName || truncateAddress(account.address);
    connectWalletButton.innerText = `Connected:\n${label}`;
  };

  const fetchEnsIfNeeded = async (wagmi, address) => {
    if (!address || address === lastEnsAddress) return;
    lastEnsAddress = address;
    cachedEnsName = null;
    try {
      const ens = await wagmi.fetchEnsName({ address, chainId: 1 });
      if (ens && address === lastEnsAddress) {
        cachedEnsName = ens;
        updateButton({ isConnected: true, address });
      }
    } catch (error) {
      if (window?.suWeb3?.debug) {
        console.warn("ENS lookup failed", error);
      }
      cachedEnsName = null;
    }
  };

  const attachAccountWatcher = (wagmi) => {
    if (accountUnsubscribe) return;
    accountUnsubscribe = wagmi.watchAccount((account) => {
      updateButton(account);
      if (account?.isConnected && account.address) {
        fetchEnsIfNeeded(wagmi, account.address);
      } else {
        cachedEnsName = null;
        lastEnsAddress = null;
      }
    });
  };

  onWeb3Ready(attachAccountWatcher);

  const maybeEagerLoad = () => {
    if (!shouldEagerLoadWeb3()) return;
    loadWeb3()
      .then(attachAccountWatcher)
      .catch((error) => console.error("Web3 eager load failed", error));
  };
  maybeEagerLoad();

  connectWalletButton.addEventListener("click", async () => {
    connectWalletButton.disabled = true;
    try {
      const wagmi = await loadWeb3();
      attachAccountWatcher(wagmi);
      const account = wagmi.getAccount();
      if (account?.isConnected) {
        await openAccountModal();
      } else {
        await openConnectModal();
      }
    } catch (error) {
      console.error(error);
    } finally {
      releaseButtonIfIdle();
    }
  });
}
