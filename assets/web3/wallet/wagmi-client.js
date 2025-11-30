/**
 * Lightweight wagmi + viem loader for the browser.
 * Dynamically imports only the pieces we need and returns a cached client bundle.
 * @module wagmi-client
 */
import { walletConnectProjectId, enableSepolia } from "../config.js";

const DEBUG = Boolean(window?.suWeb3?.debug);
const log = (...args) => {
  if (DEBUG) console.debug("[wagmi-loader]", ...args);
};

const BUNDLE_URL = "/assets/web3/vendor/wagmi-bundle.js";

/** Mainnet chain id used for network guards. */
export const MAINNET_CHAIN_ID = 1;
export const SEPOLIA_CHAIN_ID = 11155111;

let wagmiPromise = null;

function ensureProcessEnv() {
  if (!window.process) {
    window.process = { env: { NODE_ENV: "production" } };
    return;
  }
  if (!window.process.env) {
    window.process.env = { NODE_ENV: "production" };
    return;
  }
  if (!window.process.env.NODE_ENV) {
    window.process.env.NODE_ENV = "production";
  }
}

/**
 * @returns {Promise<{
 *   config: import("@wagmi/core").Config,
 *   chains: Array<import("viem/chains").Chain>,
 *   connectors: Array<import("@wagmi/core").Connector>,
 *   watchAccount: typeof import("@wagmi/core").watchAccount,
 *   watchNetwork: typeof import("@wagmi/core").watchNetwork,
 *   connect: typeof import("@wagmi/core").connect,
 *   disconnect: typeof import("@wagmi/core").disconnect,
 *   fetchBalance: typeof import("@wagmi/core").fetchBalance,
 *   fetchEnsName: typeof import("@wagmi/core").fetchEnsName,
 *   fetchEnsAvatar: typeof import("@wagmi/core").fetchEnsAvatar,
 *   switchNetwork: typeof import("@wagmi/core").switchNetwork,
 *   writeContract: typeof import("@wagmi/core").writeContract,
 *   waitForTransaction: typeof import("@wagmi/core").waitForTransaction,
 *   getNetwork: typeof import("@wagmi/core").getNetwork,
 *   getAccount: typeof import("@wagmi/core").getAccount,
 *   WalletConnectConnector: typeof import("@wagmi/core/connectors/walletConnect").WalletConnectConnector,
 * }>}
 */
export async function loadWagmiClient() {
  if (wagmiPromise) return wagmiPromise;

  wagmiPromise = (async () => {
    ensureProcessEnv();

    const core = await import(BUNDLE_URL);
    log("loaded bundle", core);

    const {
      configureChains,
      createConfig,
      InjectedConnector,
      watchAccount,
      watchNetwork,
      connect,
      disconnect,
      fetchBalance,
      fetchEnsName,
      fetchEnsAvatar,
      switchNetwork,
      writeContract,
      waitForTransaction,
      getNetwork,
      getAccount,
      mainnet,
      sepolia,
      publicProvider,
      WalletConnectConnector,
      http,
    } = core;

    const chainList = enableSepolia ? [mainnet, sepolia] : [mainnet];
    const { chains, publicClient, webSocketPublicClient } = configureChains(
      chainList,
      [publicProvider()]
    );

    const metadata = {
      name: "Su Squares",
      description: "Su Squares wallet connection",
      url: window.location.origin,
      icons: [`${window.location.origin}/assets/images/ethereum_logo.png`],
    };

    const connectors = [
      new InjectedConnector({
        chains,
        options: {
          name: (detected) => detected?.name || "Browser Wallet",
          shimDisconnect: true,
        },
      }),
      new WalletConnectConnector({
        chains,
        options: {
          projectId: walletConnectProjectId,
          showQrModal: false,
          metadata,
        },
      }),
    ];

    const config = createConfig({
      autoConnect: true,
      connectors,
      publicClient,
      webSocketPublicClient,
      // transports: { [chain.id]: http(chain.rpcUrls.public.http[0]) } is not needed because configureChains builds clients.
    });

    return {
      config,
      chains,
      connectors,
      watchAccount,
      watchNetwork,
      connect,
      disconnect,
      fetchBalance,
      fetchEnsName,
      fetchEnsAvatar,
      switchNetwork,
      writeContract,
      waitForTransaction,
      getNetwork,
      getAccount,
      WalletConnectConnector,
      http,
    };
  })();

  return wagmiPromise;
}

/**
 * @param {string} address
 * @returns {string}
 */
export function truncateAddress(address) {
  if (!address) return "";
  return `${address.slice(0, 6)}\u2026${address.slice(-4)}`;
}
