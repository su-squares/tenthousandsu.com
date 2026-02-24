import type { Meta, StoryObj } from "@storybook/html";
import "@assets/css/main.css";
import "@assets/css/article.css";
import "@assets/nav-menu/nav.css";
import { navHeaderWithOverlayMarkup, navOverlayMarkup } from "./nav-header.fixture";

const meta: Meta = {
  title: "Nav/Main Menu",
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
  },
};

export default meta;

type Story = StoryObj;

const STORY_CONTAINER_ID = "sb-main-nav-menu";
const OVERLAY_STORY_ID = "sb-main-nav-overlay";
const ARTICLES_STORY_ID = "sb-main-nav-articles";

const ARTICLE_LINK_TEMPLATES = [
  "Launch Recap",
  "Su Story",
  "Community Insights",
  "Creator Notes",
  "Sneak Peeks",
  "Patch Notes",
  "Guest List",
  "Collector Spotlight",
  "Squad Goals",
  "Future Plans",
];

function buildStoryFrame(content: string) {
  return `
    <div
      id="${STORY_CONTAINER_ID}"
      style="
        min-height: 100vh;
        padding: 2.25rem 1.5rem 3rem;
        display: flex;
        flex-direction: column;
        gap: 1.5rem;
        background: transparent;
      "
    >
      ${content}
      <hr style="border-color: rgba(255, 255, 255, 0.35); width: min(1024px, 100%); margin: 0;" />
      <article class="lead" style="max-width: var(--max-width-content);">
        <p>
          Click the hamburger to open the main menu overlay, then hit the <strong>Articles</strong> button to exercise the articles modal.
          The injected menu script mirrors the production behavior so the same focus traps, close buttons, and Escape handling work here.
        </p>
      </article>
    </div>
  `;
}

let injectedMenuScript: HTMLScriptElement | null = null;

function resetOverlayState() {
  const overlay = document.querySelector(".su-nav-overlay");
  const modals = document.querySelectorAll<HTMLElement>(".su-nav-modal");
  overlay?.classList.remove("is-visible");
  overlay?.setAttribute("aria-hidden", "true");
  modals.forEach((modal) => {
    modal.classList.remove("is-active");
    modal.setAttribute("aria-hidden", "true");
  });
  const hamburger = document.querySelector(".su-nav-hamburger");
  hamburger?.setAttribute("aria-expanded", "false");
}

function loadMenuScript() {
  if (injectedMenuScript) {
    injectedMenuScript.remove();
    injectedMenuScript = null;
  }

  return new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `/assets/nav-menu/menu.js?story=${Date.now()}`;
    script.async = true;
    script.addEventListener("load", () => resolve());
    script.addEventListener("error", () => reject(new Error("Failed to load nav menu script")));
    document.body.appendChild(script);
    injectedMenuScript = script;
  });
}

function showModal(root: HTMLElement | null, modalId: string) {
  if (!root) return;
  const modal = root.querySelector<HTMLElement>(`#${modalId}`);
  if (!modal) return;
  modal.classList.add("is-active");
  modal.setAttribute("aria-hidden", "false");
}

function hideModal(root: HTMLElement | null, modalId: string) {
  if (!root) return;
  const modal = root.querySelector<HTMLElement>(`#${modalId}`);
  if (!modal) return;
  modal.classList.remove("is-active");
  modal.setAttribute("aria-hidden", "true");
}

function ensureOverlayVisible(root: HTMLElement | null) {
  if (!root) return;
  const overlay = root.querySelector<HTMLElement>(".su-nav-overlay");
  if (!overlay) return;
  overlay.classList.add("is-visible");
  overlay.setAttribute("aria-hidden", "false");
}

function buildArticleLinks(count: number) {
  return Array.from({ length: count }, (_, index) => {
    const label = ARTICLE_LINK_TEMPLATES[index % ARTICLE_LINK_TEMPLATES.length];
    const num = index + 1;
    return `
      <a
        class="su-nav-article-link"
        data-nav-path="/articles/${label.toLowerCase().replace(/\s+/g, "-")}-${num}"
        href="/articles/${label.toLowerCase().replace(/\s+/g, "-")}-${num}"
      >
        Article ${num}: ${label}
      </a>
    `;
  }).join("");
}

export const HamburgerMainMenu: Story = {
  render: () => buildStoryFrame(navHeaderWithOverlayMarkup),
  play: async () => {
    resetOverlayState();
    await loadMenuScript();
  },
};

export const MainMenuOverlay: Story = {
  render: () => `<div id="${OVERLAY_STORY_ID}">${navOverlayMarkup}</div>`,
  play: async () => {
    const root = document.getElementById(OVERLAY_STORY_ID);
    ensureOverlayVisible(root);
    showModal(root, "su-nav-main-modal");
    hideModal(root, "su-nav-articles-modal");
  },
};

interface ArticlesStoryArgs {
  articleCount: 3 | 10 | 20;
}

export const ArticlesSubmenu: StoryObj<ArticlesStoryArgs> = {
  args: {
    articleCount: 10,
  },
    argTypes: {
      articleCount: {
        control: { type: "inline-radio" },
        options: [3, 10, 20],
      },
    },
  render: (args) => `<div id="${ARTICLES_STORY_ID}">${navOverlayMarkup}</div>`,
  play: async ({ args }) => {
    const root = document.getElementById(ARTICLES_STORY_ID);
    if (!root) return;
    ensureOverlayVisible(root);
    hideModal(root, "su-nav-main-modal");
    showModal(root, "su-nav-articles-modal");
    const articles = root.querySelector<HTMLElement>(".su-nav-articles");
    if (articles) {
      articles.innerHTML = buildArticleLinks(args.articleCount);
    }
  },
};
