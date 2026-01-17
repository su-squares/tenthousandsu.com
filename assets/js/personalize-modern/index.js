import {
  ensureConnected,
  ensureCorrectNetwork,
  isMobileDevice,
  openWalletChooser,
  loadWeb3,
} from "../../web3/foundation.js";
import { createTxFixture } from "../../web3/tx/index.js";
import { getWeb3Config } from "../../web3/config.js";
import { personalizeUnderlay } from "../../web3/services/underlay.js";
import { personalizeUnderlayBatch } from "../../web3/services/underlay-batch.js";
import { buildTxUrl } from "../../web3/services/explorer-links.js";
import { fetchOwnedSquares } from "../../web3/services/ownership.js";
import {
  createPersonalizeStore,
  isRowEmpty,
  isValidSquareId,
  getTitleLength,
  getUriLength,
} from "./store.js";
import { createPersonalizeTable } from "./table.js";
import { initPersonalizeChooser } from "./chooser.js";

const TITLE_MAX = 64;
const URI_MAX = 96;

const overLimitFlags = new Map();

function clearOverLimitFlags(rowId) {
  const prefix = `${rowId}:`;
  Array.from(overLimitFlags.keys()).forEach((key) => {
    if (key.startsWith(prefix)) {
      overLimitFlags.delete(key);
    }
  });
}

function setOverLimitFlag(rowId, field, isOver) {
  const key = `${rowId}:${field}`;
  if (isOver) {
    if (!overLimitFlags.get(key)) {
      overLimitFlags.set(key, true);
      return true;
    }
    return false;
  }
  overLimitFlags.delete(key);
  return false;
}

function summarizeErrors(counts) {
  const messages = [];
  if (counts.incomplete > 0) messages.push(`${counts.incomplete} row(s) are incomplete.`);
  if (counts.invalidSquare > 0) messages.push(`${counts.invalidSquare} invalid Square number(s).`);
  if (counts.duplicate > 0) messages.push(`${counts.duplicate} duplicate Square number(s).`);
  if (counts.ownership > 0) messages.push(`${counts.ownership} Square(s) not owned.`);
  if (counts.overLimit > 0) messages.push(`${counts.overLimit} field(s) exceed limits.`);
  return messages.join("\n");
}

function parseSquareInput(value) {
  if (value === "") return null;
  const num = Number(value);
  if (Number.isNaN(num)) return null;
  return num;
}

function collectDuplicateCounts(rows) {
  const counts = new Map();
  rows.forEach((row) => {
    if (isValidSquareId(row.squareId)) {
      counts.set(row.squareId, (counts.get(row.squareId) || 0) + 1);
    }
  });
  return counts;
}

