import type { Meta, StoryObj } from "@storybook/html";
import "@assets/css/main.css";
import "@assets/accordions/bigaccordion/bigaccordion.css";
import { initBigAccordions } from "@assets/accordions/bigaccordion/index.js";

interface AccordionStoryArgs {
  startOpen: boolean;
  headerText: string;
}

type Story = StoryObj<AccordionStoryArgs>;

const meta: Meta<AccordionStoryArgs> = {
  title: "Components/Big Accordion",
  tags: ["autodocs"],
  args: {
    startOpen: false,
    headerText: "Click to expand",
  },
  argTypes: {
    startOpen: {
      control: { type: "boolean" },
      description: "Whether the accordion starts in an open state.",
    },
    headerText: {
      control: { type: "text" },
      description: "Text displayed in the accordion header.",
    },
  },
  parameters: {
    layout: "padded",
  },
};

export default meta;

function renderAccordion(title: string, content: string, startOpen: boolean = false) {
  return `
    <div class="bigaccordion" data-bigaccordion ${startOpen ? 'data-bigaccordion-open' : ''}>
      <button class="bigaccordion__trigger" type="button" aria-expanded="false">
        <span class="bigaccordion__title">${title}</span>
        <span class="bigaccordion__icon" aria-hidden="true"></span>
      </button>
      <div class="bigaccordion__panel" hidden>
        <div class="bigaccordion__content">
          <div class="bigaccordion__inner">
            ${content}
          </div>
        </div>
      </div>
    </div>
  `;
}

export const Default: Story = {
  render: (args) => {
    const container = document.createElement("div");
    container.style.padding = "2rem";
    container.style.maxWidth = "1200px";
    container.style.margin = "0 auto";

    container.innerHTML = renderAccordion(
      args.headerText,
      `
        <h4>What is this section about?</h4>
        <p>
          This is a flexible accordion component with a large banner-style header.
          It's designed to display collapsible content in an eye-catching way.
        </p>
        <h4>Key Features</h4>
        <ul>
          <li>150px tall header on desktop, scales down on mobile</li>
          <li>Smooth animations using CSS grid technique</li>
          <li>Accessible keyboard navigation (Enter/Space to toggle)</li>
          <li>Built-in ARIA attributes for screen readers</li>
          <li>Automatic icon generation with rotate animation</li>
        </ul>
        <p>
          The content area supports rich text formatting including <strong>bold text</strong>,
          <code>code snippets</code>, and various HTML elements.
        </p>
      `,
      args.startOpen
    );

    requestAnimationFrame(() => {
      if (container.isConnected) {
        initBigAccordions();
      }
    });

    return container;
  },
};

export const MultipleAccordions: Story = {
  render: () => {
    const container = document.createElement("div");
    container.style.padding = "2rem";
    container.style.maxWidth = "1200px";
    container.style.margin = "0 auto";

    container.innerHTML = `
      ${renderAccordion(
        "Documentation",
        `
          <h4>Getting Started</h4>
          <p>
            The Big Accordion component is easy to integrate into your project.
            Simply add the appropriate HTML structure and initialize with JavaScript.
          </p>
          <h4>Installation</h4>
          <ol>
            <li>Import the CSS file into your project</li>
            <li>Import the JavaScript module</li>
            <li>Add the HTML structure to your page</li>
            <li>Call <code>initBigAccordions()</code> to activate all accordions</li>
          </ol>
          <p>
            For programmatic control, use <code>createBigAccordion(element, options)</code>
            which returns a controller with methods like <code>open()</code>,
            <code>close()</code>, and <code>toggle()</code>.
          </p>
        `
      )}
      ${renderAccordion(
        "Technical Specifications",
        `
          <h4>Browser Support</h4>
          <p>
            This component uses modern CSS features including CSS Grid and custom properties.
            It works in all evergreen browsers and gracefully degrades in older browsers.
          </p>
          <h4>Performance Considerations</h4>
          <ul>
            <li>Uses hardware-accelerated CSS transforms for smooth animations</li>
            <li>Minimal JavaScript overhead with event delegation</li>
            <li>Lazy rendering of SVG icons on initialization</li>
            <li>Optional <code>onToggle</code> callback for custom logic</li>
          </ul>
          <h4>Customization</h4>
          <p>
            The component uses CSS custom properties for easy theming:
          </p>
          <ul>
            <li><code>--bigaccordion-header-height</code>: Adjust the header size</li>
            <li><code>--bigaccordion-border-color</code>: Change border color</li>
            <li><code>--bigaccordion-text-color</code>: Modify text color</li>
            <li><code>--bigaccordion-transition-duration</code>: Animation speed</li>
          </ul>
        `
      )}
      ${renderAccordion(
        "FAQs & Troubleshooting",
        `
          <h4>Common Questions</h4>
          <p><strong>Q: Can I have multiple accordions open at once?</strong></p>
          <p>A: Yes! Each accordion operates independently by default.</p>

          <p><strong>Q: How do I make an accordion start open?</strong></p>
          <p>A: Add the <code>data-bigaccordion-open</code> attribute to the container element.</p>

          <p><strong>Q: Can I control accordions with JavaScript?</strong></p>
          <p>A: Absolutely. Use <code>createBigAccordion()</code> to get a controller instance with full API access.</p>

          <h4>Known Issues</h4>
          <p>
            If the accordion animation appears janky, ensure there are no expensive operations
            running during the transition. The content area has a max-height of 60vh and will
            scroll if content exceeds this limit.
          </p>
        `,
        true
      )}
    `;

    requestAnimationFrame(() => {
      if (container.isConnected) {
        initBigAccordions();
      }
    });

    return container;
  },
};

export const MinimalContent: Story = {
  render: () => {
    const container = document.createElement("div");
    container.style.padding = "2rem";
    container.style.maxWidth = "1200px";
    container.style.margin = "0 auto";

    container.innerHTML = renderAccordion(
      "Short Content Example",
      `
        <p>
          Sometimes you just need a simple accordion with minimal content.
          This example shows how the component handles small amounts of text gracefully.
        </p>
      `
    );

    requestAnimationFrame(() => {
      if (container.isConnected) {
        initBigAccordions();
      }
    });

    return container;
  },
};

export const LongScrollableContent: Story = {
  render: () => {
    const container = document.createElement("div");
    container.style.padding = "2rem";
    container.style.maxWidth = "1200px";
    container.style.margin = "0 auto";

    const longContent = Array.from({ length: 20 }, (_, i) =>
      `<p>Paragraph ${i + 1}: This is example content to demonstrate scrolling behavior when the accordion contains more content than fits in the 60vh max-height constraint. The content area will become scrollable automatically.</p>`
    ).join('');

    container.innerHTML = renderAccordion(
      "Scrollable Content Demo",
      `
        <h4>This accordion has a lot of content</h4>
        ${longContent}
        <p><strong>You've reached the end!</strong> Notice how the custom scrollbar matches the accordion's theme.</p>
      `,
      true
    );

    requestAnimationFrame(() => {
      if (container.isConnected) {
        initBigAccordions();
      }
    });

    return container;
  },
};
