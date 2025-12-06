import {
  loadWeb3,
  onWeb3Ready,
  shouldEagerLoadWeb3,
} from "./foundation.js";
import { openConnectModal } from "./wallet/connect-modal/index.js";
import { openAccountModal } from "./wallet/account-modal/index.js";
import { truncateAddress } from "./client/wagmi.js";
import { getEnsName, getCachedEnsName } from "./wallet/ens-store.js";
import { ChainKey, NETWORK_PRESETS } from "./config/index.js";

const connectWalletButton = document.getElementById("connect-wallet");
const ENS_CHAIN_ID = NETWORK_PRESETS[ChainKey.MAINNET].chainId;

if (connectWalletButton) {
  let accountUnsubscribe;
  let lastEnsAddress = null;
  let cachedEnsName = null;
  let lastLabelWasEns = false;

  const isWalletModalOpen = () => Boolean(document.querySelector(".wallet-overlay.is-visible"));
  const releaseButtonIfIdle = () => {
    if (!isWalletModalOpen()) {
      connectWalletButton.disabled = false;
    }
  };

  document.addEventListener("wallet:modal-closed", releaseButtonIfIdle);

  const setButtonLabel = (label, { isEns = false, animateEns = false } = {}) => {
    if (!connectWalletButton) return;
    const animatedClass = isEns && animateEns ? "su-nav-connect-label--fade" : "";
    if (!label) {
      connectWalletButton.innerHTML = "Connect<br>Wallet";
      lastLabelWasEns = false;
      return;
    }
    connectWalletButton.innerHTML = `Connected:<br><span class="su-nav-connect-label ${animatedClass}">${label}</span>`;
    lastLabelWasEns = isEns;
  };

  const updateButton = (account, { ensName = null, animateEns = false } = {}) => {
    if (!account?.isConnected) {
      cachedEnsName = null;
      lastEnsAddress = null;
      setButtonLabel(null);
      return;
    }
    const label = ensName || cachedEnsName || truncateAddress(account.address);
    const isEns = Boolean(ensName || cachedEnsName);
    setButtonLabel(label, { isEns, animateEns });
  };

  const fetchEnsIfNeeded = async (wagmi, address, { skipIfCached = false } = {}) => {
    if (!address) return;
    if (skipIfCached && cachedEnsName) return;
    if (address !== lastEnsAddress) {
      lastEnsAddress = address;
      cachedEnsName = null;
    }
    try {
      const result = await getEnsName({
        address,
        chainId: ENS_CHAIN_ID,
        fetcher: (addr, chainId) => wagmi.fetchEnsName({ address: addr, chainId }),
      });
      if (address !== lastEnsAddress) return;
      if (result?.name) {
        cachedEnsName = result.name;
        updateButton({ isConnected: true, address }, { ensName: result.name, animateEns: result.source === "fresh" && !lastLabelWasEns });
      }
    } catch (error) {
      if (window?.suWeb3?.debug) {
        console.warn("ENS lookup failed", error);
      }
    }
  };

  const attachAccountWatcher = (wagmi, { useCache = true } = {}) => {
    if (accountUnsubscribe) return;
    accountUnsubscribe = wagmi.watchAccount((account) => {
      const address = account?.address;
      const cachedEns = useCache ? getCachedEnsName(address, ENS_CHAIN_ID) : null;
      if (cachedEns) {
        cachedEnsName = cachedEns;
      }
      updateButton(account, { ensName: cachedEns });
      if (account?.isConnected && account.address) {
        fetchEnsIfNeeded(wagmi, account.address, { skipIfCached: Boolean(cachedEns) });
      } else {
        cachedEnsName = null;
        lastEnsAddress = null;
        lastLabelWasEns = false;
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
