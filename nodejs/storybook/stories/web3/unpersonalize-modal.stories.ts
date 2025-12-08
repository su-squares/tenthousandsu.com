import type { Meta, StoryObj } from "@storybook/html";
import "@assets/css/main.css";
import "@assets/css/personalize.css";
import "@assets/web3/tx/styles.css";
import { createTxFixture } from "@assets/web3/tx/index.js";

type TxState = "idle" | "processing" | "success" | "error";
type StatusScenario = "eligible" | "emptyPayload" | "neverPersonalized";

interface UnpersonalizeModalStoryArgs {
  tokenId: number;
  scenario: StatusScenario;
  txState: TxState;
  walletConnected: boolean;
}

type Story = StoryObj<UnpersonalizeModalStoryArgs>;
type FixtureController = ReturnType<typeof createTxFixture>;

const OVERLAY_ID = "sb-unpersonalize-overlay";
const TOKEN_INPUT_ID = "sb-unpersonalize-token";
const STATUS_ID = "sb-unpersonalize-status";
const TX_CONTAINER_ID = "sb-unpersonalize-tx";
const OPEN_BUTTON_ID = "sb-unpersonalize-open";
const SUBMIT_BUTTON_ID = "sb-unpersonalize-submit";

const DEFAULT_PRICING = {
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

const STATUS_VARIANTS: Record<StatusScenario, { text: string; className: string }> = {
  eligible: {
    text: "✓ Square is personalized on the main contract and can be safely unpersonalized.",
    className: "su-modal__status su-modal__status--success",
  },
  emptyPayload: {
    text: "⚠️ Square was already unpersonalized on the main contract, so it currently defaults to the underlay. No need to unpersonalize again.",
    className: "su-modal__status su-modal__status--warning",
  },
  neverPersonalized: {
    text: "⚠️ Square has never been personalized on the main contract, so there is nothing to unpersonalize.",
    className: "su-modal__status su-modal__status--warning",
  },
};

const meta: Meta<UnpersonalizeModalStoryArgs> = {
  title: "Web3/UnpersonalizeModal",
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
  },
  args: {
    tokenId: 7777,
    scenario: "eligible",
    txState: "idle",
    walletConnected: true,
  },
  argTypes: {
    tokenId: {
      control: { type: "number" },
      min: 1,
      max: 10000,
    },
    scenario: {
      control: { type: "select" },
      options: ["eligible", "emptyPayload", "neverPersonalized"],
    },
    txState: {
      control: { type: "select" },
      options: ["idle", "processing", "success", "error"],
    },
    walletConnected: {
      control: { type: "boolean" },
    },
  },
};

export default meta;

function renderModalFrame() {
  return `
    <div style="min-height: 120px; display: flex; align-items: center; justify-content: center; padding: 1rem;">
      <button type="button" class="btn btn-secondary" id="${OPEN_BUTTON_ID}">
        Open unpersonalize modal
      </button>
    </div>
    <div class="su-modal-overlay is-visible" id="${OVERLAY_ID}" aria-hidden="false">
      <div class="su-modal" role="dialog" aria-modal="true" aria-labelledby="sb-unpersonalize-title">
        <div class="su-modal__header">
          <h2 class="su-modal__title" id="sb-unpersonalize-title">Unpersonalize a Square</h2>
          <button type="button" class="su-modal__close" data-close aria-label="Close dialog">&times;</button>
        </div>
        <div class="su-modal__body">
          <p class="su-modal__description">
            Enter a token ID to check its personalization status on the main contract.
            If it is still customized there, you can unpersonalize it to fall back to the cheaper underlay.
          </p>
          <label for="${TOKEN_INPUT_ID}" class="su-modal__label">Token ID</label>
          <input id="${TOKEN_INPUT_ID}" class="su-modal__input" type="number" min="1" max="10000" required />
          <div id="${STATUS_ID}" class="su-modal__status"></div>
          <div id="${TX_CONTAINER_ID}"></div>
          <div class="su-modal__actions">
            <button type="button" class="btn btn-primary" id="${SUBMIT_BUTTON_ID}">Unpersonalize</button>
          </div>
        </div>
      </div>
    </div>
  `;
}

function setWalletButton(controller: FixtureController, visible: boolean) {
  controller.setWalletContext({
    hasSession: visible,
    isWalletConnect: visible,
  });
}

