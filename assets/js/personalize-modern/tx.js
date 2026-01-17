import {
  ensureConnected,
  ensureCorrectNetwork,
  isMobileDevice,
  openWalletChooser,
} from "../../web3/foundation.js";
import { createTxFixture } from "../../web3/tx/index.js";
import { getWeb3Config } from "../../web3/config.js";
import { personalizeUnderlay } from "../../web3/services/underlay.js";
import { personalizeUnderlayBatch } from "../../web3/services/underlay-batch.js";
import { buildTxUrl } from "../../web3/services/explorer-links.js";
import { fetchOwnedSquares } from "../../web3/services/ownership.js";

export function initPersonalizeTx(options) {
  const {
    store,
    personalizeButton,
    openWalletButton,
    txFixtureDiv,
    validateForSubmit,
    validateSquareErrors,
    markOwnershipErrorsFromTx,
    alertFn = window.alert.bind(window),
  } = options;

  if (!personalizeButton || !txFixtureDiv) {
    return { txUi: null };
  }

  const { pricing } = getWeb3Config();
  const txUi = createTxFixture({
    target: txFixtureDiv,
    pricing,
    mode: "personalize",
    title: "Personalization status",
  });

  let currentWagmi = null;

  const updateOpenWalletButton = () => {
    if (!openWalletButton) return;
    const isWalletConnect = currentWagmi?.getAccount?.()?.connector?.id === "walletConnect";
    const showButton = isMobileDevice() && isWalletConnect;
    openWalletButton.style.display = showButton ? "inline-block" : "none";
  };

  if (openWalletButton) {
    updateOpenWalletButton();
    openWalletButton.addEventListener("click", () => {
      openWalletChooser();
    });
  }

  personalizeButton.addEventListener("click", async () => {
    if (!validateForSubmit()) return;

    const { rows } = store.getState();
    if (rows.length === 0) {
      alertFn("Please add at least one Square to personalize.");
      return;
    }

    const isBatch = rows.length > 1;
    const message = isBatch
      ? "Personalizing your Squares. Confirm in your wallet to continue."
      : `Personalizing Square #${rows[0].squareId}. Confirm in your wallet to continue.`;

    txUi.startProcessing(message);

    const doSendTransaction = async (wagmi) => {
      const isWalletConnect = wagmi?.getAccount?.()?.connector?.id === "walletConnect";
      txUi.setWalletContext({ isWalletConnect });
      if (isMobileDevice() && isWalletConnect) {
        openWalletChooser();
      }

      try {
        const state = store.getState();
        const account = wagmi.getAccount?.();
        if (account?.address && state.ownershipStatus !== "ready") {
          try {
            const owned = await fetchOwnedSquares(account.address, wagmi);
            store.setOwnedSquares(owned);
            store.setOwnershipStatus("ready");
            validateSquareErrors(true);
          } catch (error) {
            store.setOwnershipStatus("error", error?.message || "Unable to fetch ownership.");
            alertFn("Unable to verify ownership. Continuing without pre-validation.");
          }
        }

        const ownershipErrors = store
          .getState()
          .rows.some((row) => row.errors.square && /own/i.test(row.errors.square));
        if (ownershipErrors) {
          txUi.markError("One or more Squares are not owned.");
          alertFn("One or more Squares are not owned.");
          return;
        }

        let result;
        if (isBatch) {
          const payload = rows.map((row) => ({
            squareId: row.squareId,
            rgbData: row.imagePixelsHex,
            title: row.title,
            href: row.uri,
          }));
          result = await personalizeUnderlayBatch(payload, wagmi);
        } else {
          const row = rows[0];
          result = await personalizeUnderlay(
            {
              squareId: row.squareId,
              imagePixelsHex: row.imagePixelsHex,
              title: row.title,
              url: row.uri,
            },
            wagmi
          );
        }

        const pendingUrl = buildTxUrl(result.hash);
        txUi.addPending(result.hash, pendingUrl);
        const transaction = await wagmi.waitForTransaction({ hash: result.hash });
        const txUrl = buildTxUrl(transaction.transactionHash);
        txUi.markSuccess(
          transaction.transactionHash,
          txUrl,
          "Transaction confirmed. Your image will show on the Su Squares homepage, which refreshes hourly."
        );
      } catch (error) {
        const message = error?.message || "Transaction failed";
        txUi.markError(message);
        markOwnershipErrorsFromTx(message);
        alertFn(message);
      }
    };

    try {
      await ensureConnected(async (clients) => {
        currentWagmi = clients;
        updateOpenWalletButton();
        await ensureCorrectNetwork(clients);
        const { activeNetwork } = getWeb3Config();
        const account = clients.getAccount?.();
        if (account?.address) {
          txUi.setBalanceContext({
            address: account.address,
            chainId: activeNetwork.chainId,
            fetcher: (addr, chain) => clients.fetchBalance({ address: addr, chainId: chain }),
          });
        }
        await doSendTransaction(clients);
      });
    } catch (error) {
      const message = error?.message || "Unable to connect wallet.";
      txUi.markError(message);
      alertFn(message);
    }
  });

  return { txUi };
}
