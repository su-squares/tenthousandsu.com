/**
 * Lightweight wagmi + viem loader for the browser.
 * Dynamically imports only the pieces we need and returns a cached client bundle.
 * @module wagmi-client
 */
import { walletConnectProjectId, enableSepolia } from "../config.js";
import { waitForProviders, startEIP6963Discovery } from "./eip6963.js";

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

// Start discovery early
startEIP6963Discovery();

/**
 * @typedef {Object} ConnectorWithMeta
 * @property {string} id
 * @property {string} name
 * @property {string} [icon] - Icon URL or data URI
 * @property {string} [uuid] - EIP-6963 UUID if applicable
 * @property {Function} getProvider
 * @property {Function} connect
 */

/**
 * @returns {Promise<{
 *   config: import("@wagmi/core").Config,
 *   chains: Array<import("viem/chains").Chain>,
 *   connectors: Array<ConnectorWithMeta>,
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

    const [core, eip6963Providers] = await Promise.all([
      import(BUNDLE_URL),
      waitForProviders(400),
    ]);

    log("loaded bundle", core);
    log("EIP-6963 providers:", eip6963Providers.size);

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
    } = core;

    const mainnetRpc = [
      "https://eth.llamarpc.com",
      "https://rpc.ankr.com/eth",
      "https://ethereum.publicnode.com",
      "https://cloudflare-eth.com",
    ];
    const sepoliaRpc = [
      "https://ethereum-sepolia.publicnode.com",
      "https://rpc.sepolia.org",
    ];

    const withRpcUrls = (chain, urls) => ({
      ...chain,
      rpcUrls: {
        ...chain.rpcUrls,
        default: { ...chain.rpcUrls.default, http: urls },
        public: { ...chain.rpcUrls.public, http: urls },
      },
    });

    const mainnetChain = withRpcUrls(mainnet, mainnetRpc);
    const sepoliaChain = enableSepolia ? withRpcUrls(sepolia, sepoliaRpc) : null;
    const chainList = enableSepolia
      ? [mainnetChain, sepoliaChain].filter(Boolean)
      : [mainnetChain];

    const { chains, publicClient, webSocketPublicClient } = configureChains(chainList, [
      publicProvider(),
    ]);

    const metadata = {
      name: "Su Squares",
      description: "Su Squares wallet connection",
      url: window.location.origin,
      icons: [`${window.location.origin}/assets/images/ethereum_logo.png`],
    };

    // Build connectors array
    const connectors = [];

    // Create a connector for each EIP-6963 provider
    for (const [uuid, { info, provider }] of eip6963Providers) {
      const connector = new InjectedConnector({
        chains,
        options: {
          getProvider: () => provider,
          name: info.name,
          shimDisconnect: true,
        },
      });

      // Attach metadata for the UI
      connector._eip6963 = {
        uuid,
        name: info.name,
        icon: info.icon,
        rdns: info.rdns,
      };

      connectors.push(connector);
      log("Added EIP-6963 connector:", info.name);
    }

    // Fallback: if no EIP-6963 providers but window.ethereum exists, add legacy connector
    if (connectors.length === 0 && window.ethereum) {
      log("No EIP-6963 providers, falling back to window.ethereum");
      const legacyConnector = new InjectedConnector({
        chains,
        options: {
          name: (detected) => detected?.name || "Browser Wallet",
          shimDisconnect: true,
        },
      });
      connectors.push(legacyConnector);
    }

    // Always add WalletConnect
    const wcConnector = new WalletConnectConnector({
      chains,
      options: {
        projectId: walletConnectProjectId,
        showQrModal: false,
        metadata,
        optionalChains: chains.map(({ id }) => id),
        rpcMap: Object.fromEntries(
          chains
            .map((chain) => {
              const first = chain.rpcUrls?.default?.http?.[0];
              return first ? [chain.id, first] : null;
            })
            .filter(Boolean)
        ),
      },
    });
    connectors.push(wcConnector);

    const config = createConfig({
      autoConnect: true,
      connectors,
      publicClient,
      webSocketPublicClient,
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