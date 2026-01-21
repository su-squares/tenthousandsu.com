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
import { isValidSquareId } from "./store.js";
import { ensureOwnershipLoaded } from "./ownership.js";
import { clearOwnedSquaresCache, fetchOwnedSquaresForIds } from "../../web3/services/ownership.js";

export function isUserRejectedError(error, message) {
  const code = error?.code || error?.cause?.code;
  if (code === 4001 || code === "ACTION_REJECTED") return true;
  const name = String(error?.name || error?.cause?.name || "").toLowerCase();
  if (name.includes("userrejected")) return true;
  const text = [
    message,
    error?.shortMessage,
    error?.cause?.shortMessage,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return (
    text.includes("user rejected") ||
    text.includes("user denied") ||
    text.includes("request rejected") ||
    text.includes("denied transaction")
  );
}

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
    showPersonalizeTotal: true,
  });

  const syncTotal = () => {
    const { rows } = store.getState();
    const uniqueSquares = new Set();
    rows.forEach((row) => {
      if (isValidSquareId(row.squareId)) {
        uniqueSquares.add(row.squareId);
      }
    });
    txUi.setPersonalizeCount(uniqueSquares.size);
  };

  syncTotal();
  store.subscribe(syncTotal);

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
        if (account?.address) {
          let txOwnershipActive = false;
          try {
            const ids = Array.from(
              new Set(
                state.rows
                  .map((row) => row.squareId)
                  .filter((squareId) => isValidSquareId(squareId))
              )
            );
            if (ids.length > 0) {
              txOwnershipActive = true;
              store.setTxOwnershipStatus("loading");
              store.setTxOwnershipProgress(0, ids.length);
              const ownedSubset = await fetchOwnedSquaresForIds(account.address, ids, wagmi, {
                onProgress: (payload) => {
                  store.setTxOwnershipProgress(payload?.completed ?? 0, payload?.total ?? ids.length);
                },
              });
              const notOwned = ids.filter((id) => !ownedSubset.has(id));
              state.rows.forEach((row) => {
                if (!isValidSquareId(row.squareId)) return;
                const isOwnershipError =
                  typeof row.errors?.square === "string" && /own/i.test(row.errors.square);
                if (notOwned.includes(row.squareId)) {
                  store.setRowError(row.id, "square", "You don't own this Square.");
                } else if (isOwnershipError) {
                  store.setRowError(row.id, "square", "");
                }
              });
            }
          } catch (error) {
            alertFn("Unable to verify ownership. Continuing without pre-validation.");
          } finally {
            if (txOwnershipActive) {
              store.setTxOwnershipStatus("idle");
              store.setTxOwnershipProgress(0, null);
            }
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

        ensureOwnershipLoaded({
          store,
          wagmi,
          requireConnection: false,
          source: "personalize",
        }).catch(() => {});

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
        clearOwnedSquaresCache();
        store.setOwnershipStatus("idle");
        store.setOwnershipProgress(0, null);
      } catch (error) {
        const message = error?.message || "Transaction failed";
        txUi.markError(message);
        if (!isUserRejectedError(error, message)) {
          markOwnershipErrorsFromTx(message);
        }
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
