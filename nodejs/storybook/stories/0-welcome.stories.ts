import type { Meta, StoryObj } from "@storybook/html";
import "@assets/css/main.css";

type Story = StoryObj;

const meta: Meta = {
  title: "0-Welcome",
  parameters: {
    layout: "centered",
  },
};

export default meta;

export const Welcome: Story = {
  render: () => {
    const container = document.createElement("div");
    container.style.cssText = `
      max-width: 800px;
      padding: 3rem 2rem;
      color: var(--color-accent, #ffd700);
      line-height: 1.8;
    `;

    container.innerHTML = `
      <h1 style="margin-top: 0; margin-bottom: 1.5rem; font-size: 2.5rem; font-weight: 700;">
        Welcome to Su Squares' Storybook
      </h1>

      <p style="margin-bottom: 1.25rem; font-size: 1.1rem;">
        This workspace contains component demonstrations and interactive examples from the Su Squares project.
      </p>

      <h2 style="margin-top: 2rem; margin-bottom: 1rem; font-size: 1.5rem; font-weight: 600;">
        About These Stories
      </h2>

      <p style="margin-bottom: 1.25rem;">
        Most stories you'll see here are <strong>reconstructions</strong> of the live site rather than direct imports.
        In keeping with the spirit of its classic architecture, the Su Squares website is built with HTML-based structures that 
        aren't directly importable into Storybook, so stories recreate the HTML markup while importing the actual JavaScript modules 
        and CSS directly from the source code.
      </p>

      <p style="margin-bottom: 1.25rem;">
        This means:
      </p>

      <ul style="margin-bottom: 1.25rem; padding-left: 1.75rem; list-style-type: disc;">
        <li style="margin-bottom: 0.5rem;">
          <strong>JavaScript logic:</strong> Imported directly from source (no duplication)
        </li>
        <li style="margin-bottom: 0.5rem;">
          <strong>CSS styles:</strong> Imported directly from source (no duplication)
        </li>
        <li style="margin-bottom: 0.5rem;">
          <strong>HTML markup:</strong> Reconstructed in story files (necessary for Storybook)
        </li>
      </ul>

      <p style="margin-bottom: 1.25rem;">
        Some complex stories may include additional glue code to wire up interactions in the Storybook environment.
      </p>

      <h2 style="margin-top: 2rem; margin-bottom: 1rem; font-size: 1.5rem; font-weight: 600;">
        Navigation
      </h2>

      <p style="margin-bottom: 1.25rem;">
        Browse the sidebar to explore components organized by category. Each story includes interactive controls
        where applicable, allowing you to experiment with different configurations and states.
      </p>

      <p style="margin-top: 2rem; font-style: italic; opacity: 0.85;">
        Happy exploring! 🎨
      </p>
    `;

    return container;
  },
};
