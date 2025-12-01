import { isWalletCapable, openWalletDeepLink, rememberTopic, rememberUri } from "./wc-store.js";

/**
 * Wire WalletConnect provider display_uri events to shared session storage and optional deep links.
 * @param {import("@walletconnect/ethereum-provider").EthereumProvider | { on: Function, removeListener?: Function, off?: Function }} provider
 * @param {Object} [options]
 * @param {boolean} [options.mobileCapable]
 * @param {(uri: string) => void} [options.onDisplayUri]
 * @param {(uri: string) => void} [options.onDeepLinkAttempt]
 * @returns {() => void} cleanup function
 */
export function attachWalletConnectSession(provider, options = {}) {
  if (!provider || typeof provider.on !== "function") return () => {};
  const mobileCapable = options.mobileCapable ?? isWalletCapable();

  const handleDisplayUri = (uri) => {
    const stored = rememberUri(uri);
    rememberTopic(stored.topic);
    options.onDisplayUri?.(stored.uri);
    if (mobileCapable) {
      const opened = openWalletDeepLink(stored.uri, { userInitiated: false });
      if (opened) {
        options.onDeepLinkAttempt?.(stored.uri);
      }
    }
  };

  provider.on("display_uri", handleDisplayUri);

  return () => {
    try {
      if (typeof provider.removeListener === "function") {
        provider.removeListener("display_uri", handleDisplayUri);
      } else if (typeof provider.off === "function") {
        provider.off("display_uri", handleDisplayUri);
      }
    } catch (_error) {
      /* ignore cleanup errors */
    }
  };
}
