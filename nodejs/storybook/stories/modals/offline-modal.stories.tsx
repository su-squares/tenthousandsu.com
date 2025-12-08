import type { Meta, StoryObj } from "@storybook/html";
import "@modals/offline-modal/modal.css";
import "@modals/offline-modal/offline-modal.js";

interface OfflineModalArgs {
  isOnline: boolean;
}

const meta: Meta<OfflineModalArgs> = {
  title: "Modals/OfflineModal",
  tags: ["autodocs"],
  args: {
    isOnline: true
  }
};

export default meta;

type Story = StoryObj<OfflineModalArgs>;

export const ToggleOnlineOffline: Story = {
  render: (args) => `
    <div
      style="
        min-height: 260px;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 12px;
      "
    >
      <label
        for="sb-offline-toggle"
        style="
          display: flex;
          align-items: center;
          gap: 0.5rem;
          cursor: pointer;
          user-select: none;
        "
      >
        <input
          type="checkbox"
          id="sb-offline-toggle"
          ${args.isOnline ? "checked" : ""}
          style="cursor: pointer;"
        />
        <span id="sb-offline-toggle-label">
          ${args.isOnline ? "Online" : "Offline"}
        </span>
      </label>
      <p style="font-size: 0.9rem; opacity: 0.85; max-width: 420px; text-align: center;">
        Toggle to simulate going offline/online. The offline banner will appear
        at the bottom of the viewport when offline.
      </p>
    </div>
  `,
  play: async ({ args, canvasElement }) => {
    const toggle =
      canvasElement.querySelector<HTMLInputElement>("#sb-offline-toggle");
    const label =
      canvasElement.querySelector<HTMLSpanElement>("#sb-offline-toggle-label");

    if (!toggle || !label) return;

    const applyState = (online: boolean) => {
      const eventType = online ? "online" : "offline";
      window.dispatchEvent(new Event(eventType));
      label.textContent = online ? "Online" : "Offline";
      toggle.checked = online;
    };

    // Set initial state based on args
    applyState(args.isOnline);

    toggle.addEventListener("change", () => {
      applyState(toggle.checked);
    });
  }
};
