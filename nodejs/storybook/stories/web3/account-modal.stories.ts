import type { Meta, StoryObj } from "@storybook/html";
import "@assets/web3/wallet/base/modal-shell.css";
import "@assets/web3/wallet/account-modal/account-modal.css";
import { ChainKey, NETWORK_PRESETS } from "@assets/web3/config/networks.js";
import { createModalShell } from "@assets/web3/wallet/base/modal-shell.js";
import { renderAccountView } from "@assets/web3/wallet/account-modal/account-view.js";

type ChainKeyValue = (typeof ChainKey)[keyof typeof ChainKey];
type NetworkPreset = (typeof NETWORK_PRESETS)[keyof typeof NETWORK_PRESETS];
type NetworkKey = ChainKeyValue | "custom";

interface AccountModalStoryArgs {
  accountConnected: boolean;
  accountAddress: string;
  networkKey: NetworkKey;
  includeEns: boolean;
  ensName: string;
  loadingEns: boolean;
  balanceState: "loaded" | "loading" | "missing";
  balanceFormatted: string;
  balanceSymbol: string;
  showRefreshButton: boolean;
}

interface AddNetworkStoryArgs {
  networkKey: NetworkKey;
}

const customNetwork = {
  key: "custom",
  chainId: 1337,
  label: "Custom Local Chain",
  explorerBaseUrl: "https://custom-explorer.test",
  defaultRpcUrls: ["https://custom.local:8545"],
  nativeCurrency: { symbol: "CUSTOM" },
};

const networkMap: Record<NetworkKey, NetworkPreset | typeof customNetwork> = {
  [ChainKey.MAINNET]: NETWORK_PRESETS[ChainKey.MAINNET],
  [ChainKey.SEPOLIA]: NETWORK_PRESETS[ChainKey.SEPOLIA],
  [ChainKey.SUNET]: NETWORK_PRESETS[ChainKey.SUNET],
  custom: customNetwork,
};

const wagmiClientStub = {
  async disconnect() {
    return Promise.resolve();
  },
};

const meta: Meta<AccountModalStoryArgs> = {
  title: "Web3/AccountModal",
  tags: ["autodocs"],
  args: {
    accountConnected: true,
    accountAddress: "0x5f2b8a9f1e284f02d90a6b7f34c6d8c72f2e38f5",
    networkKey: ChainKey.MAINNET as ChainKeyValue,
    includeEns: true,
    ensName: "storytime.eth",
    loadingEns: false,
    balanceState: "loaded",
    balanceFormatted: "4,200.00",
    balanceSymbol: "ETH",
    showRefreshButton: false,
  },
  argTypes: {
    networkKey: {
      control: { type: "inline-radio" },
      options: [ChainKey.MAINNET, ChainKey.SEPOLIA, ChainKey.SUNET, "custom"],
    },
    includeEns: {
      control: { type: "boolean" },
      description: "Show an ENS above the address",
    },
    loadingEns: {
      control: { type: "boolean" },
      description: "Simulate ENS lookup in progress",
    },
    balanceState: {
      control: { type: "select" },
      options: ["loaded", "loading", "missing"],
      description: "Toggle between a successful balance fetch, loading state, or failure",
    },
    showRefreshButton: {
      control: { type: "boolean" },
      description: "Expose the balance refresh button",
    },
  },
};

export default meta;

type AccountStory = StoryObj<AccountModalStoryArgs>;
type AddNetworkStory = StoryObj<AddNetworkStoryArgs>;

function ensureClipboard() {
  if (typeof navigator === "undefined") return;
  if ("clipboard" in navigator) return;
  (navigator as any).clipboard = {
    writeText: () => Promise.resolve(),
  };
}

function getActiveNetwork(key: NetworkKey) {
  return networkMap[key];
}

function buildBalance(args: AccountModalStoryArgs) {
  if (args.balanceState === "loaded") {
    return {
      formatted: args.balanceFormatted,
      symbol: args.balanceSymbol,
    };
  }
  return null;
}

function getLoadingBalance(args: AccountModalStoryArgs) {
  return args.balanceState === "loading";
}

const accountShellRootId = "sb-account-modal-shell";
let accountShell: ReturnType<typeof createModalShell> | null = null;

function getAccountShell() {
  if (!accountShell) {
    accountShell = createModalShell({
      id: accountShellRootId,
    });
  }
  return accountShell;
}

export const StubbedAccountView: AccountStory = {
  render: () => `
    <div
      id="sb-account-modal-root"
      style="min-height: 360px; display:flex; justify-content:center; padding:1rem;"
    ></div>
  `,
  play: async ({ args }) => {
    ensureClipboard();
    const shell = getAccountShell();
    shell.hide();
    const root = shell.content;
    root.innerHTML = "";

    const account = args.accountConnected
      ? { address: args.accountAddress }
      : null;

    renderAccountView(root, {
      account,
      ensName: args.includeEns ? args.ensName : null,
      balance: buildBalance(args),
    }, {
      activeNetwork: getActiveNetwork(args.networkKey),
      presets: {
        mainnet: NETWORK_PRESETS[ChainKey.MAINNET].chainId,
        sepolia: NETWORK_PRESETS[ChainKey.SEPOLIA].chainId,
      },
      wagmiClient: wagmiClientStub,
      onDisconnect: () => {
        // eslint-disable-next-line no-console
        console.log("Storybook: disconnect clicked");
      },
      onRefresh: args.showRefreshButton
        ? async () => {
            // eslint-disable-next-line no-console
            console.log("Storybook: refresh triggered");
          }
        : undefined,
      loadingEns: args.loadingEns,
      loadingBalance: getLoadingBalance(args),
    });
    shell.show();
  },
};
