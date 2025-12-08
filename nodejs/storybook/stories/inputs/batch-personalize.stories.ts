import type { Meta, StoryObj } from "@storybook/html";
import "@assets/css/main.css";
import "@assets/css/personalize.css";

type Story = StoryObj;

const meta: Meta = {
  title: "Inputs/inputs",
  parameters: {
    layout: "fullscreen",
  },
};

export default meta;

type StatusState = "success" | "error" | "hint";

const statusStyles = `
  font-size: 0.95rem;
  margin: 0.2rem 0 0;
  min-height: 1.4em;
`;

const counterStyles = `
  font-size: 0.85rem;
  margin: 0;
  color: rgba(255, 255, 255, 0.8);
`;

const encoder = typeof TextEncoder !== "undefined" ? new TextEncoder() : null;

function byteLength(value: string) {
  if (!encoder) {
    return new TextEncoder().encode(value).length;
  }
  return encoder.encode(value).length;
}

function wrapStoryContent(content: string) {
  return `
    <div class="personalize-page" style="padding: 2rem;">
      <article class="lead" style="max-width: 720px; margin: 0 auto; display: grid; gap: 1.5rem;">
        ${content}
      </article>
    </div>
  `;
}

function setStatus(element: HTMLElement | null, state: StatusState, text: string) {
  if (!element) return;
  element.textContent = text;
  const color =
    state === "success"
      ? "#b9ffd4"
      : state === "error"
        ? "#ffb3b3"
        : "#ffd700";
  element.style.color = color;
  element.dataset.state = state;
}

function describeSquare(num: number) {
  const column = ((num - 1) % 100) + 1;
  const row = Math.floor((num - 1) / 100) + 1;
  return [`Row ${row}`, `Column ${column}`].join(", ");
}

function renderLeadSection(body: string) {
  return wrapStoryContent(`
    ${body}
  `);
}

function renderHeading(text: string) {
  return `<h2 style="color: #ffd700; margin-bottom: 0.35rem;">${text}</h2>`;
}

function renderParagraph(text: string, emphasize = false) {
  const color = emphasize ? "#ffd700" : "rgba(255, 255, 255, 0.9)";
  return `<p style="margin: 0; color: ${color};">${text}</p>`;
}

// Square selector field ///////////////////////////////////////////////////////

interface SquareFieldArgs {
  initialValue: number;
}

const SQUARE_SECTION_ID = "sb-square-selector";

export const SquareNumberField: Story = {
  args: {
    initialValue: 101,
  } satisfies SquareFieldArgs,
  render: (args) => {
    const content = `
      ${renderHeading("Select top-left Square")}
      ${renderParagraph("Which Square will be the topmost and leftmost Square you will personalize?")}
      <p style="margin: 0;">
        <input
          id="${SQUARE_SECTION_ID}-input"
          type="number"
          min="1"
          max="10000"
          inputmode="numeric"
          style="width: 7em; padding: 0.45rem 0.65rem; border: 1px solid #ffd700; border-radius: 6px; background: rgba(0,0,0,0.35); color: #ffd700; font-size: 1.1rem;"
          value="${args.initialValue ?? ""}"
          aria-describedby="${SQUARE_SECTION_ID}-status"
        />
      </p>
      <p id="${SQUARE_SECTION_ID}-status" data-status style="${statusStyles}"></p>
    `;
    return renderLeadSection(content);
  },
  play: async ({ args }) => {
    if (typeof window === "undefined") return;
    const container = document.getElementById(SQUARE_SECTION_ID);
    const input = container?.querySelector<HTMLInputElement>("input");
    const status = container?.querySelector<HTMLElement>("[data-status]");
    if (!input || !status) return;

    const evaluate = (value: string) => {
      if (!value) {
        setStatus(status, "hint", "Enter a number between 1 and 10000.");
        return;
      }
      const num = Number.parseInt(value, 10);
      if (!Number.isInteger(num)) {
        setStatus(status, "error", "Square number must be an integer.");
        return;
      }
      if (num < 1 || num > 10000) {
        setStatus(status, "error", "Squares are numbered 1 through 10,000.");
        return;
      }
      setStatus(status, "success", `Square #${num} is valid • ${describeSquare(num)}.`);
    };

    evaluate(input.value);
    input.addEventListener("input", (event) => {
      evaluate((event.target as HTMLInputElement).value);
    });
  },
};

