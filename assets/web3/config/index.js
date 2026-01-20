import { resolveContractAddresses } from "./contracts.js";
import { getRuntimeFlags } from "./runtime.js";
import { ChainKey, DEFAULT_CHAIN, NETWORK_PRESETS, normalizeChainKey } from "./networks.js";

let cachedConfig = null;
let cachedSignature = null;

function buildSignature(flags) {
  try {
    return JSON.stringify(flags);
  } catch (_error) {
    return null;
  }
}

function buildNetworks(flags) {
  const sunetChainId = flags?.overrides?.sunetChainId || NETWORK_PRESETS[ChainKey.SUNET].chainId;
  const sunetExplorerBaseUrl =
    flags?.overrides?.sunetExplorerBaseUrl || NETWORK_PRESETS[ChainKey.SUNET].explorerBaseUrl;
  const sunetRpcUrls =
    (flags?.overrides?.sunetRpcUrls && flags.overrides.sunetRpcUrls.length > 0
      ? flags.overrides.sunetRpcUrls
      : NETWORK_PRESETS[ChainKey.SUNET].defaultRpcUrls) || [];

  return {
    [ChainKey.MAINNET]: {
      ...NETWORK_PRESETS[ChainKey.MAINNET],
      rpcUrls: NETWORK_PRESETS[ChainKey.MAINNET].defaultRpcUrls,
    },
    [ChainKey.SEPOLIA]: {
      ...NETWORK_PRESETS[ChainKey.SEPOLIA],
      rpcUrls: NETWORK_PRESETS[ChainKey.SEPOLIA].defaultRpcUrls,
    },
    [ChainKey.SUNET]: {
      ...NETWORK_PRESETS[ChainKey.SUNET],
      chainId: sunetChainId,
      explorerBaseUrl: sunetExplorerBaseUrl,
      rpcUrls: sunetRpcUrls,
    },
  };
}

/**
 * Return the resolved web3 configuration (memoized).
 * @returns {{
 *   chain: string,
 *   debug: boolean,
 *   walletConnectProjectId: string,
 *   networks: Record<string, { key: string, chainId: number, label: string, explorerBaseUrl?: string, explorerTxPath?: string, rpcUrls: string[] }>,
 *   activeNetwork: { key: string, chainId: number, label: string, explorerBaseUrl?: string, explorerTxPath?: string, rpcUrls: string[] },
 *   contracts: { primary: string, underlay: string },
 *   pricing: { mintPriceEth: number, personalizePriceEth: number },
 *   assetBases: Record<string, string>
 * }}
 */
export function getWeb3Config() {
  const flags = getRuntimeFlags();
  const signature = buildSignature(flags);

  if (cachedConfig && cachedSignature === signature) return cachedConfig;

  const chain = normalizeChainKey(flags.chain || DEFAULT_CHAIN);
  const networks = buildNetworks(flags);
  const activeNetwork = networks[chain] || networks[DEFAULT_CHAIN];
  const contracts = resolveContractAddresses(activeNetwork.key, flags.addresses);

  cachedConfig = {
    chain: activeNetwork.key,
    debug: Boolean(flags.debug),
    walletConnectProjectId: flags.walletConnectProjectId,
    networks,
    activeNetwork,
    contracts,
    pricing: flags.pricing,
    assetBases: flags.assetBases,
  };
  cachedSignature = signature;

  return cachedConfig;
}

export { ChainKey, DEFAULT_CHAIN, NETWORK_PRESETS } from "./networks.js";
