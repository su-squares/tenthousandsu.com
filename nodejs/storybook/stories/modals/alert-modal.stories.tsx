import type { Meta, StoryObj } from "@storybook/html";
import "@modals/alert-modal/alert-modal.js";

interface AlertModalArgs {
  message: string;
}

const ALERT_ALWAYS_ROOT_ID = "sb-alert-modal-always-root";

declare global {
  interface Window {
    SuAlertModal?: {
      init: () => Promise<unknown>;
      show: (message?: unknown) => void;
      hide: () => void;
    };
  }
}

const meta: Meta<AlertModalArgs> = {
  title: "Modals/AlertModal",
  tags: ["autodocs"],
  args: {
    message: "Heads up! Something happened."
  }
};

export default meta;

type Story = StoryObj<AlertModalArgs>;

export const Basic: Story = {
  render: (args) => `
    <div style="min-height: 240px; display: flex; align-items: center; justify-content: center;">
      <button type="button" class="btn" id="sb-alert-trigger">
        Open alert modal
      </button>
    </div>
  `,
  play: async ({ args, canvasElement }) => {
    const root = canvasElement as HTMLElement;
    const btn = root.querySelector<HTMLButtonElement>("#sb-alert-trigger");

    if (!btn) return;

    btn.addEventListener("click", () => {
      if (window.SuAlertModal) {
        window.SuAlertModal.show(args.message);
      } else {
        alert(args.message);
      }
    });
  }
};

export const AlwaysOpen: Story = {
  render: () => `
    <div
      id="${ALERT_ALWAYS_ROOT_ID}"
      style="min-height: 260px; display:flex; align-items:center; justify-content:center;"
    >
      <p style="max-width: 320px; text-align:center; opacity:0.78;">
        The alert modal appears immediately.
      </p>
    </div>
  `,
  play: async ({ args }) => {
    await window.SuAlertModal?.init?.();
    if (window.SuAlertModal) {
      window.SuAlertModal.show(args.message);
    } else {
      alert(args.message);
    }
  }
};
