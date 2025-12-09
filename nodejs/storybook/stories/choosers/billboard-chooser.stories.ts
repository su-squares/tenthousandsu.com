import type { Meta, StoryObj } from "@storybook/html";
import "@assets/square-lookup/styles.css";
import { attachBillboardChooser } from "@assets/square-lookup/choosers/billboard.js";

interface BillboardChooserStoryArgs {
  filterMode: "all" | "mintedOnly" | "personalizedOnly";
}

const meta: Meta<BillboardChooserStoryArgs> = {
  title: "Choosers/BillboardChooser (Live Data)",
  tags: ["autodocs"],
  args: {
    filterMode: "mintedOnly",
  },
  argTypes: {
    filterMode: {
      control: { type: "select" },
      options: ["all", "mintedOnly", "personalizedOnly"],
      description: "Control which squares are considered enabled when hovering the billboard",
    },
  },
};

export default meta;

type Story = StoryObj<BillboardChooserStoryArgs>;

const BILLBOARD_INPUT_ID = "sb-billboard-chooser-input";
const BILLBOARD_TRIGGER_ID = "sb-billboard-chooser-trigger";
const BILLBOARD_ALWAYS_OPEN_ROOT_ID = "sb-billboard-chooser-open-root";
const BILLBOARD_ALWAYS_OPEN_TRIGGER_ID = "sb-billboard-chooser-open-trigger";

type FilterMeta = { minted?: boolean; personalized?: boolean } | null | undefined;

function matchesFilter(mode: BillboardChooserStoryArgs["filterMode"], meta: FilterMeta) {
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
}

function buildBillboardFilter(mode: BillboardChooserStoryArgs["filterMode"]) {
  return (_id: number, ctx: { personalization: unknown; extra: unknown }) =>
    matchesFilter(mode, ctx.extra as FilterMeta);
}

let billboardChooserHandle: ReturnType<typeof attachBillboardChooser> | null = null;
let attachedTrigger: HTMLElement | null = null;
let alwaysOpenBillboardChooserHandle: ReturnType<typeof attachBillboardChooser> | null = null;

export const LiveBillboardChooser: Story = {
  render: (args) => `
    <div
      style="
        min-height: 280px;
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        justify-content: center;
        gap: 1rem;
        max-width: 520px;
        margin: 0 auto;
      "
    >
      <label
        for="${BILLBOARD_INPUT_ID}"
        style="display: flex; flex-direction: column; gap: 0.25rem; width: 100%;"
      >
        <span style="font-weight: 600;">Selected square ID</span>
        <input
          id="${BILLBOARD_INPUT_ID}"
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
        id="${BILLBOARD_TRIGGER_ID}"
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
        Open billboard chooser (live data)
      </button>

      <p style="font-size: 0.85rem; opacity: 0.85; max-width: 460px;">
        This story loads the published <code>/build/squarePersonalizations.json</code> and
        <code>/build/squareExtra.json</code> and renders the full billboard with the real minted/personalized flags.
        Use the <strong>filterMode</strong> control to change which squares are treated as selectable before
        opening the chooser. After switching it, close the modal (if open) and click the button again to see
        the updated filtering applied.
      </p>

      <p style="font-size: 0.8rem; opacity: 0.7;">
        Current filter: <strong>${args.filterMode}</strong>
      </p>
    </div>
  `,
  play: async ({ args, canvasElement }) => {
    const filter = buildBillboardFilter(args.filterMode);
    const input = canvasElement.querySelector<HTMLInputElement>(`#${BILLBOARD_INPUT_ID}`) ?? undefined;
    const trigger = canvasElement.querySelector<HTMLElement>(`#${BILLBOARD_TRIGGER_ID}`);

    if (!trigger) return;

    if (!billboardChooserHandle || attachedTrigger !== trigger) {
      billboardChooserHandle?.close();

      billboardChooserHandle = attachBillboardChooser({
        input,
        trigger,
        filter,
        title: "Choose square from billboard",
        // eslint-disable-next-line no-console
        onSelect: (id) => console.log("Selected square from live billboard:", id),
      });

      attachedTrigger = trigger;
    }
  },
};

export const AlwaysOpenBillboardChooser: Story = {
  render: () => `
    <div
      id="${BILLBOARD_ALWAYS_OPEN_ROOT_ID}"
      style="
        min-height: 400px;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 1rem;
      "
    >
      <p style="text-align:center; max-width: 360px; opacity: 0.75;">
        The chooser modal opens immediately without form controls.
      </p>
    </div>
  `,
  play: async ({ args, canvasElement }) => {
    const host = canvasElement.querySelector<HTMLDivElement>(`#${BILLBOARD_ALWAYS_OPEN_ROOT_ID}`);
    if (!host) {
      return;
    }

    const existingTrigger = host.querySelector<HTMLButtonElement>(`#${BILLBOARD_ALWAYS_OPEN_TRIGGER_ID}`);
    existingTrigger?.remove();

    const trigger = document.createElement("button");
    trigger.id = BILLBOARD_ALWAYS_OPEN_TRIGGER_ID;
    trigger.type = "button";
    trigger.style.display = "none";
    host.appendChild(trigger);

    alwaysOpenBillboardChooserHandle?.close();
    alwaysOpenBillboardChooserHandle = attachBillboardChooser({
      trigger,
      filter: buildBillboardFilter(args.filterMode),
      title: "Choose square from billboard",
      // eslint-disable-next-line no-console
      onSelect: (id) => console.log("Selected square from always-open billboard chooser:", id),
    });

    await alwaysOpenBillboardChooserHandle?.open?.();
  },
};
