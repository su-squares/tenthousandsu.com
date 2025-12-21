import { openInfoModal } from "../info-modal/index.js";
import { isMobileDevice, openWalletDeepLink } from "../wc-constants.js";
import { createConnectStore } from "./state.js";
import { CONNECTING_VARIANT } from "./constants.js";
import { renderListView } from "./views/list.js";
import { renderQrView } from "./views/qr.js";
import { renderConnectingView } from "./views/connecting.js";
import { renderErrorView } from "./views/error.js";
import { renderCanceledView } from "./views/canceled.js";
import { loadWagmiClient } from "../../client/wagmi.js";
import { createDebugLogger } from "../../config/logger.js";

const log = createDebugLogger("wallet-connect");

// WalletConnect localStorage key prefixes for cleanup
const WC_KEY_PREFIXES = ["wc@2:client:", "wc@2:", "walletconnect"];

/**
 * Clear WalletConnect-related localStorage keys when sessions become corrupted.
 * This is a recovery mechanism for when WC gets into a bad state.
 * @param {{ onlyEmpty?: boolean }} [options]
 */
function clearWalletConnectStorage(options = {}) {
  const onlyEmpty = Boolean(options.onlyEmpty);
  const removed = [];
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (!key || !WC_KEY_PREFIXES.some((prefix) => key.startsWith(prefix))) continue;

      if (!onlyEmpty) {
        removed.push(key);
        localStorage.removeItem(key);
        continue;
      }

      const value = localStorage.getItem(key);
      if (!value || value === "{}") {
        removed.push(key);
        localStorage.removeItem(key);
        continue;
      }

      try {
        const parsed = JSON.parse(value);
        if (!parsed || (typeof parsed === "object" && Object.keys(parsed).length === 0)) {
          removed.push(key);
          localStorage.removeItem(key);
        }
      } catch (_error) {
        // keep non-empty/unparseable values when onlyEmpty=true
      }
    }
    if (removed.length) {
      log("cleared WalletConnect storage", { count: removed.length, onlyEmpty });
    }
  } catch (_error) {
    /* ignore cleanup errors */
  }
}

