import type { Meta, StoryObj } from "@storybook/html";
import "@assets/css/chooser.css";
import { attachListChooserWithStubData } from "../../stubs/list-chooser.stub";

interface ListChooserStoryArgs {
  filterMode: "all" | "mintedOnly" | "personalizedOnly";
}

const meta: Meta<ListChooserStoryArgs> = {
  title: "Choosers/ListChooser (Stub Data)",
  tags: ["autodocs"],
  args: {
    filterMode: "all"
  },
  argTypes: {
    filterMode: {
      control: { type: "select" },
      options: ["all", "mintedOnly", "personalizedOnly"],
      description: "Filter based on stubbed minted/personalized metadata"
    }
  }
};

export default meta;

type Story = StoryObj<ListChooserStoryArgs>;

function buildFilter(mode: ListChooserStoryArgs["filterMode"]) {
  return (id: number, ctx: { personalization: unknown; extra: unknown }) => {
    const meta = ctx.extra as
      | { minted?: boolean; personalized?: boolean }
      | null
      | undefined;

    if (!meta) {
      return mode === "all";
    }

    switch (mode) {
      case "mintedOnly":
        return Boolean(meta.minted);
      case "personalizedOnly":
        return Boolean(meta.personalized);
      case "all":
      default:
        return true;
    }
  };
}

export const BasicListChooser: Story = {
  render: (args) => `
    <div
      style="
        min-height: 260px;
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        justify-content: center;
        gap: 1rem;
        max-width: 480px;
        margin: 0 auto;
      "
    >
      <label
        for="sb-list-chooser-input"
        style="display: flex; flex-direction: column; gap: 0.25rem; width: 100%;"
      >
        <span style="font-weight: 600;">Selected square ID</span>
        <input
          id="sb-list-chooser-input"
          type="number"
          min="1"
          step="1"
          style="
            padding: 0.45rem 0.6rem;
            border-radius: 4px;
            border: 1px solid rgba(255,255,255,0.35);
            background: rgba(0,0,0,0.25);
            color: inherit;
          "
        />
      </label>

      <button
        id="sb-list-chooser-trigger"
        type="button"
        style="
          padding: 0.6rem 1.1rem;
          border-radius: 6px;
          border: 2px solid var(--color-accent, #ffd700);
          background: rgba(0, 0, 0, 0.35);
          color: var(--color-accent, #ffd700);
          cursor: pointer;
          font-weight: 600;
        "
      >
        Open list chooser (stub data)
      </button>

      <p style="font-size: 0.85rem; opacity: 0.85; max-width: 420px;">
        This Storybook-only demo uses a small stub dataset.  
        Use the <strong>filterMode</strong> control in the Storybook panel to
        switch between all squares, minted only, and personalized only.  
        After changing it, click the button again to see the updated result.
      </p>
    </div>
  `,
  play: async ({ args, canvasElement }) => {
    const input =
      canvasElement.querySelector<HTMLInputElement>("#sb-list-chooser-input");
    const trigger =
      canvasElement.querySelector<HTMLElement>("#sb-list-chooser-trigger");

    if (!input || !trigger) return;

    attachListChooserWithStubData({
      input,
      trigger,
      title: "Choose a Square",
      description: `Filter mode: ${args.filterMode}`,
      filter: buildFilter(args.filterMode),
      onSelect: (id) => {
        // eslint-disable-next-line no-console
        console.log("Selected square from stub data:", id);
      }
    });
  }
};
