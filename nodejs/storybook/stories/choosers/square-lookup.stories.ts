import type { Meta, StoryObj } from "@storybook/html";
import "@assets/css/chooser.css";
import { attachListChooser } from "@assets/js/choosers/list-chooser.js";
import { attachCanvasChooser } from "@assets/js/choosers/canvas-chooser.js";

interface SquareLookupStoryArgs {
  variant: "default" | "narrow";
}

const meta: Meta<SquareLookupStoryArgs> = {
  title: "Choosers/SquareLookup",
  tags: ["autodocs"],
  args: {
    variant: "default"
  },
  argTypes: {
    variant: {
      control: { type: "select" },
      options: ["default", "narrow"],
      description: "Layout variant - narrow centers the component with a max-width"
    }
  }
};

export default meta;

type Story = StoryObj<SquareLookupStoryArgs>;

const INPUT_ID = "sb-square-lookup-input";
const LIST_BUTTON_ID = "sb-square-lookup-choose";
const CANVAS_BUTTON_ID = "sb-square-lookup-canvas";
const SUBMIT_BUTTON_ID = "sb-square-lookup-submit";

let listChooserHandle: ReturnType<typeof attachListChooser> | null = null;
let canvasChooserHandle: ReturnType<typeof attachCanvasChooser> | null = null;

export const SquareLookup: Story = {
  render: (args) => `
    <article class="square-lookup${args.variant === "narrow" ? " square-lookup--narrow" : ""}" id="pick-a-square-lookup">
      <h2 style="color: var(--color-accent, #ffd700);">Square look up</h2>
      <p style="color: var(--color-accent, #ffd700);">Enter an already minted square to look up information about it.</p>
      <div class="square-lookup__controls">
        <input id="${INPUT_ID}" type="number" min="1" max="10000" inputmode="numeric" placeholder="e.g. 8503">
        <div class="square-lookup__actions">
          <button id="${LIST_BUTTON_ID}" type="button">Choose from list</button>
          <button id="${CANVAS_BUTTON_ID}" type="button">Choose from canvas</button>
        </div>
      </div>
      <button id="${SUBMIT_BUTTON_ID}" type="button" class="btn btn-lg square-lookup__submit">Look up</button>
    </article>
  `,
  play: async ({ canvasElement }) => {
    const input = canvasElement.querySelector<HTMLInputElement>(`#${INPUT_ID}`);
    const listButton = canvasElement.querySelector<HTMLButtonElement>(`#${LIST_BUTTON_ID}`);
    const canvasButton = canvasElement.querySelector<HTMLButtonElement>(`#${CANVAS_BUTTON_ID}`);
    const submitButton = canvasElement.querySelector<HTMLButtonElement>(`#${SUBMIT_BUTTON_ID}`);

    if (!input || !listButton || !canvasButton || !submitButton) return;

    listChooserHandle?.close();
    listChooserHandle = attachListChooser({
      input,
      trigger: listButton,
      filter: (_id, ctx) => Boolean(ctx.extra),
      onSelect: (id) => {
        // eslint-disable-next-line no-console
        console.log("Selected square from list:", id);
      },
      updateInput: true,
      title: "Choose a minted Square",
      description: "Tap a square below to look it up."
    });

    canvasChooserHandle?.close();
    canvasChooserHandle = attachCanvasChooser({
      input,
      trigger: canvasButton,
      filter: (_id, ctx) => Boolean(ctx.extra),
      onSelect: (id) => {
        // eslint-disable-next-line no-console
        console.log("Selected square from canvas:", id);
      },
      updateInput: true,
      title: "Choose square from canvas"
    });

    input.addEventListener("input", () => {
      const value = parseInt(input.value, 10);
      if (isNaN(value) || value < 1 || value > 10000) {
        input.setCustomValidity("Enter a number between 1 and 10,000.");
      } else {
        input.setCustomValidity("");
      }
    });

    submitButton.addEventListener("click", () => {
      const value = parseInt(input.value, 10);
      if (isNaN(value) || value < 1 || value > 10000) {
        alert("Enter a number between 1 and 10,000.");
        return;
      }
      // eslint-disable-next-line no-console
      console.log("Look up square:", value);
    });
  }
};

export const NarrowVariant: Story = {
  args: {
    variant: "narrow"
  },
  render: SquareLookup.render,
  play: SquareLookup.play
};