export function createConnectController(shell) {
  const store = createConnectStore();
  let wagmi = null;
  let connectors = [];
  let accountUnsubscribe = null;
  let resolver = null;
  let visible = false;

  const render = () => {
    if (!shell?.content) return;
    const state = store.getState();

    switch (state.view) {
      case "qr":
        shell.setAria({ labelledBy: "wallet-qr-title", describedBy: undefined });
        shell.setBackHandler(() => {
          store.setState({ view: "list", qrUri: "", copied: false });
        });
        renderQrView(shell.content, state, {
          onCopy: () => {
            if (state.qrUri) {
              navigator.clipboard.writeText(state.qrUri).then(() => setCopied(true));
            }
          },
          // Real URI for initial connection - this is the ONLY place with actual WC session data
          onOpenWallet: () => openWalletDeepLink(state.qrUri),
        });
        break;
      case "connecting":
        shell.setAria({ labelledBy: "wallet-connecting-title", describedBy: "wallet-connecting-helper" });
        shell.setBackHandler(null);
        renderConnectingView(shell.content, {
          variant: state.connectingVariant || CONNECTING_VARIANT.DEFAULT,
          hasUri: Boolean(state.qrUri),
          onCancel: () => finalize(null),
          // Real URI for initial connection
          onOpenWallet: () => openWalletDeepLink(state.qrUri),
          onShowQr: () => store.setState({ view: "qr" }),
        });
        break;
      case "error":
        shell.setAria({ labelledBy: "wallet-error-title", describedBy: "wallet-error-message" });
        shell.setBackHandler(null);
        renderErrorView(shell.content, {
          message: state.errorMessage,
          onBack: () => store.setState({ view: "list", errorMessage: "" }),
        });
        break;
      case "canceled":
        shell.setAria({ labelledBy: "wallet-canceled-title", describedBy: "wallet-canceled-message" });
        shell.setBackHandler(null);
        renderCanceledView(shell.content, () => store.setState({ view: "list" }));
        break;
      case "list":
      default:
        shell.setAria({ labelledBy: "wallet-connect-title", describedBy: "wallet-connect-helper" });
        shell.setBackHandler(null);
        renderListView(shell.content, {
          connectors,
          onSelect: handleConnector,
          onOpenInfo: handleInfoModal,
        });
        break;
    }
  };

  store.subscribe(render);

  const setView = (view) => store.setState({ view });
  const setQr = (uri) => store.setState({ qrUri: uri });
  const setError = (message) => store.setState({ errorMessage: message, view: "error" });
  const setConnectingVariant = (variant) =>
    store.setState({ connectingVariant: variant || CONNECTING_VARIANT.DEFAULT });
  const setCopied = (flag) => {
    store.setState({ copied: flag });
    if (flag) {
      setTimeout(() => store.setState({ copied: false }), 1600);
    }
  };

  const cleanupWatchers = () => {
    try {
      accountUnsubscribe?.();
    } catch (_error) {
      /* noop */
    }
    accountUnsubscribe = null;
  };

  const finalize = (result) => {
    const wasVisible = visible;
    cleanupWatchers();
    shell.hide();
    visible = false;
    store.reset();
    if (resolver) {
      resolver(result ?? null);
      resolver = null;
    }
    if (wasVisible) {
      document.dispatchEvent(
        new CustomEvent("wallet:modal-closed", { detail: { modal: "connect" } })
      );
    }
  };

  const handleConnector = async (connector) => {
    let displayUriHandler = null;
    try {
      const isWalletConnect = connector.id === "walletConnect";
      const mobileCapable = isMobileDevice();

      if (isWalletConnect) {
        const provider = await connector.getProvider();
        if (provider) {
          // Listen for display_uri and store in-memory (not localStorage)
          displayUriHandler = (uri) => {
            setQr(uri);
            if (mobileCapable) {
              // On mobile, trigger deep link immediately during connection
              openWalletDeepLink(uri);
              setConnectingVariant(CONNECTING_VARIANT.WALLETCONNECT);
              setView("connecting");
            } else {
              setConnectingVariant(CONNECTING_VARIANT.DEFAULT);
              setView("qr");
            }
          };
          provider.on("display_uri", displayUriHandler);
        }
        setConnectingVariant(mobileCapable ? CONNECTING_VARIANT.WALLETCONNECT : CONNECTING_VARIANT.DEFAULT);
        setView(mobileCapable ? "connecting" : "qr");
      } else {
        setConnectingVariant(CONNECTING_VARIANT.DEFAULT);
        setView("connecting");
      }

      await wagmi.connect({ connector });

      // Connection successful - finalize immediately
      // Network switching is handled automatically by wallets during transactions
      const account = wagmi.getAccount();
      if (account?.isConnected) {
        log("Connected successfully", {
          address: account.address,
          connector: account.connector?.id
        });
        finalize(account);
      } else {
        finalize(null);
      }

    } catch (error) {
      log("connect error", error);
      const message = typeof error?.message === "string" ? error.message : "";
      // WalletConnect sometimes leaves behind corrupted session/namespace data.
      // If that happens, clear WC storage so the next attempt starts clean.
      const isWalletConnect = connector?.id === "walletConnect";
      const wcNamespaceIssue =
        message.includes("NON_CONFORMING_NAMESPACES") ||
        message.includes("defaultChain") ||
        message.includes("Cannot convert undefined or null to object");
      if (isWalletConnect && wcNamespaceIssue) {
        clearWalletConnectStorage({ onlyEmpty: false });
        log("reset WalletConnect storage after namespace error");
      }
      if (message.includes("User rejected") || message.includes("User denied")) {
        setView("canceled");
      } else {
        setError(
          message || (isWalletConnect && wcNamespaceIssue
            ? "WalletConnect session was reset. Please try again."
            : "Connection failed")
        );
      }
    } finally {
      // Clean up display_uri listener
      if (displayUriHandler) {
        try {
          const provider = await connector.getProvider?.();
          if (provider?.removeListener) {
            provider.removeListener("display_uri", displayUriHandler);
          } else if (provider?.off) {
            provider.off("display_uri", displayUriHandler);
          }
        } catch (_error) {
          /* ignore cleanup errors */
        }
      }
      store.setState({ qrUri: "", copied: false });
    }
  };

  const handleInfoModal = () => {
    finalize(null);
    openInfoModal(() => open());
  };

  const filterConnectors = (list) =>
    list.filter((connector) => {
      if (connector.id === "walletConnect") return true;
      if (connector._eip6963) return true;
      if (typeof connector.ready === "boolean") return connector.ready;
      if (typeof connector.ready === "function") {
        try {
          return connector.ready();
        } catch (_e) {
          return false;
        }
      }
      return true;
    });

  const open = async () => {
    wagmi = await loadWagmiClient();
    connectors = filterConnectors(wagmi.connectors || []);
    store.reset();
    shell.setOnRequestClose(() => finalize(null));
    visible = true;
    shell.show();
    render();

    const onAccount = wagmi.watchAccount((account) => {
      if (account.isConnected) {
        log("Account connected via watcher", {
          address: account.address,
          connector: account.connector?.id
        });
        finalize(wagmi.getAccount());
      }
    });
    accountUnsubscribe = onAccount;

    return new Promise((resolve) => {
      resolver = resolve;
    });
  };

  const close = () => finalize(null);

  return {
    open,
    close,
  };
}