// Title field with byte counter //////////////////////////////////////////////

interface ByteFieldArgs {
  initialValue: string;
}

const TITLE_SECTION_ID = "sb-title-field";

function renderByteFieldSection(id: string, heading: string, intro: string, placeholder: string, maxBytes: number, value: string) {
  return `
    ${renderHeading(heading)}
    ${renderParagraph(intro)}
    <p style="margin: 0;">
      <input
        id="${id}-input"
        type="text"
        maxlength="${maxBytes}"
        placeholder="${placeholder}"
        value="${value}"
        autocomplete="off"
        spellcheck="false"
        aria-describedby="${id}-count ${id}-status"
        style="width: min(420px, 100%); padding: 0.6rem 0.8rem; border-radius: 6px; border: 1px solid #ffd700; background: rgba(0,0,0,0.35); color: #ffd700;"
      />
    </p>
    <p id="${id}-count" data-count style="${counterStyles}">${byteLength(value)} of ${maxBytes} bytes</p>
    <p id="${id}-status" data-status style="${statusStyles}"></p>
  `;
}

export const TitleField: Story = {
  args: {
    initialValue: "My Su Squares",
  } satisfies ByteFieldArgs,
  render: (args) => {
    const content = renderByteFieldSection(
      TITLE_SECTION_ID,
      "Enter title",
      "Enter a title for your Squares. Later you can change the title of each Square individually.",
      "e.g. My Su Squares",
      64,
      args.initialValue ?? ""
    );
    return renderLeadSection(content);
  },
  play: async ({ args }) => {
    initByteLimitedField(TITLE_SECTION_ID, {
      maxBytes: 64,
      minBytes: 1,
      initialValue: args.initialValue ?? "",
      emptyMessage: "Enter at least 1 byte.",
    });
  },
};

const URL_SECTION_ID = "sb-url-field";

export const UrlField: Story = {
  args: {
    initialValue: "https://example.com",
  } satisfies ByteFieldArgs,
  render: (args) => {
    const content = `
      ${renderByteFieldSection(
        URL_SECTION_ID,
        "Enter URL",
        "Enter a URL for your Squares. Later you can change the URL of each Square individually. Typically this will start with https://.",
        "e.g. https://example.com",
        96,
        args.initialValue ?? ""
      )}
    `;
    return renderLeadSection(content);
  },
  play: async ({ args }) => {
    initByteLimitedField(URL_SECTION_ID, {
      maxBytes: 96,
      minBytes: 1,
      initialValue: args.initialValue ?? "",
      emptyMessage: "Enter a valid URL (1-96 bytes).",
    });
  },
};

interface ByteFieldConfig {
  maxBytes: number;
  minBytes: number;
  initialValue: string;
  emptyMessage: string;
}

function initByteLimitedField(sectionId: string, config: ByteFieldConfig) {
  if (typeof window === "undefined") return;
  const container = document.getElementById(sectionId);
  const input = container?.querySelector<HTMLInputElement>("input");
  const counter = container?.querySelector<HTMLElement>("[data-count]");
  const status = container?.querySelector<HTMLElement>("[data-status]");
  if (!input || !counter || !status) return;

  const evaluate = (value: string) => {
    const bytes = byteLength(value);
    counter.textContent = `${bytes} of ${config.maxBytes} bytes`;
    if (!value || bytes < config.minBytes) {
      setStatus(status, "hint", config.emptyMessage);
      return;
    }
    if (bytes > config.maxBytes) {
      setStatus(status, "error", `Too long by ${bytes - config.maxBytes} byte(s).`);
      return;
    }
    setStatus(status, "success", "Looks good.");
  };

  input.value = config.initialValue;
  evaluate(config.initialValue);
  input.addEventListener("input", (event) => {
    evaluate((event.target as HTMLInputElement).value);
  });
}

