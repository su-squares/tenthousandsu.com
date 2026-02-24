const mainNavLinks = [
  { label: "Home", path: "/" },
  { label: "Mint", path: "/buy" },
  { label: "Personalize", path: "/personalize" },
  { label: "Batch mode", path: "/personalize-batch", extraClass: "su-nav-btn--batch" },
  { label: "About us", path: "/white-paper" },
  { label: "FAQ", path: "/faq" },
];

const articlePlaceholderLinks = [
  { label: "Launch Recap", path: "/articles/launch-recap" },
  { label: "Su Story", path: "/articles/su-story" },
  { label: "Community Insights", path: "/articles/community" },
];

const LOGO_SRC = "/assets/images/logo-su-squares.svg";

function buildNavButtons() {
  const links = [...mainNavLinks];
  const rowLinks = links.splice(3, 2);
  const topLinks = links.slice(0, 3);

  const topHtml = topLinks
    .map(
      (link) =>
        `<a class="su-nav-btn" data-nav-path="${link.path}" href="${link.path}"
          >${link.label}</a>`
    )
    .join("");

  const rowHtml = rowLinks
    .map(
      (link) =>
        `<a class="su-nav-btn ${link.extraClass || ""}" data-nav-path="${link.path}" href="${link.path}">
          ${link.label}
        </a>`
    )
    .join("");

  const remaining = mainNavLinks.slice(5);
  const tailHtml = remaining
    .map(
      (link) =>
        `<a class="su-nav-btn" data-nav-path="${link.path}" href="${link.path}"
          >${link.label}</a>`
    )
    .join("");

  return `
    <div class="su-nav-buttons">
      ${topHtml}
      <div class="su-nav-buttons-row">${rowHtml}</div>
      ${tailHtml}
      <button
        class="su-nav-btn su-nav-btn-articles"
        type="button"
        aria-controls="su-nav-articles-modal"
        data-nav-path="/articles"
      >
        Articles
        <svg class="su-nav-arrow-right" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="#ffd700" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M5 12h14M13 6l6 6-6 6"/>
        </svg>
      </button>
    </div>
  `;
}

function buildArticleLinks() {
  return articlePlaceholderLinks
    .map(
      (link) =>
        `<a class="su-nav-article-link" data-nav-path="${link.path}" href="${link.path}"
          >${link.label}</a>`
    )
    .join("");
}

export const navHeaderMarkup = `
  <header class="su-nav-header" role="banner">
    <a class="su-nav-logo" href="/">
      <img src="${LOGO_SRC}" alt="Su Squares logo">
    </a>
    <div class="su-nav-actions">
      <a class="btn su-nav-desktop-extra" href="/buy">Mint</a>
      <span class="su-nav-desktop-tagline">The first ERC-721 NFT</span>
      <button class="btn su-nav-connect" type="button" aria-label="Connect wallet"
      style="padding-bottom: 10px; padding-top: 0;" >
      Connect<br>Wallet
    </button>

    </div>
    <button class="su-nav-hamburger" type="button" aria-label="Open menu" aria-expanded="false" aria-controls="su-nav-main-modal">
      <span aria-hidden="true"></span>
      <span aria-hidden="true"></span>
      <span aria-hidden="true"></span>
    </button>
  </header>
`;

