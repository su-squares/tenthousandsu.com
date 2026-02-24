import type { Meta, StoryObj } from "@storybook/html";
import "@assets/css/main.css";
import "@assets/css/personalize.css";
import "@assets/css/personalize-modern/base.css";
import "@assets/css/personalize-modern/billboard.css";

type Story = StoryObj;

const meta: Meta = {
  title: "Personalize Modern/Billboard Map",
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
  },
};

export default meta;

const MAP_ID = "sb-personalize-billboard-map";

export const Default: Story = {
  render: () => `
    <div class="personalize-page personalize-modern-page" style="padding: 2rem 1.5rem; min-height: 100vh;">
      <section class="personalize-billboard-map">
        <div class="personalize-billboard__map" id="${MAP_ID}" style="--glow-pulse: 0.65;">
          <h3>Billboard Map</h3>
          <label class="personalize-billboard__glow-toggle" id="glow-toggle-label">
            <input type="checkbox" id="glow-toggle">
            <span class="personalize-billboard__toggle-box" aria-hidden="true"></span>
            <span class="personalize-billboard__toggle-text">Turn off glow</span>
          </label>
          <div class="personalize-billboard__map-list">
            <div class="personalize-billboard__map-item">
              <span class="personalize-billboard__map-swatch" data-color="owned-unpersonalized"></span>
              Owned, not personalized
            </div>
            <div class="personalize-billboard__map-item">
              <span class="personalize-billboard__map-swatch" data-color="owned-personalized"></span>
              Owned, personalized
            </div>
            <div class="personalize-billboard__map-item">
              <span class="personalize-billboard__map-swatch" data-color="selected"></span>
              Selected
            </div>
            <div class="personalize-billboard__map-item">
              <span class="personalize-billboard__map-swatch" data-color="error"></span>
              Error
            </div>
          </div>
        </div>
      </section>
    </div>
  `,
  play: async ({ canvasElement }) => {
    const map = canvasElement.querySelector<HTMLDivElement>(`#${MAP_ID}`);
    const toggle = canvasElement.querySelector<HTMLInputElement>("#glow-toggle");
    if (!map || !toggle) return;

    const syncGlow = () => {
      map.dataset.glowOff = toggle.checked ? "true" : "false";
    };

    toggle.addEventListener("change", syncGlow);
    syncGlow();
  },
};
