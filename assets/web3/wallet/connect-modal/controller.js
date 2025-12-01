import { attemptNetworkSwitch } from "../network.js";
import { openInfoModal } from "../info-modal/index.js";
import { isWalletCapable, openWalletDeepLink } from "../wc-store.js";
import { attachWalletConnectSession } from "../wc-session.js";
import { createConnectStore } from "./state.js";
import { CONNECTING_VARIANT } from "./constants.js";
import { renderListView } from "./views/list.js";
import { renderQrView } from "./views/qr.js";
import { renderConnectingView } from "./views/connecting.js";
import { renderErrorView } from "./views/error.js";
import { renderCanceledView } from "./views/canceled.js";
import { loadWagmiClient } from "../wagmi-client.js";

const DEBUG = Boolean(window?.suWeb3?.debug);
const log = (...args) => {
  if (DEBUG) console.debug("[wallet-connect]", ...args);
};

export function createConnectController(shell) {
  const store = createConnectStore();
  let wagmi = null;
  let connectors = [];
  let accountUnsubscribe = null;
  let resolver = null;
  let visible = false;
  let networkSwitchPromise = null;

  const render = () => {
    if (!shell?.content) return;
    const state = store.getState();

    switch (state.view) {
      case "qr":
        shell.setBackHandler(() => {
          store.setState({ view: "list", qrUri: "", copied: false });
        });
        renderQrView(shell.content, state, {
          onCopy: () => {
            if (state.qrUri) {
              navigator.clipboard.writeText(state.qrUri).then(() => setCopied(true));
            }
          },
          onOpenWallet: () => openWalletDeepLink(state.qrUri, { userInitiated: true }),
        });
        break;
      case "connecting":
        shell.setBackHandler(null);
        renderConnectingView(shell.content, {
          variant: state.connectingVariant || CONNECTING_VARIANT.DEFAULT,
          hasUri: Boolean(state.qrUri),
          onCancel: () => finalize(null),
          onOpenWallet: () => openWalletDeepLink(state.qrUri, { userInitiated: true }),
          onShowQr: () => store.setState({ view: "qr" }),
        });
        break;
      case "error":
        shell.setBackHandler(null);
        renderErrorView(shell.content, {
          message: state.errorMessage,
          onBack: () => store.setState({ view: "list", errorMessage: "" }),
        });
        break;
      case "canceled":
        shell.setBackHandler(null);
        renderCanceledView(shell.content, () => store.setState({ view: "list" }));
        break;
      case "list":
      default:
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

  const autoSwitchIfUnsupported = () => {
    if (networkSwitchPromise) return networkSwitchPromise;
    networkSwitchPromise = attemptNetworkSwitch(wagmi).catch(() => false);
    return networkSwitchPromise;
  };

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
    networkSwitchPromise = null;
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
    let removeDisplayListener = null;
    try {
      const isWalletConnect = connector.id === "walletConnect";
      const mobileCapable = isWalletCapable();

      if (isWalletConnect) {
        const provider = await connector.getProvider();
        if (provider) {
          removeDisplayListener = attachWalletConnectSession(provider, {
            mobileCapable,
            onDisplayUri: (uri) => {
              setQr(uri);
              if (mobileCapable) {
                setConnectingVariant(CONNECTING_VARIANT.WALLETCONNECT);
                setView("connecting");
              } else {
                setConnectingVariant(CONNECTING_VARIANT.DEFAULT);
                setView("qr");
              }
            },
          });
        }
        setConnectingVariant(mobileCapable ? CONNECTING_VARIANT.WALLETCONNECT : CONNECTING_VARIANT.DEFAULT);
        setView(mobileCapable ? "connecting" : "qr");
      } else {
        setConnectingVariant(CONNECTING_VARIANT.DEFAULT);
        setView("connecting");
      }

      await wagmi.connect({ connector });
      const account = wagmi.getAccount();
      if (account?.isConnected) {
        await autoSwitchIfUnsupported();
        finalize(wagmi.getAccount());
      } else {
        finalize(null);
      }
    } catch (error) {
      log("connect error", error);
      const message = typeof error?.message === "string" ? error.message : "";
      if (message.includes("User rejected") || message.includes("User denied")) {
        setView("canceled");
      } else {
        setError(message || "Connection failed");
      }
    } finally {
      removeDisplayListener?.();
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
        autoSwitchIfUnsupported()
          .catch(() => false)
          .finally(() => finalize(wagmi.getAccount()));
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
