import type { Meta, StoryObj } from "@storybook/html";
import "@assets/css/chooser.css";
import { attachCanvasChooser } from "@assets/js/choosers/canvas-chooser.js";

interface CanvasChooserStoryArgs {
  filterMode: "all" | "mintedOnly" | "personalizedOnly";
}

const meta: Meta<CanvasChooserStoryArgs> = {
  title: "Choosers/CanvasChooser (Live Data)",
  tags: ["autodocs"],
  args: {
    filterMode: "mintedOnly"
  },
  argTypes: {
    filterMode: {
      control: { type: "select" },
      options: ["all", "mintedOnly", "personalizedOnly"],
      description: "Control which squares are considered enabled when hovering the canvas"
    }
  }
};

export default meta;

type Story = StoryObj<CanvasChooserStoryArgs>;

const CANVAS_INPUT_ID = "sb-canvas-chooser-input";
const CANVAS_TRIGGER_ID = "sb-canvas-chooser-trigger";
const CANVAS_ALWAYS_OPEN_ROOT_ID = "sb-canvas-chooser-open-root";
const CANVAS_ALWAYS_OPEN_TRIGGER_ID = "sb-canvas-chooser-open-trigger";

type FilterMeta = { minted?: boolean; personalized?: boolean } | null | undefined;

function matchesFilter(mode: CanvasChooserStoryArgs["filterMode"], meta: FilterMeta) {
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

function buildCanvasFilter(mode: CanvasChooserStoryArgs["filterMode"]) {
  return (_id: number, ctx: { personalization: unknown; extra: unknown }) =>
    matchesFilter(mode, ctx.extra as FilterMeta);
}

let canvasChooserHandle: ReturnType<typeof attachCanvasChooser> | null = null;
let attachedTrigger: HTMLElement | null = null;
let alwaysOpenCanvasChooserHandle: ReturnType<typeof attachCanvasChooser> | null = null;

export const LiveCanvasChooser: Story = {
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
        for="${CANVAS_INPUT_ID}"
        style="display: flex; flex-direction: column; gap: 0.25rem; width: 100%;"
      >
        <span style="font-weight: 600;">Selected square ID</span>
        <input
          id="${CANVAS_INPUT_ID}"
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
        id="${CANVAS_TRIGGER_ID}"
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
        Open canvas chooser (live data)
      </button>

      <p style="font-size: 0.85rem; opacity: 0.85; max-width: 460px;">
        This story loads the published <code>/build/squarePersonalizations.json</code> and
        <code>/build/squareExtra.json</code> and renders the full canvas with the real minted/personalized flags.
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
    const filter = buildCanvasFilter(args.filterMode);
    const input =
      canvasElement.querySelector<HTMLInputElement>(`#${CANVAS_INPUT_ID}`) ?? undefined;
    const trigger = canvasElement.querySelector<HTMLElement>(`#${CANVAS_TRIGGER_ID}`);

    if (!trigger) return;

    if (!canvasChooserHandle || attachedTrigger !== trigger) {
      canvasChooserHandle?.close();

      canvasChooserHandle = attachCanvasChooser({
        input,
        trigger,
        filter,
        title: "Choose square from canvas",
        // eslint-disable-next-line no-console
        onSelect: (id) => console.log("Selected square from live canvas:", id)
      });

      attachedTrigger = trigger;
    }
  }
};

export const AlwaysOpenCanvasChooser: Story = {
  render: () => `
    <div
      id="${CANVAS_ALWAYS_OPEN_ROOT_ID}"
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
    const host =
      canvasElement.querySelector<HTMLDivElement>(`#${CANVAS_ALWAYS_OPEN_ROOT_ID}`);
    if (!host) {
      return;
    }

    const existingTrigger =
      host.querySelector<HTMLButtonElement>(`#${CANVAS_ALWAYS_OPEN_TRIGGER_ID}`);
    existingTrigger?.remove();

    const trigger = document.createElement("button");
    trigger.id = CANVAS_ALWAYS_OPEN_TRIGGER_ID;
    trigger.type = "button";
    trigger.style.display = "none";
    host.appendChild(trigger);

    alwaysOpenCanvasChooserHandle?.close();
    alwaysOpenCanvasChooserHandle = attachCanvasChooser({
      trigger,
      filter: buildCanvasFilter(args.filterMode),
      title: "Choose square from canvas",
      // eslint-disable-next-line no-console
      onSelect: (id) =>
        console.log("Selected square from always-open canvas chooser:", id)
    });

    await alwaysOpenCanvasChooserHandle?.open?.();
  }
};
