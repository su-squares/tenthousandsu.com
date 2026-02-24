import type { Meta, StoryObj } from "@storybook/html";
import "@assets/web3/wallet/base/modal-shell.css";
import "@assets/web3/wallet/info-modal/info-modal.css";
import { openInfoModal } from "@assets/web3/wallet/info-modal/index.js";

const meta: Meta = {
  title: "Web3/InfoModal",
  tags: ["autodocs"],
};

export default meta;

type Story = StoryObj;

export const AlwaysOpenInfo: Story = {
  render: () => `<div style="min-height:1px;"></div>`,
  play: async () => {
    await openInfoModal();
  },
};
