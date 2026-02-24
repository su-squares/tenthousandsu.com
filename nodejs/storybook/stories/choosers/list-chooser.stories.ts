import type { Meta, StoryObj } from "@storybook/html";
import "@assets/square-lookup/styles.css";
import { attachListChooserWithStubData } from "../../stubs/list-chooser.stub";
import { attachCheckboxListChooserWithStubData } from "../../stubs/list-chooser-checkbox.stub";

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

export const AlwaysOpenListChooser: Story = {
  render: () => `
    <div
      id="${LIST_ALWAYS_ROOT_ID}"
      style="
        min-height: 360px;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 1rem;
      "
    >
      <p style="text-align:center; max-width: 360px; opacity: 0.75;">
        The stubbed list chooser opens immediately in a minimal shell.
      </p>
    </div>
  `,
  play: async ({ args, canvasElement }) => {
    const host =
      canvasElement.querySelector<HTMLDivElement>(`#${LIST_ALWAYS_ROOT_ID}`);
    if (!host) {
      return;
    }

    const previousInput = host.querySelector<HTMLInputElement>(
      `#${LIST_ALWAYS_INPUT_ID}`
    );
    previousInput?.remove();

    const previousTrigger = host.querySelector<HTMLButtonElement>(
      `#${LIST_ALWAYS_TRIGGER_ID}`
    );
    previousTrigger?.remove();

    const input = document.createElement("input");
    input.type = "hidden";
    input.id = LIST_ALWAYS_INPUT_ID;
    host.appendChild(input);

    const trigger = document.createElement("button");
    trigger.type = "button";
    trigger.id = LIST_ALWAYS_TRIGGER_ID;
    trigger.style.display = "none";
    host.appendChild(trigger);

    alwaysOpenListChooserHandle?.close();

    alwaysOpenListChooserHandle = attachListChooserWithStubData({
      input,
      trigger,
      title: "Choose a Square",
      description: `Filter mode: ${args.filterMode}`,
      filter: buildFilter(args.filterMode),
      onSelect: (id) => {
        // eslint-disable-next-line no-console
        console.log("Selected square from always-open list chooser:", id);
      }
    });

    alwaysOpenListChooserHandle?.open();
  }
};

export default meta;

type Story = StoryObj<ListChooserStoryArgs>;

const LIST_ALWAYS_ROOT_ID = "sb-list-chooser-open-root";
const LIST_ALWAYS_TRIGGER_ID = "sb-list-chooser-open-trigger";
const LIST_ALWAYS_INPUT_ID = "sb-list-chooser-open-input";

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

let alwaysOpenListChooserHandle: ReturnType<typeof attachListChooserWithStubData> | null = null;

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

const CHECKBOX_ROOT_ID = "sb-checkbox-chooser-root";
const CHECKBOX_TRIGGER_ID = "sb-checkbox-chooser-trigger";
const CHECKBOX_SELECTED_ID = "sb-checkbox-chooser-selected";

let checkboxChooserHandle: ReturnType<typeof attachCheckboxListChooserWithStubData> | null = null;

export const CheckboxListChooser: Story = {
  render: (args) => `
    <div
      id="${CHECKBOX_ROOT_ID}"
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
      <button
        id="${CHECKBOX_TRIGGER_ID}"
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
        Open checkbox list chooser
      </button>

      <div style="font-size: 0.9rem;">
        <strong>Selected IDs:</strong>
        <span id="${CHECKBOX_SELECTED_ID}" style="opacity: 0.85;">None</span>
      </div>

      <p style="font-size: 0.85rem; opacity: 0.85; max-width: 420px;">
        This variant lets you select multiple squares with checkboxes.
        Clicking a cell toggles its checkmark instead of closing the modal.
        Your selection persists when you close and reopen the chooser.
      </p>
    </div>
  `,
  play: async ({ args, canvasElement }) => {
    const trigger = canvasElement.querySelector<HTMLElement>(`#${CHECKBOX_TRIGGER_ID}`);
    const selectedDisplay = canvasElement.querySelector<HTMLElement>(`#${CHECKBOX_SELECTED_ID}`);

    if (!trigger) return;

    checkboxChooserHandle?.close();

    checkboxChooserHandle = attachCheckboxListChooserWithStubData({
      input: null,
      trigger,
      title: "Select squares then press okay",
      description: `Filter mode: ${args.filterMode}`,
      filter: buildFilter(args.filterMode),
      onSelectionChange: (ids) => {
        // eslint-disable-next-line no-console
        console.log("Selection changed:", ids);
        if (selectedDisplay) {
          selectedDisplay.textContent = ids.length > 0 ? ids.join(", ") : "None";
        }
      }
    });
  }
};
