import type { Meta, StoryObj } from "@storybook/html";
import "@assets/css/main.css";
import "@assets/web3/tx/styles.css";
import { createTxFixture, createTxModal } from "@assets/web3/tx/index.js";

type Story = StoryObj;
type TxState = "idle" | "processing" | "pending" | "success" | "error";
type FixtureController = ReturnType<typeof createTxFixture>;
type ModalController = FixtureController & { hide: () => void; show: () => void };
const STORYBOOK_STORY_CHANGED_EVENT = "storyChanged";
type StorybookChannel = { on: (event: string, handler: () => void) => void };
type StorybookWindow = Window & { __STORYBOOK_ADDONS_CHANNEL__?: StorybookChannel };

const meta: Meta = {
  title: "Web3/Transaction Status",
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
  },
};

export default meta;

const FIXTURE_CONTAINER_ID = "sb-tx-fixture-container";
const DEFAULT_PRICING = {
  mintPriceEth: 0.5,
  personalizePriceEth: 0.005,
};
const STUB_ADDRESS = "0x5f2b8a9f1e284f02d90a6b7f34c6d8c72f2e38f5";
const STUB_CHAIN_ID = 1;

const SAMPLE_PENDING_TX = {
  hash: "0x3ef0bd44e321d49f0d879c84f474a87c7d8476fd807d7b893c912d0441dba91f",
  url: "https://etherscan.io/tx/0x3ef0bd44e321d49f0d879c84f474a87c7d8476fd807d7b893c912d0441dba91f",
};
const SAMPLE_CONFIRMED_TX = {
  hash: "0xa642c8d124c47a912bfd9f714a820dacc0d657f69bd346fccd173f7bb079b5ef",
  url: "https://etherscan.io/tx/0xa642c8d124c47a912bfd9f714a820dacc0d657f69bd346fccd173f7bb079b5ef",
};
const SAMPLE_FAILED_TX = {
  hash: "0xd1838ca9b7f4b6c9148f6529ccba542d38f9a369f8979f4e399735d4aacce02f",
  url: "https://etherscan.io/tx/0xd1838ca9b7f4b6c9148f6529ccba542d38f9a369f8979f4e399735d4aacce02f",
};

const DEFAULT_BALANCE = {
  formatted: "3.5123409871",
  symbol: "ETH",
};

let fixtureTarget: HTMLDivElement | null = null;
let fixtureController: FixtureController | null = null;
let modalController: ModalController | null = null;
let storyChangeRegistered = false;

function renderFixtureFrame() {
  return `
    <section
      style="
        min-height: 480px;
        padding: 2rem 1rem 3rem;
        display: flex;
        flex-direction: column;
        gap: 1.5rem;
        align-items: center;
        justify-content: flex-start;
      "
    >
      <article
        style="
          max-width: 520px;
          color: rgba(255, 255, 255, 0.85);
          font-size: 0.95rem;
        "
      >
        <strong>Fixture preview.</strong> The panel below is mounted inside a static container so
        you can inspect the default idle, processing, success, and error states without needing a wallet connection.
      </article>
      <div
        id="${FIXTURE_CONTAINER_ID}"
        style="width: min(520px, 100%);"
      ></div>
    </section>
  `;
}

function renderModalBlurb() {
  return `
    <section
      style="
        min-height: 260px;
        display: flex;
        align-items: center;
        justify-content: center;
        text-align: center;
        color: rgba(255, 255, 255, 0.85);
        padding: 2rem;
      "
    >
      <p style="max-width: 520px;">
        The transaction modal renders as a full-screen overlay so it matches production.
        Selecting a state in Storybook toggles the overlay in the viewport—close it with the built-in button
        or by clicking outside the card.
      </p>
    </section>
  `;
}

function ensureFixtureController() {
  if (typeof document === "undefined") return null;

  if (!fixtureTarget) {
    fixtureTarget = document.createElement("div");
    fixtureTarget.id = "sb-tx-fixture-target";
  }

  if (!fixtureController) {
    fixtureController = createTxFixture({
      target: fixtureTarget,
      pricing: DEFAULT_PRICING,
      mode: "mint",
      title: "Transaction status",
    });
  }

  return fixtureController;
}

function ensureModalController() {
  if (typeof document === "undefined") return null;

  if (!modalController) {
    modalController = createTxModal({
      pricing: DEFAULT_PRICING,
      mode: "mint",
      title: "Transaction status",
    }) as ModalController;
  }

  return modalController;
}

function hideModalOverlay() {
  modalController?.hide();
}

function registerStoryChangeCleanup() {
  if (storyChangeRegistered) return;
  if (typeof window === "undefined") return;

  const channel = (window as StorybookWindow).__STORYBOOK_ADDONS_CHANNEL__;
  if (!channel || typeof channel.on !== "function") {
    window.setTimeout(registerStoryChangeCleanup, 200);
    return;
  }

  channel.on(STORYBOOK_STORY_CHANGED_EVENT, hideModalOverlay);
  storyChangeRegistered = true;
}

