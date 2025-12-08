import type { Meta, StoryObj } from "@storybook/html";
import "@assets/css/main.css";
import "@assets/nav-menu/nav.css";

interface ConnectButtonStoryArgs {
  connected: boolean;
  includeEns: boolean;
  ensName: string;
  animateEns: boolean;
  address: string;
}

const meta: Meta<ConnectButtonStoryArgs> = {
  title: "Web3/Connect Button",
  tags: ["autodocs"],
  args: {
    connected: true,
    includeEns: true,
    ensName: "storytime.eth",
    animateEns: true,
    address: "0x5f2b8a9f1e284f02d90a6b7f34c6d8c72f2e38f5",
  },
  argTypes: {
    connected: { control: { type: "boolean" } },
    includeEns: { control: { type: "boolean" } },
    ensName: { control: { type: "text" } },
    animateEns: { control: { type: "boolean" } },
    address: { control: { type: "text" } },
  },
};

const truncateAddress = (address: string) => {
  if (!address) return "";
  const normalized = address.startsWith("0x") ? address : `0x${address}`;
  if (normalized.length <= 10) return normalized;
  return `${normalized.slice(0, 6)}…${normalized.slice(-4)}`;
};

function buildButtonLabel(args: ConnectButtonStoryArgs) {
  if (!args.connected) return "Connect<br>Wallet";
  const base = truncateAddress(args.address);
  const label = args.includeEns && args.ensName ? args.ensName : base;
  const animatedClass =
    args.includeEns && args.animateEns ? "su-nav-connect-label--fade" : "";
  return `Connected:<br><span class="su-nav-connect-label ${animatedClass}" style="line-height:1;">${label}</span>`;
}

export default meta;

type Story = StoryObj<ConnectButtonStoryArgs>;

export const ConnectedButton: Story = {
  render: (args) => `
    <div
      style="
        min-height: 220px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: transparent;
      "
    >
      <button
        id="sb-connect-button"
        type="button"
        class="btn su-nav-connect"
        aria-label="Connect wallet"
        style="line-height:1; padding-bottom: 10px; padding-top: 0;"
      >
        ${buildButtonLabel(args)}
      </button>
    </div>
  `,
};