// Image uploader //////////////////////////////////////////////////////////////

const IMAGE_SECTION_ID = "sb-image-selector";

export const ImageSelectionField: Story = {
  render: () => {
    const body = `
      ${renderHeading("Upload image")}
      ${renderParagraph("Design your image carefully.")}
      ${renderParagraph("Do not use animation or transparency. PNG and some other formats can be used here.")}
      ${renderParagraph("Each Square is 10×10 pixels. For example, if the area you want to personalize is 3 Squares wide and 2 Squares tall, your image must be 30×20 pixels.")}
      <p style="margin: 0;">
        <input
          id="${IMAGE_SECTION_ID}-input"
          type="file"
          accept="image/png, image/jpeg, image/gif"
          style="color: #ffd700;"
        />
      </p>
      <p style="margin:0; color:#ffd700;">Image status: <span data-image-status style="font-weight:600;">no image selected</span></p>
      <canvas
        id="${IMAGE_SECTION_ID}-preview"
        width="0"
        height="0"
        style="border: 1px dashed rgba(255,255,255,0.35); width: min(360px, 100%); image-rendering: pixelated;"
      ></canvas>
    `;
    return renderLeadSection(body);
  },
  play: async () => {
    if (typeof window === "undefined") return;
    const container = document.getElementById(IMAGE_SECTION_ID);
    if (!container) return;
    const input = container.querySelector<HTMLInputElement>("input[type='file']");
    const statusSpan = container.querySelector<HTMLElement>("[data-image-status]");
    const canvas = container.querySelector<HTMLCanvasElement>("canvas");
    if (!input || !statusSpan || !canvas) return;

    let currentUrl: string | null = null;

    const resetCanvas = () => {
      canvas.width = 0;
      canvas.height = 0;
      const ctx = canvas.getContext("2d");
      ctx?.clearRect(0, 0, canvas.width, canvas.height);
    };

    const updateStatus = (state: StatusState, message: string) => {
      const color = state === "error" ? "#ffb3b3" : state === "success" ? "#b9ffd4" : "#ffd700";
      statusSpan.style.color = color;
      statusSpan.textContent = message;
    };

    const cleanupUrl = () => {
      if (currentUrl) {
        URL.revokeObjectURL(currentUrl);
        currentUrl = null;
      }
    };

    const handleFile = (file: File) => {
      cleanupUrl();
      const img = new Image();
      img.addEventListener("load", () => {
        const { width, height, naturalWidth, naturalHeight } = img;
        if (width % 10 !== 0 || height % 10 !== 0) {
          resetCanvas();
          updateStatus("error", "Image must use 10px increments.");
          return;
        }
        if (width < 10 || height < 10) {
          resetCanvas();
          updateStatus("error", "Image must be at least 10×10 pixels.");
          return;
        }
        if (width > 1000 || height > 1000) {
          resetCanvas();
          updateStatus("error", "Image must be at most 1000px per side.");
          return;
        }
        if (naturalWidth !== width || naturalHeight !== height) {
          resetCanvas();
          updateStatus("error", "Animated images are not supported.");
          return;
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx?.clearRect(0, 0, width, height);
        ctx?.drawImage(img, 0, 0);
        const squaresWide = width / 10;
        const squaresTall = height / 10;
        updateStatus(
          "success",
          `${width}×${height} px (${squaresWide}×${squaresTall} Squares) · ready to personalize`
        );
      });
      img.addEventListener("error", () => {
        resetCanvas();
        updateStatus("error", "Unable to read that image.");
      });
      currentUrl = URL.createObjectURL(file);
      img.src = currentUrl;
    };

    input.addEventListener("change", (event) => {
      resetCanvas();
      const target = event.target as HTMLInputElement;
      const file = target.files?.[0];
      if (!file) {
        updateStatus("hint", "No image selected.");
        cleanupUrl();
        return;
      }
      updateStatus("hint", "Loading image…");
      handleFile(file);
    });
  },
};

// Preflight textarea //////////////////////////////////////////////////////////

const PREFLIGHT_SECTION_ID = "sb-preflight-field";

const SAMPLE_PREFLIGHT = [
  "101\tMy Su Squares\thttps://example.com\t0x" + "00".repeat(300),
  "102\tMy Su Squares\thttps://example.com\t0x" + "11".repeat(300),
].join("\n");

interface PreflightStoryArgs {
  initialValue: string;
}

export const PreflightTextarea: Story = {
  args: {
    initialValue: SAMPLE_PREFLIGHT,
  } satisfies PreflightStoryArgs,
  render: (args) => {
    const body = `
      ${renderHeading("Preflight output")}
      ${renderParagraph("To manually edit individual Squares, copy/paste to a spreadsheet, edit, and then copy/paste back here.", true)}
      <textarea
        id="${PREFLIGHT_SECTION_ID}-textarea"
        rows="8"
        style="width: 100%; min-height: 180px; padding: 0.75rem; border-radius: 6px; border: 1px solid #ffd700; background: rgba(0,0,0,0.35); color: #ffd700;"
        spellcheck="false"
      >${args.initialValue}</textarea>
      <p data-status style="${statusStyles}" id="${PREFLIGHT_SECTION_ID}-status"></p>
    `;
    return renderLeadSection(body);
  },
  play: async ({ args }) => {
    if (typeof window === "undefined") return;
    const container = document.getElementById(PREFLIGHT_SECTION_ID);
    const textarea = container?.querySelector<HTMLTextAreaElement>("textarea");
    const status = container?.querySelector<HTMLElement>("[data-status]");
    if (!textarea || !status) return;

    const evaluate = (value: string) => {
      const trimmed = value.trim();
      if (!trimmed) {
        setStatus(status, "hint", "Paste at least one row to begin.");
        return;
      }
      const lines = trimmed.split(/\r\n|\n|\r/);
      for (let i = 0; i < lines.length; i += 1) {
        const cols = lines[i].split(/\t/);
        if (cols.length !== 4) {
          setStatus(status, "error", `Row ${i + 1} should have 4 columns.`);
          return;
        }
        const [squareText, title, url, rgbHex] = cols;
        const squareNumber = Number.parseInt(squareText, 10);
        if (!Number.isInteger(squareNumber) || squareNumber < 1 || squareNumber > 10000) {
          setStatus(status, "error", `Row ${i + 1}: invalid square number.`);
          return;
        }
        const titleBytes = byteLength(title);
        if (titleBytes < 1 || titleBytes > 64) {
          setStatus(status, "error", `Row ${i + 1}: title must be 1-64 bytes.`);
          return;
        }
        const urlBytes = byteLength(url);
        if (urlBytes < 1 || urlBytes > 96) {
          setStatus(status, "error", `Row ${i + 1}: URL must be 1-96 bytes.`);
          return;
        }
        if (rgbHex.length !== 602 || !rgbHex.match(/^0x[0-9a-f]{600}$/i)) {
          setStatus(status, "error", `Row ${i + 1}: pixel data must be 0x followed by 600 hex chars.`);
          return;
        }
      }
      setStatus(status, "success", `Ready to personalize ${lines.length} Squares.`);
    };

    textarea.value = args.initialValue ?? SAMPLE_PREFLIGHT;
    evaluate(textarea.value);
    textarea.addEventListener("input", (event) => {
      evaluate((event.target as HTMLTextAreaElement).value);
    });
  },
};