export const navOverlayMarkup = `
  <div class="su-nav-overlay" aria-hidden="true">
    <div class="su-nav-modal" id="su-nav-main-modal" role="dialog" aria-modal="true" aria-label="Main menu" aria-hidden="true" tabindex="-1">
      <div class="su-nav-modal__top">
        <span class="su-nav-main-placeholder" aria-hidden="true"></span>
        <div class="su-nav-social">
          <a href="https://x.com/susquares" target="_blank" rel="noopener" aria-label="Su Squares on X">
            <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 16 16">
              <path d="M12.6.75h2.454l-5.36 6.142L16 15.25h-4.937l-3.867-5.07-4.425 5.07H.316l5.733-6.57L0 .75h5.063l3.495 4.633L12.601.75Zm-.86 13.028h1.36L4.323 2.145H2.865l8.875 11.633Z" />
            </svg>
          </a>
          <a href="https://discord.gg/6nTGNdjQ3B" target="_blank" rel="noopener" aria-label="Su Squares on Discord">
            <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 16 16">
              <path d="M13.545 2.907a13.227 13.227 0 0 0-3.257-1.011.05.05 0 0 0-.052.025c-.141.25-.297.577-.406.833a12.19 12.19 0 0 0-3.658 0 8.258 8.258 0 0 0-.412-.833.051.051 0 0 0-.052-.025c-1.125.194-2.22.534-3.257 1.011a.041.041 0 0 0-.021.018C.356 6.024-.213 9.047.066 12.032c.001.014.01.028.021.037a13.276 13.276 0 0 0 3.995 2.02.05.05 0 0 0 .056-.019c.308-.42.582-.863.818-1.329a.05.05 0 0 0-.01-.059.051.051 0 0 0-.018-.011 8.875 8.875 0 0 1-1.248-.595.05.05 0 0 1-.02-.066.051.051 0 0 1 .015-.019c.084-.063.168-.129.248-.195a.05.05 0 0 1 .051-.007c2.619 1.196 5.454 1.196 8.041 0a.052.052 0 0 1 .053.007c.08.066.164.132.248.195a.051.051 0 0 1-.004.085 8.254 8.254 0 0 1-1.249.594.05.05 0 0 0-.03.03.052.052 0 0 0 .003.041c.24.465.515.909.817 1.329a.05.05 0 0 0 .056.019 13.235 13.235 0 0 0 4.001-2.02.049.049 0 0 0 .021-.037c.334-3.451-.559-6.449-2.366-9.106a.034.034 0 0 0-.02-.019Zm-8.198 7.307c-.789 0-1.438-.724-1.438-1.612 0-.889.637-1.613 1.438-1.613.807 0 1.45.73 1.438 1.613 0 .888-.637 1.612-1.438 1.612Zm5.316 0c-.788 0-1.438-.724-1.438-1.612 0-.889.637-1.613 1.438-1.613.807 0 1.451.73 1.438 1.613 0 .888-.631 1.612-1.438 1.612Z" />
            </svg>
          </a>
          <a href="https://opensea.io/collection/su-squares" target="_blank" rel="noopener" aria-label="Su Squares on OpenSea">
            <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 360 360">
              <path d="M181.57,0C80.92-.82-.82,80.92,0,181.57c.85,97.74,80.69,177.61,178.42,178.42,100.66.86,182.43-80.91,181.57-181.57C359.18,80.72,279.31.85,181.57,0ZM127.75,89.59c11.52,14.63,18.41,33.16,18.41,53.24,0,17.41-5.17,33.61-14.04,47.12h-62.41l58.01-100.39.02.02ZM318.01,199.25v12.96c0,.85-.45,1.57-1.22,1.89-4.23,1.8-18.18,8.28-23.99,16.34-14.98,20.84-26.41,53.6-51.97,53.6h-106.65c-37.76,0-69.35-29.97-69.34-69.89,0-.99.85-1.8,1.84-1.8h50.54c1.75,0,3.11,1.4,3.11,3.11v9.76c0,5.18,4.19,9.4,9.4,9.4h38.34v-22.32h-26.19c15.07-19.08,24.03-43.16,24.03-69.39,0-29.25-11.21-55.93-29.57-75.87,11.11,1.3,21.73,3.51,31.73,6.44v-6.21c0-6.44,5.22-11.66,11.66-11.66s11.66,5.22,11.66,11.66v14.98c35.78,16.7,59.22,44.42,59.22,75.78,0,18.4-8.05,35.51-21.92,49.91-2.66,2.75-6.35,4.32-10.22,4.32h-27.05v22.28h33.97c7.33,0,20.47-13.9,26.69-22.27,0,0,.27-.41.99-.63s62.37-14.36,62.37-14.36c1.3-.36,2.57.63,2.57,1.94v.02Z" />
            </svg>
          </a>
        </div>
        <button class="su-nav-close" type="button" aria-label="Close menu">
          <span aria-hidden="true">&#10005;</span>
        </button>
      </div>
      <nav aria-label="Main navigation">
        ${buildNavButtons()}
      </nav>
    </div>

    <div class="su-nav-modal" id="su-nav-articles-modal" role="dialog" aria-modal="true" aria-label="Articles" aria-hidden="true" tabindex="-1">
      <div class="su-nav-modal__top">
        <button class="su-nav-back" type="button" aria-label="Back to main menu" aria-controls="su-nav-main-modal">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="#ffffff" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
          </svg>
        </button>
        <div class="su-nav-social">
          <a href="https://x.com/susquares" target="_blank" rel="noopener" aria-label="Su Squares on X">
            <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 16 16">
              <path d="M12.6.75h2.454l-5.36 6.142L16 15.25h-4.937l-3.867-5.07-4.425 5.07H.316l5.733-6.57L0 .75h5.063l3.495 4.633L12.601.75Zm-.86 13.028h1.36L4.323 2.145H2.865l8.875 11.633Z" />
            </svg>
          </a>
          <a href="https://discord.gg/6nTGNdjQ3B" target="_blank" rel="noopener" aria-label="Su Squares on Discord">
            <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 16 16">
              <path d="M13.545 2.907a13.227 13.227 0 0 0-3.257-1.011.05.05 0 0 0-.052.025c-.141.25-.297.577-.406.833a12.19 12.19 0 0 0-3.658 0 8.258 8.258 0 0 0-.412-.833.051.051 0 0 0-.052-.025c-1.125.194-2.22.534-3.257 1.011a.041.041 0 0 0-.021.018C.356 6.024-.213 9.047.066 12.032c.001.014.01.028.021.037a13.276 13.276 0 0 0 3.995 2.02.05.05 0 0 0 .056-.019c.308-.42.582-.863.818-1.329a.05.05 0 0 0-.01-.059.051.051 0 0 0-.018-.011 8.875 8.875 0 0 1-1.248-.595.05.05 0 0 1-.02-.066.051.051 0 0 1 .015-.019c.084-.063.168-.129.248-.195a.05.05 0 0 1 .051-.007c2.619 1.196 5.454 1.196 8.041 0a.052.052 0 0 1 .053.007c.08.066.164.132.248.195a.051.051 0 0 1-.004.085 8.254 8.254 0 0 1-1.249.594.05.05 0 0 0-.03.03.052.052 0 0 0 .003.041c.24.465.515.909.817 1.329a.05.05 0 0 0 .056.019 13.235 13.235 0 0 0 4.001-2.02.049.049 0 0 0 .021-.037c.334-3.451-.559-6.449-2.366-9.106a.034.034 0 0 0-.02-.019Zm-8.198 7.307c-.789 0-1.438-.724-1.438-1.612 0-.889.637-1.613 1.438-1.613.807 0 1.45.73 1.438 1.613 0 .888-.637 1.612-1.438 1.612Zm5.316 0c-.788 0-1.438-.724-1.438-1.612 0-.889.637-1.613 1.438-1.613.807 0 1.451.73 1.438 1.613 0 .888-.631 1.612-1.438 1.612Z" />
            </svg>
          </a>
          <a href="https://opensea.io/collection/su-squares" target="_blank" rel="noopener" aria-label="Su Squares on OpenSea">
            <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 360 360">
              <path d="M181.57,0C80.92-.82-.82,80.92,0,181.57c.85,97.74,80.69,177.61,178.42,178.42,100.66.86,182.43-80.91,181.57-181.57C359.18,80.72,279.31.85,181.57,0ZM127.75,89.59c11.52,14.63,18.41,33.16,18.41,53.24,0,17.41-5.17,33.61-14.04,47.12h-62.41l58.01-100.39.02.02ZM318.01,199.25v12.96c0,.85-.45,1.57-1.22,1.89-4.23,1.8-18.18,8.28-23.99,16.34-14.98,20.84-26.41,53.6-51.97,53.6h-106.65c-37.76,0-69.35-29.97-69.34-69.89,0-.99.85-1.8,1.84-1.8h50.54c1.75,0,3.11,1.4,3.11,3.11v9.76c0,5.18,4.19,9.4,9.4,9.4h38.34v-22.32h-26.19c15.07-19.08,24.03-43.16,24.03-69.39,0-29.25-11.21-55.93-29.57-75.87,11.11,1.3,21.73,3.51,31.73,6.44v-6.21c0-6.44,5.22-11.66,11.66-11.66s11.66,5.22,11.66,11.66v14.98c35.78,16.7,59.22,44.42,59.22,75.78,0,18.4-8.05,35.51-21.92,49.91-2.66,2.75-6.35,4.32-10.22,4.32h-27.05v22.28h33.97c7.33,0,20.47-13.9,26.69-22.27,0,0,.27-.41.99-.63s62.37-14.36,62.37-14.36c1.3-.36,2.57.63,2.57,1.94v.02Z" />
            </svg>
          </a>
        </div>
        <button class="su-nav-close" type="button" aria-label="Close articles menu">
          <span aria-hidden="true">&#10005;</span>
        </button>
      </div>
      <div class="su-nav-modal__title">Articles</div>
      <nav aria-label="Article navigation">
        <div class="su-nav-articles">
          ${buildArticleLinks()}
        </div>
      </nav>
    </div>
  </div>
`;

export const navHeaderWithOverlayMarkup = `${navHeaderMarkup}${navOverlayMarkup}`;
