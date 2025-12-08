import type { Meta, StoryObj } from "@storybook/html";
import "@assets/css/main.css";
import "@assets/css/article.css";
import "@assets/nav-menu/nav.css";
import { navHeaderMarkup } from "./nav-header.fixture";

const meta: Meta = {
  title: "Nav/Nav Header",
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
  },
};

export default meta;

type Story = StoryObj;

function buildLayout(content: string) {
  return `
    <div
      style="
        min-height: 100vh;
        padding: 2.25rem 1.5rem 3rem;
        display: flex;
        flex-direction: column;
        gap: 2rem;
        background: transparent;
      "
    >
      ${content}
      <hr style="border-color: rgba(255, 255, 255, 0.35); width: min(1024px, 100%); margin: 0;" />
      <article class="lead" style="max-width: var(--max-width-content);">
        <h1>Storybook page shell</h1>
        <p>
          This story mimics the default <code>main.css</code> layout so the nav header sits in the same visual context as your live pages.
          The article below is only for visual balance and has minimal text so you can focus on the header chrome.
        </p>
      </article>
    </div>
  `;
}

export const HeaderOnly: Story = {
  render: () => buildLayout(navHeaderMarkup),
};
