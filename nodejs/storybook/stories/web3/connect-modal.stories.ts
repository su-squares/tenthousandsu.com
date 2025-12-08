import type { Meta, StoryObj } from "@storybook/html";
import "@assets/web3/wallet/base/modal-shell.css";
import "@assets/web3/wallet/connect-modal/views/list.css";
import "@assets/web3/wallet/connect-modal/views/connecting.css";
import "@assets/web3/wallet/connect-modal/views/error.css";
import "@assets/web3/wallet/connect-modal/views/qr.css";
import "@assets/web3/wallet/connect-modal/views/canceled.css";
import { createModalShell } from "@assets/web3/wallet/base/modal-shell.js";
import { renderListView } from "@assets/web3/wallet/connect-modal/views/list.js";
import { renderConnectingView } from "@assets/web3/wallet/connect-modal/views/connecting.js";
import { renderErrorView } from "@assets/web3/wallet/connect-modal/views/error.js";
import { renderCanceledView } from "@assets/web3/wallet/connect-modal/views/canceled.js";
import { renderQrView } from "@assets/web3/wallet/connect-modal/views/qr.js";
import { CONNECTING_VARIANT } from "@assets/web3/wallet/connect-modal/constants.js";
import { openInfoModal } from "@assets/web3/wallet/info-modal/index.js";

type ConnectorsPreset = "default" | "minimal" | "walletConnectOnly";
type ConnectModalView = "list" | "connecting" | "qr" | "error" | "canceled";

interface ConnectModalStoryArgs {
  connectorsPreset?: ConnectorsPreset;
  connectingVariant?: typeof CONNECTING_VARIANT[keyof typeof CONNECTING_VARIANT];
  hasUri?: boolean;
  qrUri?: string;
  copied?: boolean;
  errorMessage?: string;
}

const meta: Meta = {
  title: "Web3/ConnectModal Views",
  tags: ["autodocs"],
};

const shellId = "sb-connect-modal-shell";
const connectShell = createModalShell({ id: shellId });

const defaultArgs: Required<ConnectModalStoryArgs> = {
  connectorsPreset: "default",
  connectingVariant: CONNECTING_VARIANT.DEFAULT,
  hasUri: true,
  qrUri: "wc:example@1?bridge=https%3A%2F%2Fbridge.walletconnect.org&key=123",
  copied: false,
  errorMessage: "Something went wrong while connecting.",
};

const iconsBase = () =>
  typeof window !== "undefined" ? `${window.location.origin}${window.SITE_BASEURL || ""}` : "";

function buildConnectors(preset: ConnectorsPreset) {
  const base = iconsBase();
  const icons = {
    ethereum: `${base}/assets/images/ethereum_logo.png`,
    wallet: `${base}/assets/images/logo-su-squares.png`,
  };
  const list = [
    {
      id: "metaMask",
      name: "MetaMask",
      ready: true,
      icon: icons.ethereum,
    },
    {
      id: "walletConnect",
      name: "WalletConnect",
      ready: true,
      icon: icons.wallet,
    },
    {
      id: "rainbow",
      ready: true,
      _eip6963: {
        uuid: "rainbow-1",
        name: "Rainbow",
        icon: icons.wallet,
      },
    },
  ];
  if (preset === "minimal") return list.slice(0, 1);
  if (preset === "walletConnectOnly") return [list[1]];
  return list;
}

