import { isMobileDevice, openWalletChooser } from "../foundation.js";
import { ensureRefreshButtonStyles } from "../wallet/balance-refresh-button.js";
import {
  initActiveWalletContext,
  getBalanceContextForComponent,
  WALLET_CONTEXT_CHANGE_EVENT,
} from "../wallet/active-wallet-context.js";
import { renderTxView } from "./view.js";
import { createInitialState } from "./state.js";
import { normalizePricing } from "./formatting.js";
import { createBalanceManager } from "./balance-manager.js";

/**
 * @typedef {import("./state.js").TxState} TxState
 */

/**
 * @typedef {import("./state.js").TxMode} TxMode
 */

/**
 * @typedef {import("./formatting.js").TxPricing} TxPricing
 */

/**
 * @typedef {Object} TxControllerOptions
 * @property {string} [title]
 * @property {string} [message]
 * @property {Partial<TxPricing>} [pricing]
 * @property {TxMode} [mode]
 * @property {boolean} [showBalance]
 * @property {"fixture"|"modal"} [variant]
 * @property {boolean} [showClose]
 */

/**
 * @typedef {Object} TxController
 * @property {(ctx: { isWalletConnect?: boolean }) => void} setWalletContext
 * @property {(pricing: Partial<import("./formatting.js").TxPricing>) => void} setPricing
 * @property {(title?: string) => void} setTitle
 * @property {(message?: string) => void} setMessage
 * @property {(helpText?: string) => void} setHelp
 * @property {(context: TxState["balanceContext"] | null | undefined) => Promise<void>} setBalanceContext
 * @property {(message?: string) => void} startProcessing
 * @property {(hash?: string, url?: string) => void} addPending
 * @property {(hash?: string, url?: string, message?: string) => Promise<void>} markSuccess
 * @property {(message?: string, hash?: string, url?: string) => void} markError
 * @property {(message?: string) => void} reset
 * @property {() => void} destroy
 * @property {() => TxState} getState
 * @property {() => void} [show]
 * @property {() => void} [hide]
 */

/**
 * Create a transaction controller bound to a DOM node.
 * @param {HTMLElement} target
 * @param {TxControllerOptions} [options]
 * @returns {TxController}
 */
export function createTxController(target, options = {}) {
  if (!target) {
    throw new Error("createTxController requires a target element");
  }

  ensureRefreshButtonStyles();

  const state = createInitialState(options);
  let isWcConnector = false;
  const viewOptions = {
    variant: options.variant || "fixture",
    showClose: options.showClose,
  };

  const refreshWalletState = () => {
    // Show wallet button on mobile when connected via WalletConnect
    state.showWalletButton = Boolean(isMobileDevice() && isWcConnector);
  };

  const render = () => {
    renderTxView(
      target,
      state,
      {
        onCancel: () => controller.reset(),
        onOpenWallet: handleOpenWallet,
        onClose: () => controller.hide?.(),
        onRefreshBalance: state.balanceContext ? () => balanceManager.refresh() : null,
      },
      viewOptions
    );
  };

  const commitState = (patch) => {
    if (typeof patch === "function") {
      patch(state);
    } else if (patch && typeof patch === "object") {
      Object.assign(state, patch);
    }
    refreshWalletState();
    render();
  };

  const balanceManager = createBalanceManager({
    updateState: commitState,
    getState: () => state,
  });

  const handleOpenWallet = () => {
    // Opens OS app chooser with placeholder URI (no real session data exposed)
    openWalletChooser();
  };

  /** @type {TxController} */
  const controller = {
    setWalletContext({ isWalletConnect }) {
      if (typeof isWalletConnect === "boolean") isWcConnector = isWalletConnect;
      refreshWalletState();
      render();
    },
    setPricing(pricing) {
      commitState((draft) => {
        draft.pricing = normalizePricing(pricing);
      });
    },
    setTitle(title) {
      commitState((draft) => {
        draft.title = title || "Transaction status";
      });
    },
    setMessage(message) {
      commitState((draft) => {
        draft.message = message || "";
      });
    },
    setHelp(helpText) {
      commitState((draft) => {
        draft.helpText = helpText || "";
      });
    },
    async setBalanceContext(context) {
      await balanceManager.setContext(context);
    },
    startProcessing(message) {
      commitState((draft) => {
        draft.status = "processing";
        draft.message = message || "Check your wallet to continue.";
      });
    },
    addPending(hash, url) {
      commitState((draft) => {
        draft.status = "pending";
        if (hash) {
          const exists = draft.pending.some((tx) => tx.hash === hash);
          if (!exists) {
            draft.pending.push({ hash, url });
          }
        }
      });
    },
    async markSuccess(hash, url, message) {
      commitState((draft) => {
        draft.status = "success";
        draft.message = message || "Transaction confirmed.";
        draft.pending = draft.pending.filter((tx) => tx.hash !== hash);
        if (hash) {
          const exists = draft.confirmed.some((tx) => tx.hash === hash);
          if (!exists) {
            draft.confirmed.push({ hash, url });
          }
        }
      });

      await balanceManager.invalidateAndRefresh();
    },
    markError(message, hash, url) {
      commitState((draft) => {
        draft.status = "error";
        draft.message = message || "There was an issue with your transaction.";
        if (hash) {
          const existsPending = draft.pending.some((tx) => tx.hash === hash);
          if (!existsPending) {
            draft.pending.push({ hash, url });
          }
        }
      });
    },
    reset(message) {
      commitState((draft) => {
        draft.status = "idle";
        draft.message = message || "";
        draft.helpText = "";
        draft.pending = [];
        draft.confirmed = [];
      });
    },
    destroy() {
      balanceManager.destroy();
      window.removeEventListener(WALLET_CONTEXT_CHANGE_EVENT, handleWalletContextChange);
    },
    getState() {
      return { ...state };
    },
  };

  const handleWalletContextChange = async (event) => {
    const { isConnected, address } = event?.detail || {};

    if (isConnected && address) {
      const balanceContext = await getBalanceContextForComponent();
      if (balanceContext) {
        controller.setBalanceContext(balanceContext);
      }
    } else {
      await controller.setBalanceContext(null);
    }
  };

  window.addEventListener(WALLET_CONTEXT_CHANGE_EVENT, handleWalletContextChange);

  initActiveWalletContext()
    .then(async (context) => {
      if (context.isConnected && context.address) {
        const balanceContext = await getBalanceContextForComponent();
        if (balanceContext) {
          controller.setBalanceContext(balanceContext);
        }
      }
    })
    .catch(() => {
      // Wallet context is optional; ignore failures
    });

  refreshWalletState();
  render();
  return controller;
}
