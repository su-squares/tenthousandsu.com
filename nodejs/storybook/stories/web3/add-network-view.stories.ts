import type { Meta, StoryObj } from "@storybook/html";
import "@assets/web3/wallet/base/modal-shell.css";
import "@assets/web3/wallet/account-modal/account-modal.css";
import { ChainKey, NETWORK_PRESETS } from "@assets/web3/config/networks.js";
import { createModalShell } from "@assets/web3/wallet/base/modal-shell.js";
import { renderAddNetworkView } from "@assets/web3/wallet/account-modal/add-network-view.js";

type NetworkKey = ChainKey | "custom";

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

const networkMap: Record<NetworkKey, typeof NETWORK_PRESETS[ChainKey.MAINNET]> = {
  [ChainKey.MAINNET]: NETWORK_PRESETS[ChainKey.MAINNET],
  [ChainKey.SEPOLIA]: NETWORK_PRESETS[ChainKey.SEPOLIA],
  [ChainKey.SUNET]: NETWORK_PRESETS[ChainKey.SUNET],
  custom: customNetwork as any,
};

const meta: Meta<AddNetworkStoryArgs> = {
  title: "Web3/AddNetworkView",
  tags: ["autodocs"],
  args: {
    networkKey: ChainKey.MAINNET,
  },
  argTypes: {
    networkKey: {
      control: { type: "inline-radio" },
      options: [ChainKey.MAINNET, ChainKey.SEPOLIA, ChainKey.SUNET, "custom"],
    },
  },
};

export default meta;

type Story = StoryObj<AddNetworkStoryArgs>;

const addNetworkShellId = "sb-add-network-shell";
let addNetworkShell: ReturnType<typeof createModalShell> | null = null;

function getAddNetworkShell() {
  if (!addNetworkShell) {
    addNetworkShell = createModalShell({
      id: addNetworkShellId,
    });
  }
  return addNetworkShell;
}

export const StubbedAddNetworkView: Story = {
  render: () => `
    <div
      id="sb-account-add-network-root"
      style="min-height: 360px; display:flex; justify-content:center; padding:1rem;"
    ></div>
  `,
  play: async ({ args }) => {
    const shell = getAddNetworkShell();
    shell.hide();
    const root = shell.content;
    root.innerHTML = "";

    renderAddNetworkView(root, {
      activeNetwork: networkMap[args.networkKey],
      onDisconnect: () => {
        // eslint-disable-next-line no-console
        console.log("Storybook: disconnect from add network view");
      },
    });

    shell.show();
  },
};