if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", hideModalOverlay);
  registerStoryChangeCleanup();
}

async function seedBalance(controller: FixtureController, balance = DEFAULT_BALANCE) {
  await controller.setBalanceContext({
    address: STUB_ADDRESS,
    chainId: STUB_CHAIN_ID,
    fetcher: async () => ({
      formatted: balance.formatted,
      symbol: balance.symbol,
      decimals: 18,
      value: 0n,
    }),
  });
}

function setWalletButton(controller: FixtureController, visible: boolean) {
  controller.setWalletContext({
    hasSession: visible,
    isWalletConnect: visible,
  });
}

async function applyState(controller: FixtureController, state: TxState) {
  controller.reset();
  await seedBalance(controller);
  controller.setTitle("Su Squares transaction");

  switch (state) {
    case "processing":
      setWalletButton(controller, true);
      controller.startProcessing("Waiting for you to confirm in your wallet.");
      controller.setHelp("Keep your wallet open until you see at least one confirmation.");
      break;
    case "pending":
      setWalletButton(controller, true);
      controller.setMessage("Submitted. Waiting for confirmations.");
      controller.addPending(SAMPLE_PENDING_TX.hash, SAMPLE_PENDING_TX.url);
      controller.setHelp("Keep this tab open; we will refresh your balance after confirmation.");
      break;
    case "success":
      setWalletButton(controller, false);
      controller.addPending(SAMPLE_CONFIRMED_TX.hash, SAMPLE_CONFIRMED_TX.url);
      await controller.markSuccess(
        SAMPLE_CONFIRMED_TX.hash,
        SAMPLE_CONFIRMED_TX.url,
        "Mint confirmed on Ethereum mainnet.\n\nPersonalize immediately or mint again."
      );
      controller.setHelp("Head to personalize mode or mint another square.");
      break;
    case "error":
      setWalletButton(controller, true);
      controller.markError(
        "The network rejected this transaction. Bump gas a bit and try again.",
        SAMPLE_FAILED_TX.hash,
        SAMPLE_FAILED_TX.url
      );
      controller.setHelp("Clear this panel or retry from your wallet.");
      break;
    case "idle":
    default:
      setWalletButton(controller, false);
      controller.setHelp("Connect a wallet and choose mint or personalize to get started.");
      break;
  }
}

async function showFixtureState(state: TxState) {
  const controller = ensureFixtureController();
  if (!controller || !fixtureTarget) return;
  hideModalOverlay();

  const container = document.getElementById(FIXTURE_CONTAINER_ID);
  if (!container) return;

  container.innerHTML = "";
  container.appendChild(fixtureTarget);
  await applyState(controller, state);
}

async function showModalState(state: TxState) {
  const controller = ensureModalController();
  if (!controller) return;

  controller.hide();
  await applyState(controller, state);
  controller.show();
}

export const FixtureDefault: Story = {
  render: () => renderFixtureFrame(),
  play: async () => {
    await showFixtureState("idle");
  },
};

export const FixtureProcessing: Story = {
  render: () => renderFixtureFrame(),
  play: async () => {
    await showFixtureState("processing");
  },
};

export const FixturePending: Story = {
  render: () => renderFixtureFrame(),
  play: async () => {
    await showFixtureState("pending");
  },
};

export const FixtureSuccess: Story = {
  render: () => renderFixtureFrame(),
  play: async () => {
    await showFixtureState("success");
  },
};

export const FixtureError: Story = {
  render: () => renderFixtureFrame(),
  play: async () => {
    await showFixtureState("error");
  },
};

export const FixtureDisconnected: Story = {
  render: () => renderFixtureFrame(),
  play: async () => {
    const controller = ensureFixtureController();
    if (!controller || !fixtureTarget) return;
    hideModalOverlay();

    const container = document.getElementById(FIXTURE_CONTAINER_ID);
    if (!container) return;

    container.innerHTML = "";
    container.appendChild(fixtureTarget);

    controller.reset();
    await controller.setBalanceContext(null);
    setWalletButton(controller, false);
    controller.setHelp("Connect a wallet to see your balance and start a transaction.");
  },
};

export const ModalDefault: Story = {
  render: () => renderModalBlurb(),
  play: async () => {
    await showModalState("idle");
  },
};

export const ModalProcessing: Story = {
  render: () => renderModalBlurb(),
  play: async () => {
    await showModalState("processing");
  },
};

export const ModalPending: Story = {
  render: () => renderModalBlurb(),
  play: async () => {
    await showModalState("pending");
  },
};

export const ModalSuccess: Story = {
  render: () => renderModalBlurb(),
  play: async () => {
    await showModalState("success");
  },
};

export const ModalError: Story = {
  render: () => renderModalBlurb(),
  play: async () => {
    await showModalState("error");
  },
};