async function seedBalance(controller: FixtureController) {
  await controller.setBalanceContext({
    address: STUB_ADDRESS,
    chainId: STUB_CHAIN_ID,
    fetcher: async () => ({
      formatted: "3.512",
      symbol: "ETH",
      decimals: 18,
      value: 0n,
    }),
  });
}

async function applyTxState(controller: FixtureController, state: TxState, walletConnected: boolean) {
  controller.reset();
  await seedBalance(controller);
  controller.setTitle("Unpersonalization status");
  controller.setHelp("");

  switch (state) {
    case "processing":
      setWalletButton(controller, true);
      controller.startProcessing("Waiting for you to confirm in your wallet.");
      controller.setHelp("Keep your wallet open until the transaction is mined.");
      break;
    case "success":
      setWalletButton(controller, false);
      controller.addPending(SAMPLE_PENDING_TX.hash, SAMPLE_PENDING_TX.url);
      await controller.markSuccess(
        SAMPLE_CONFIRMED_TX.hash,
        SAMPLE_CONFIRMED_TX.url,
        "Square unpersonalized! It now defaults to the underlay."
      );
      controller.setHelp("Personalize again using the cheaper underlay contract.");
      break;
    case "error":
      setWalletButton(controller, true);
      controller.markError(
        "The network rejected this transaction. Increase gas slightly and try again.",
        SAMPLE_FAILED_TX.hash,
        SAMPLE_FAILED_TX.url
      );
      controller.setHelp("Review your wallet activity and retry if necessary.");
      break;
    case "idle":
    default:
      setWalletButton(controller, walletConnected);
      controller.setHelp("Connect your wallet, enter a token ID, and start unpersonalizing.");
      break;
  }
}

function getTxController(container: HTMLElement) {
  const scoped = container as HTMLElement & { __txController?: FixtureController };
  if (!scoped.__txController) {
    scoped.__txController = createTxFixture({
      target: container,
      pricing: DEFAULT_PRICING,
      mode: "unpersonalize",
      title: "Unpersonalization status",
    });
  }
  return scoped.__txController;
}

function wireModalControls(overlay: HTMLElement) {
  const closeBtn = overlay.querySelector<HTMLButtonElement>("[data-close]");
  const openBtn = document.getElementById(OPEN_BUTTON_ID) as HTMLButtonElement | null;

  const show = () => {
    overlay.classList.add("is-visible");
    overlay.setAttribute("aria-hidden", "false");
  };
  const hide = () => {
    overlay.classList.remove("is-visible");
    overlay.setAttribute("aria-hidden", "true");
  };

  closeBtn?.addEventListener("click", hide);
  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) hide();
  });
  openBtn?.addEventListener("click", show);

  return { show, hide };
}

async function setupUnpersonalizeModal(args: UnpersonalizeModalStoryArgs) {
  if (typeof document === "undefined") return;
  const overlay = document.getElementById(OVERLAY_ID) as HTMLElement | null;
  if (!overlay) return;

  const controls = wireModalControls(overlay);
  controls.show();

  const tokenInput = document.getElementById(TOKEN_INPUT_ID) as HTMLInputElement | null;
  if (tokenInput) {
    tokenInput.value = String(args.tokenId);
  }

  const statusVariant = STATUS_VARIANTS[args.scenario];
  const statusEl = document.getElementById(STATUS_ID) as HTMLDivElement | null;
  if (statusEl && statusVariant) {
    statusEl.textContent = statusVariant.text;
    statusEl.className = statusVariant.className;
  }

  const submitButton = document.getElementById(SUBMIT_BUTTON_ID) as HTMLButtonElement | null;
  if (submitButton) {
    submitButton.disabled = args.scenario === "neverPersonalized";
    submitButton.textContent = args.scenario === "eligible" ? "Unpersonalize" : "Close";
    submitButton.onclick = () => {
      if (args.scenario !== "eligible") {
        controls.hide();
      }
    };
  }

  const txContainer = document.getElementById(TX_CONTAINER_ID) as HTMLElement | null;
  if (!txContainer) return;

  const controller = getTxController(txContainer);
  await applyTxState(controller, args.txState, args.walletConnected);
}

export const Preview: Story = {
  render: () => renderModalFrame(),
  play: async ({ args }) => {
    await setupUnpersonalizeModal(args);
  },
};
