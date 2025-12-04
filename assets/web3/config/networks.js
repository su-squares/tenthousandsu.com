export const ChainKey = {
  MAINNET: "mainnet",
  SEPOLIA: "sepolia",
  SUNET: "sunet",
};

export const DEFAULT_CHAIN = ChainKey.MAINNET;

export const NETWORK_PRESETS = {
  [ChainKey.MAINNET]: {
    key: ChainKey.MAINNET,
    chainId: 1,
    label: "Ethereum Mainnet",
    explorerBaseUrl: "https://etherscan.io",
    explorerTxPath: "/tx/",
    defaultRpcUrls: [
      "https://eth.llamarpc.com",
      "https://ethereum.publicnode.com",
      "https://cloudflare-eth.com",
    ],
    isTestnet: false,
  },
  [ChainKey.SEPOLIA]: {
    key: ChainKey.SEPOLIA,
    chainId: 11155111,
    label: "Sepolia",
    explorerBaseUrl: "https://sepolia.etherscan.io",
    explorerTxPath: "/tx/",
    defaultRpcUrls: [
      "https://ethereum-sepolia.publicnode.com",
      "https://rpc.sepolia.org",
    ],
    isTestnet: true,
  },
  [ChainKey.SUNET]: {
    key: ChainKey.SUNET,
    chainId: 1337,
    label: "Sunet",
    explorerBaseUrl: "http://localhost:4001",
    explorerTxPath: "/tx/",
    defaultRpcUrls: ["http://127.0.0.1:8545"],
    isTestnet: true,
  },
};

export function normalizeChainKey(value) {
  if (!value) return DEFAULT_CHAIN;
  const normalized = String(value).toLowerCase();
  if (normalized === ChainKey.MAINNET) return ChainKey.MAINNET;
  if (normalized === ChainKey.SEPOLIA) return ChainKey.SEPOLIA;
  if (normalized === ChainKey.SUNET) return ChainKey.SUNET;
  return DEFAULT_CHAIN;
}
