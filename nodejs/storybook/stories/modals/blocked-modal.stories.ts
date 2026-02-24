import type { Meta, StoryObj } from "@storybook/html";
import "@modals/blocked-modal/blocked-modal.css";
import "@modals/blocked-modal/blocked-modal.js";

type BlockedVariant = "domain" | "uri" | "square";

interface BlockedModalArgs {}

const BLOCKED_ALWAYS_ROOT_ID = "sb-blocked-modal-always-root";
const BLOCKED_LINK_SELECTOR = ".sb-blocked-link";

declare global {
  interface Window {
    SuBlockedModal?: {
      init: () => Promise<unknown>;
      show: (targetUrl: URL | string, options?: { variant?: BlockedVariant }) => void;
      hide: () => void;
      isVisible: () => boolean;
      configure: (options?: { stylesheetHref?: string }) => void;
    };
  }
}

const meta: Meta<BlockedModalArgs> = {
  title: "Modals/BlockedModal",
  tags: ["autodocs"]
};

export default meta;

type Story = StoryObj<BlockedModalArgs>;

export const AlwaysOpen: Story = {
  render: () => `
    <div
      id="${BLOCKED_ALWAYS_ROOT_ID}"
      style="
        min-height: 320px;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 1rem;
        text-align: center;
      "
    >
      <p style="max-width: 420px; opacity: 0.8;">
        The blocked modal opens immediately using the blocked-domain variant.
      </p>
    </div>
  `,
  play: async () => {
    await window.SuBlockedModal?.init?.();
    window.SuBlockedModal?.show("https://silkroad.com", { variant: "domain" });
  }
};

export const TriggeredByLinks: Story = {
  render: () => `
    <div
      style="
        min-height: 280px;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 0.9rem;
        text-align: center;
      "
    >
      <p style="max-width: 520px; opacity: 0.85;">
        Click a link to simulate a blocked domain, blocked URI scheme, or blocked square.
      </p>

      <div style="display: flex; flex-direction: column; gap: 0.5rem;">
        <a
          href="https://silkroad.com"
          class="sb-blocked-link"
          data-variant="domain"
        >
          Blocked domain (silkroad.com)
        </a>
        <a
          href="javascript:alert(1)"
          class="sb-blocked-link"
          data-variant="uri"
          data-target="javascript:alert(1)"
        >
          Blocked URI scheme (javascript:)
        </a>
        <a
          href="#"
          class="sb-blocked-link"
          data-variant="square"
          data-target="Square #404"
        >
          Blocked square (Square #404)
        </a>
      </div>
    </div>
  `,
  play: async ({ canvasElement }) => {
    window.SuBlockedModal?.hide?.();
    await window.SuBlockedModal?.init?.();

    const links = canvasElement.querySelectorAll<HTMLAnchorElement>(
      BLOCKED_LINK_SELECTOR
    );

    if (links.length === 0) return;

    links.forEach((link) => {
      link.addEventListener("click", (event) => {
        event.preventDefault();
        const variant = (link.dataset.variant as BlockedVariant) || "domain";
        const target = link.dataset.target || link.getAttribute("href") || "";
        if (!target) return;
        window.SuBlockedModal?.show(target, { variant });
      });
    });
  }
};
