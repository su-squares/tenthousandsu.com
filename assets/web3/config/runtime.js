import { ChainKey, DEFAULT_CHAIN, NETWORK_PRESETS, normalizeChainKey } from "./networks.js";

const DEFAULT_WALLETCONNECT_PROJECT_ID = "2aca272d18deb10ff748260da5f78bfd";

function parseBool(value, fallback = false) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["1", "true", "yes", "on"].includes(normalized)) return true;
    if (["0", "false", "no", "off"].includes(normalized)) return false;
  }
  return fallback;
}

function parseIntish(value, fallback) {
  if (typeof value === "number" && Number.isFinite(value)) return Math.trunc(value);
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function parseFloatish(value, fallback) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function readWindowConfig() {
  if (typeof window === "undefined") return {};
  return window.suWeb3 || window.SU_WEB3 || {};
}

function normalizeAssetBases(raw) {
  const bases = raw && typeof raw === "object" ? raw : {};
  const baseurl = window.SITE_BASEURL || '';
  const pick = (key, fallback) => {
    const val = bases[key];
    const path = (val && typeof val === "string") ? val : fallback;
    // Prepend baseurl if path doesn't already include it
    if (baseurl && !path.startsWith(baseurl)) {
      return baseurl + path;
    }
    return path;
  };
  return {
    [ChainKey.MAINNET]: pick(ChainKey.MAINNET, "/build"),
    [ChainKey.SEPOLIA]: pick(ChainKey.SEPOLIA, "/build-sepolia"),
    [ChainKey.SUNET]: pick(ChainKey.SUNET, "/build-sunet"),
  };
}

function normalizePricing(raw) {
  const pricing = raw && typeof raw === "object" ? raw : {};
  return {
    mintPriceEth: parseFloatish(pricing.mintPriceEth, 0.5),
    personalizePriceEth: parseFloatish(pricing.personalizePriceEth, 0.001),
  };
}

/**
 * Resolve runtime flags from the browser (window.suWeb3) with sane defaults.
 * @returns {{
 *   chain: string,
 *   debug: boolean,
 *   walletConnectProjectId: string,
 *   addresses: Record<string, { primary?: string|null, underlay?: string|null }>,
 *   assetBases: Record<string, string>,
 *   overrides: { sunetChainId?: number, sunetExplorerBaseUrl?: string, sunetRpcUrls?: string[] },
 *   pricing: { mintPriceEth: number, personalizePriceEth: number }
 * }}
 */
export function getRuntimeFlags() {
  const raw = readWindowConfig();
  const chain = normalizeChainKey(raw.chain || raw.CHAIN || raw.network || raw.NETWORK || DEFAULT_CHAIN);
  const debug = parseBool(raw.debug ?? raw.DEBUG, false);
  const walletConnectProjectId =
    raw.walletConnectProjectId || raw.WALLETCONNECT_PROJECT_ID || DEFAULT_WALLETCONNECT_PROJECT_ID;
  const assetBases = normalizeAssetBases(raw.assetBases);

  const addresses = {
    [ChainKey.MAINNET]: {
      primary: raw.mainnetPrimaryAddress || raw.MAINNET_PRIMARY_ADDRESS,
      underlay: raw.mainnetUnderlayAddress || raw.MAINNET_UNDERLAY_ADDRESS,
    },
    [ChainKey.SEPOLIA]: {
      primary: raw.sepoliaPrimaryAddress || raw.SEPOLIA_PRIMARY_ADDRESS,
      underlay: raw.sepoliaUnderlayAddress || raw.SEPOLIA_UNDERLAY_ADDRESS,
    },
    [ChainKey.SUNET]: {
      primary: raw.sunetPrimaryAddress || raw.SUNET_PRIMARY_ADDRESS,
      underlay: raw.sunetUnderlayAddress || raw.SUNET_UNDERLAY_ADDRESS,
    },
  };

  const sunetChainId = parseIntish(raw.sunetChainId || raw.SUNET_CHAIN_ID, NETWORK_PRESETS[ChainKey.SUNET].chainId);
  const sunetExplorerBaseUrl =
    raw.sunetBlockExplorerUrl || raw.SUNET_BLOCK_EXPLORER_URL || NETWORK_PRESETS[ChainKey.SUNET].explorerBaseUrl;
  const sunetRpcUrl =
    raw.sunetRpcUrl || raw.SUNET_RPC_URL || NETWORK_PRESETS[ChainKey.SUNET].defaultRpcUrls?.[0];

  return {
    chain,
    debug,
    walletConnectProjectId,
    assetBases,
    addresses,
    overrides: {
      sunetChainId,
      sunetExplorerBaseUrl,
      sunetRpcUrls: [sunetRpcUrl].filter(Boolean),
    },
    pricing: normalizePricing(raw.pricing),
  };
}
