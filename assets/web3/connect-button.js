import {
  ensureConnected,
  loadWeb3,
  onWeb3Ready,
  shouldEagerLoadWeb3,
} from "./foundation.js";

const connectWalletButton = document.getElementById("connect-wallet");

if (connectWalletButton) {
  let accountUnsubscribe;

  const attachAccountWatcher = ({ ethereumClient }) => {
    if (accountUnsubscribe) return;
    accountUnsubscribe = ethereumClient.watchAccount((account) => {
      connectWalletButton.innerText = account.isConnected
        ? "Connected:\n" +
            account.address.slice(0, 6) +
            "\u2026" +
            account.address.slice(-4)
        : "Connect\nWallet";
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
      const web3 = await loadWeb3();
      attachAccountWatcher(web3);
      await web3.web3modal.openModal();
    } catch (error) {
      console.error(error);
    } finally {
      connectWalletButton.disabled = false;
    }
  });
}