function initPage() {
  const tableBody = document.getElementById("personalize-table-body");
  const gutterBody = document.getElementById("personalize-table-gutter");
  const wrapper = document.querySelector(".personalize-table__wrapper");
  const openChooserButton = document.getElementById("open-square-chooser");
  const resetButton = document.getElementById("reset-all");
  const addRowButton = document.getElementById("add-row");
  const openWalletButton = document.getElementById("open-wallet-app");
  const personalizeButton = document.getElementById("personalize");
  const txFixtureDiv = document.getElementById("tx-fixture");

  if (!tableBody || !gutterBody || !wrapper || !personalizeButton || !txFixtureDiv) {
    return;
  }

  const store = createPersonalizeStore({ initialRows: 1 });

  const validateSquareErrors = (requireFilled = false) => {
    const state = store.getState();
    const counts = collectDuplicateCounts(state.rows);

    state.rows.forEach((row) => {
      let message = "";
      if (row.squareId === null || row.squareId === "") {
        if (requireFilled && !isRowEmpty(row)) {
          message = "Square # is required.";
        }
      } else if (!isValidSquareId(row.squareId)) {
        message = "Square # must be between 1 and 10000.";
      } else if (counts.get(row.squareId) > 1) {
        message = "You already added this Square.";
      } else if (
        state.ownershipStatus === "ready" &&
        state.ownedSquares &&
        !state.ownedSquares.has(row.squareId)
      ) {
        message = "You don't own this Square.";
      }
      store.setRowError(row.id, "square", message);
    });
  };

  const handleFieldInput = (rowId, field, value) => {
    if (field === "square") {
      const squareId = parseSquareInput(value);
      store.updateRow(rowId, { squareId });
      validateSquareErrors(false);
      return;
    }

    if (field === "title") {
      store.updateRow(rowId, { title: value });
      const row = store.getState().rows.find((item) => item.id === rowId);
      const length = row ? getTitleLength(row) : 0;
      if (length > TITLE_MAX) {
        store.setRowError(rowId, "title", "Text is too long.");
        if (setOverLimitFlag(rowId, "title", true)) {
          alert("Text is too long, please try again.");
        }
      } else {
        store.setRowError(rowId, "title", "");
        setOverLimitFlag(rowId, "title", false);
      }
      return;
    }

    if (field === "uri") {
      store.updateRow(rowId, { uri: value });
      const row = store.getState().rows.find((item) => item.id === rowId);
      const length = row ? getUriLength(row) : 0;
      if (length > URI_MAX) {
        store.setRowError(rowId, "uri", "URI is too long.");
        if (setOverLimitFlag(rowId, "uri", true)) {
          alert("URI is too long, please try again.");
        }
      } else {
        store.setRowError(rowId, "uri", "");
        setOverLimitFlag(rowId, "uri", false);
      }
    }
  };

  const handleRowDelete = (rowId) => {
    store.removeRow(rowId);
    clearOverLimitFlags(rowId);
    validateSquareErrors(false);
  };

  const table = createPersonalizeTable({
    store,
    tableBody,
    gutterBody,
    wrapper,
    onFieldInput: handleFieldInput,
    onRowDelete: handleRowDelete,
  });

  const syncSelectionToRows = (selectedIds) => {
    const selected = new Set(selectedIds);
    const state = store.getState();
    const existing = new Set(
      state.rows
        .map((row) => row.squareId)
        .filter((id) => isValidSquareId(id))
    );
    const selectionsMatch =
      selected.size === existing.size &&
      Array.from(selected).every((id) => existing.has(id));

    if (selectionsMatch) {
      return false;
    }

    state.rows.forEach((row) => {
      if (isValidSquareId(row.squareId) && !selected.has(row.squareId)) {
        store.removeRow(row.id);
      }
    });

    selected.forEach((id) => {
      if (!existing.has(id)) {
        store.addRow({ squareId: id });
      }
    });

    validateSquareErrors(false);
    return true;
  };

  initPersonalizeChooser({
    store,
    trigger: openChooserButton,
    onConfirm: (ids) => {
      const changed = syncSelectionToRows(ids);
      if (changed) {
        store.sortRows();
      }
    },
    onOwnershipReady: () => validateSquareErrors(false),
  });

  if (resetButton) {
    resetButton.addEventListener("click", () => {
      store.resetRowsKeepFirst();
      overLimitFlags.clear();
      validateSquareErrors(false);
    });
  }

  if (addRowButton) {
    addRowButton.addEventListener("click", () => {
      store.addRow();
      validateSquareErrors(false);
    });
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

  function validateForSubmit() {
    store.pruneEmptyRows();
    const state = store.getState();
    const rows = state.rows;

    if (rows.length === 1 && isRowEmpty(rows[0])) {
      alert("Please add at least one Square to personalize.");
      return false;
    }

    const issueRows = {
      incomplete: new Set(),
      invalidSquare: new Set(),
      duplicate: new Set(),
      ownership: new Set(),
      overLimit: new Set(),
    };

    const duplicateCounts = collectDuplicateCounts(rows);

    rows.forEach((row) => {
      const errors = { square: "", title: "", uri: "", image: "" };
      const hasData = !isRowEmpty(row);
      const hasSquare =
        row.squareId !== null &&
        row.squareId !== undefined &&
        row.squareId !== "";
      const titleLength = getTitleLength(row);
    const uriLength = getUriLength(row);

      if (!hasSquare) {
        if (hasData) {
          errors.square = "Square # is required.";
          issueRows.incomplete.add(row.id);
        }
      } else if (!isValidSquareId(row.squareId)) {
        errors.square = "Square # must be between 1 and 10000.";
        issueRows.invalidSquare.add(row.id);
      } else if (duplicateCounts.get(row.squareId) > 1) {
        errors.square = "You already added this Square.";
        issueRows.duplicate.add(row.id);
      } else if (
        state.ownershipStatus === "ready" &&
        state.ownedSquares &&
        !state.ownedSquares.has(row.squareId)
      ) {
        errors.square = "You don't own this Square.";
        issueRows.ownership.add(row.id);
      }

      if (titleLength > TITLE_MAX) {
        errors.title = "Text is too long.";
        issueRows.overLimit.add(row.id);
      } else if (titleLength < 1 && hasData) {
        errors.title = "Text is required.";
        issueRows.incomplete.add(row.id);
      }

      if (uriLength > URI_MAX) {
        errors.uri = "URI is too long.";
        issueRows.overLimit.add(row.id);
      } else if (uriLength < 1 && hasData) {
        errors.uri = "URI is required.";
        issueRows.incomplete.add(row.id);
      }

      if (!row.imagePixelsHex && hasData) {
        errors.image = "Upload an image.";
        issueRows.incomplete.add(row.id);
      }

      store.setRowErrors(row.id, errors);
    });

    const counts = {
      incomplete: issueRows.incomplete.size,
      invalidSquare: issueRows.invalidSquare.size,
      duplicate: issueRows.duplicate.size,
      ownership: issueRows.ownership.size,
      overLimit: issueRows.overLimit.size,
    };

    const hasErrors =
      counts.incomplete ||
      counts.invalidSquare ||
      counts.duplicate ||
      counts.ownership ||
      counts.overLimit;

    if (hasErrors) {
      alert(summarizeErrors(counts));
      return false;
    }

    validateSquareErrors(true);
    return true;
  }

  function markOwnershipErrorsFromTx(message) {
    if (!message || typeof message !== "string") return;
    const state = store.getState();
    const rows = state.rows;
    const matchedNumbers = Array.from(message.matchAll(/#?(\d{1,5})/g))
      .map((match) => Number(match[1]))
      .filter((num) => Number.isInteger(num));

    if (matchedNumbers.length > 0) {
      matchedNumbers.forEach((num) => {
        rows.forEach((row) => {
          if (row.squareId === num) {
            store.setRowError(row.id, "square", "You don't own this Square.");
          }
        });
      });
      return;
    }

    if (/own|owner/i.test(message)) {
      const notOwned =
        state.ownedSquares && state.ownedSquares.size > 0
          ? rows.filter(
              (row) => isValidSquareId(row.squareId) && !state.ownedSquares.has(row.squareId)
            )
          : rows;
      notOwned.forEach((row) => {
        store.setRowError(row.id, "square", "You don't own this Square.");
      });
    }
  }

  personalizeButton.addEventListener("click", async () => {
    if (!validateForSubmit()) return;

    const { rows } = store.getState();
    if (rows.length === 0) {
      alert("Please add at least one Square to personalize.");
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
            alert("Unable to verify ownership. Continuing without pre-validation.");
          }
        }

        const ownershipErrors = store
          .getState()
          .rows.some((row) => row.errors.square && /own/i.test(row.errors.square));
        if (ownershipErrors) {
          txUi.markError("One or more Squares are not owned.");
          alert("One or more Squares are not owned.");
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
        alert(message);
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
      alert(message);
    }
  });

  loadWeb3().catch(() => {});

  window.personalizeModern = {
    getRows: () =>
      store.getState().rows.map((row) => ({
        id: row.id,
        squareId: row.squareId,
        title: row.title,
        uri: row.uri,
        imagePixelsHex: row.imagePixelsHex,
        imagePreviewUrl: row.imagePreviewUrl,
      })),
    ensureRowForSquare: (squareId) => {
      if (!isValidSquareId(squareId)) return;
      store.ensureRowForSquare(squareId);
      store.sortRows();
      validateSquareErrors(false);
    },
    highlightRowBySquare: (squareId) => {
      const state = store.getState();
      const row = state.rows.find((item) => item.squareId === squareId);
      if (row) {
        store.highlightRow(row.id);
        table.scrollToRow(row.id);
      }
    },
    subscribe: (handler) => {
      if (typeof handler !== "function") return () => {};
      return store.subscribe(() => handler(window.personalizeModern.getRows()));
    },
  };
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initPage);
} else {
  initPage();
}
