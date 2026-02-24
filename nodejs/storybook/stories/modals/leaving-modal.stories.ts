import type { Meta, StoryObj } from "@storybook/html";
import "@modals/leaving-modal/leaving-modal.js";
import "@modals/leaving-modal/link-guard.js";

interface LeavingModalArgs {}

const LEAVING_ALWAYS_ROOT_ID = "sb-leaving-modal-always-root";

declare global {
  interface Window {
    SuLeavingModal?: {
      init: () => Promise<unknown>;
      show: (targetUrl: URL, target?: string) => void;
      hide: () => void;
      shouldWarnForUrl: (url: URL) => boolean;
      gateAnchor: (anchor: HTMLAnchorElement) => void;
      loadAllowlist: () => Promise<unknown>;
    };
    SuLeavingLinkGuard?: {
      guardLink: (
        anchor: HTMLAnchorElement,
        targetAttr?: string
      ) => void;
      guardLinks: (
        selector: string | NodeListOf<HTMLAnchorElement>,
        targetAttr?: string
      ) => void;
    };
  }
}

const meta: Meta<LeavingModalArgs> = {
  title: "Modals/LeavingModal",
  tags: ["autodocs"]
};

export default meta;

type Story = StoryObj<LeavingModalArgs>;

export const LinkGuardDemo: Story = {
  render: () => `
    <div
      style="
        min-height: 260px;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 1rem;
        text-align: center;
      "
    >
      <p style="max-width: 460px; font-size: 0.95rem; opacity: 0.9;">
        Click any of the links below. The Leaving Site modal will intercept the
        navigation and show you the destination URL.
      </p>

      <div style="display: flex; flex-direction: column; gap: 0.5rem;">
        <a
          href="https://ritovision.com"
          class="sb-leaving-link"
        >
          ritovision.com
        </a>
        <a
          href="https://phor.net"
          class="sb-leaving-link"
        >
          phor.net
        </a>
        <a
          href="https://williamentriken.net"
          class="sb-leaving-link"
        >
          williamentriken.net
        </a>
      </div>
    </div>
  `,
  play: async ({ canvasElement }) => {
    const links = canvasElement.querySelectorAll<HTMLAnchorElement>(
      ".sb-leaving-link"
    );

    if (links.length === 0) return;

    // Prefer the dedicated link guard helper if present
    if (window.SuLeavingLinkGuard) {
      // Second argument sets target="_blank" on the anchors
      window.SuLeavingLinkGuard.guardLinks(links, "_blank");
      return;
    }

    // Fallback: wire directly to SuLeavingModal if for some reason
    // the link guard isn't available
    if (window.SuLeavingModal) {
      await window.SuLeavingModal.init();
      links.forEach((anchor) => {
        window.SuLeavingModal?.gateAnchor(anchor);
      });
    }
  }
};

export const AlwaysOpen: Story = {
  render: () => `
    <div
      id="${LEAVING_ALWAYS_ROOT_ID}"
      style="
        min-height: 360px;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 0.75rem;
        text-align: center;
        padding: 1rem;
      "
    >
      <p style="max-width: 380px; opacity: 0.8;">
        The Leaving Site modal opens immediately and stays visible until you interact with it.
      </p>
    </div>
  `,
  play: async () => {
    const destination = new URL("https://ritovision.com");
    await window.SuLeavingModal?.init?.();
    window.SuLeavingModal?.show(destination, "_blank");
  }
};