function showConnectView(view: ConnectModalView, args: ConnectModalStoryArgs) {
  const shell = connectShell;
  shell.hide();
  const target = shell.content;
  target.innerHTML = "";
  const resolvedArgs = { ...defaultArgs, ...args };

  switch (view) {
    case "connecting":
      shell.setAria({
        labelledBy: "wallet-connecting-title",
        describedBy: "wallet-connecting-helper",
      });
      shell.setBackHandler(null);
      renderConnectingView(target, {
        variant: resolvedArgs.connectingVariant,
        hasUri: resolvedArgs.hasUri,
        onCancel: () => shell.hide(),
        onOpenWallet: () => {
          // eslint-disable-next-line no-console
          console.log("Open wallet clicked");
        },
        onShowQr: () => showConnectView("qr", args),
      });
      break;
    case "qr":
      shell.setAria({
        labelledBy: "wallet-qr-title",
      });
      shell.setBackHandler(() => showConnectView("list", args));
      renderQrView(
        target,
        {
          qrUri: resolvedArgs.qrUri,
          copied: resolvedArgs.copied,
        },
        {
          onCopy: () => {
            // eslint-disable-next-line no-console
            console.log("Copy QR clicked");
          },
          onOpenWallet: () => {
            // eslint-disable-next-line no-console
            console.log("Open wallet from QR");
          },
        }
      );
      break;
    case "error":
      shell.setAria({
        labelledBy: "wallet-error-title",
        describedBy: "wallet-error-message",
      });
      shell.setBackHandler(null);
      renderErrorView(target, {
        message: resolvedArgs.errorMessage,
        onBack: () => showConnectView("list", args),
      });
      break;
    case "canceled":
      shell.setAria({
        labelledBy: "wallet-canceled-title",
        describedBy: "wallet-canceled-message",
      });
      shell.setBackHandler(null);
      renderCanceledView(target, () => showConnectView("list", args));
      break;
    case "list":
    default:
      shell.setAria({
        labelledBy: "wallet-connect-title",
        describedBy: "wallet-connect-helper",
      });
      shell.setBackHandler(null);
      renderListView(target, {
        connectors: buildConnectors(resolvedArgs.connectorsPreset),
        onSelect: (connector) => {
          // eslint-disable-next-line no-console
          console.log("Connector selected:", connector);
        },
        onOpenInfo: () => {
          let reopened = false;
          const reopen = () => {
            if (reopened) return;
            reopened = true;
            showConnectView("list", args);
          };
          shell.hide();
          openInfoModal(reopen).finally(reopen);
        },
      });
      break;
  }
  shell.show();
}

export default meta;

type ListStory = StoryObj<ConnectModalStoryArgs>;

export const ListView: ListStory = {
  args: {
    connectorsPreset: "default",
  },
  argTypes: {
    connectorsPreset: {
      control: { type: "inline-radio" },
      options: ["default", "minimal", "walletConnectOnly"],
    },
  },
  render: (args) => {
    showConnectView("list", args);
    return `<div style="min-height:1px;"></div>`;
  },
};

export const ConnectingView: ListStory = {
  args: {
    connectingVariant: CONNECTING_VARIANT.DEFAULT,
    hasUri: true,
  },
  argTypes: {
    connectingVariant: {
      control: { type: "inline-radio" },
      options: [CONNECTING_VARIANT.DEFAULT, CONNECTING_VARIANT.WALLETCONNECT],
    },
    hasUri: {
      control: { type: "boolean" },
    },
  },
  render: (args) => {
    showConnectView("connecting", args);
    return `<div style="min-height:1px;"></div>`;
  },
};

export const QrView: ListStory = {
  args: {
    qrUri: defaultArgs.qrUri,
    copied: false,
  },
  argTypes: {
    qrUri: {
      control: { type: "text" },
    },
    copied: {
      control: { type: "boolean" },
    },
  },
  render: (args) => {
    showConnectView("qr", args);
    return `<div style="min-height:1px;"></div>`;
  },
};

export const ErrorView: ListStory = {
  args: {
    errorMessage: defaultArgs.errorMessage,
  },
  argTypes: {
    errorMessage: {
      control: { type: "text" },
    },
  },
  render: (args) => {
    showConnectView("error", args);
    return `<div style="min-height:1px;"></div>`;
  },
};

export const CanceledView: ListStory = {
  render: () => {
    showConnectView("canceled", {});
    return `<div style="min-height:1px;"></div>`;
  },
};
