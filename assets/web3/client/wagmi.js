/**
 * Lightweight wagmi + viem loader for the browser.
 * Dynamically imports only the pieces we need and returns a cached client bundle.
 * @module wagmi-client
 */
import { getWeb3Config, ChainKey, NETWORK_PRESETS } from "../config/index.js";
import { createDebugLogger } from "../config/logger.js";
import { waitForProviders, startEIP6963Discovery } from "../wallet/eip6963.js";

const log = createDebugLogger("wagmi-loader");
const BUNDLE_URL = "/assets/web3/vendor/wagmi-bundle.js";

export const MAINNET_CHAIN_ID = NETWORK_PRESETS[ChainKey.MAINNET].chainId;
export const SEPOLIA_CHAIN_ID = NETWORK_PRESETS[ChainKey.SEPOLIA].chainId;

let wagmiCache = { chainKey: null, promise: null };

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

function withRpcUrls(chain, urls) {
  return {
    ...chain,
    rpcUrls: {
      ...chain.rpcUrls,
      default: { ...chain.rpcUrls.default, http: urls },
      public: { ...chain.rpcUrls.public, http: urls },
    },
  };
}

function buildChains(core, activeNetwork, networks) {
  const mainnetChain = withRpcUrls(core.mainnet, networks[ChainKey.MAINNET].rpcUrls);

  if (activeNetwork.key === ChainKey.MAINNET) {
    return [mainnetChain];
  }

  if (activeNetwork.key === ChainKey.SEPOLIA) {
    const sepoliaChain = withRpcUrls(core.sepolia, networks[ChainKey.SEPOLIA].rpcUrls);
    return [sepoliaChain, mainnetChain];
  }

  if (activeNetwork.key === ChainKey.SUNET) {
    const sunet = networks[ChainKey.SUNET];
    const rpcUrls = sunet.rpcUrls || [];
    const explorer = sunet.explorerBaseUrl ? sunet.explorerBaseUrl.replace(/\/$/, "") : null;
    const sunetChain = {
      id: sunet.chainId,
      name: sunet.label || "Sunet",
      network: "sunet",
      nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
      rpcUrls: {
        default: { http: rpcUrls },
        public: { http: rpcUrls },
      },
      blockExplorers: explorer ? { default: { name: "Block Explorer", url: explorer } } : undefined,
      testnet: true,
    };
    return [sunetChain, mainnetChain];
  }

  return [mainnetChain];
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
  const appConfig = getWeb3Config();
  if (wagmiCache.promise && wagmiCache.chainKey === appConfig.chain) {
    return wagmiCache.promise;
  }

  wagmiCache = {
    chainKey: appConfig.chain,
    promise: (async () => {
      ensureProcessEnv();

      const [core, eip6963Providers] = await Promise.all([import(BUNDLE_URL), waitForProviders(400)]);

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
        publicProvider,
        WalletConnectConnector,
      } = core;

      const chainList = buildChains(core, appConfig.activeNetwork, appConfig.networks);
      const { chains, publicClient, webSocketPublicClient } = configureChains(chainList, [publicProvider()]);

      const metadata = {
        name: "Su Squares",
        description: "Su Squares wallet connection",
        url: window.location.origin,
        icons: [`${window.location.origin}/assets/images/ethereum_logo.png`],
      };

      const connectors = [];

      for (const [uuid, { info, provider }] of eip6963Providers) {
        const connector = new InjectedConnector({
          chains,
          options: {
            getProvider: () => provider,
            name: info.name,
            shimDisconnect: true,
          },
        });

        connector._eip6963 = {
          uuid,
          name: info.name,
          icon: info.icon,
          rdns: info.rdns,
        };

        connectors.push(connector);
        log("Added EIP-6963 connector:", info.name);
      }

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

      const wcConnector = new WalletConnectConnector({
        chains,
        options: {
          projectId: appConfig.walletConnectProjectId,
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
    })(),
  };

  return wagmiCache.promise;
}

export function truncateAddress(address) {
  if (!address) return "";
  return `${address.slice(0, 6)}\u2026${address.slice(-4)}`;
}
