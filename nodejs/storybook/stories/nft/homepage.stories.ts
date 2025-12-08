import type { Meta, StoryObj } from "@storybook/html";
import "@assets/css/main.css";
import "@assets/css/index.css";
import "@assets/css/chooser.css";
import { createPanZoom } from "@assets/js/pan-zoom.js";

type Story = StoryObj;

const meta: Meta = {
  title: "NFT/Homepage",
  parameters: {
    layout: "fullscreen",
  },
};

export default meta;

declare global {
  interface Window {
    SITE_BASEURL?: string;
    suNormalizeHref?: (href: string) => string;
  }
}

type SquarePersonalization = [string, string] | null;
type SquareExtraEntry = [number, number, boolean, number] | null;

const GRID_DIMENSION = 100;
const MAP_ROOT_ID = "sb-nft-map";
const FEED_ROOT_ID = "sb-nft-feed";

let squareDataPromise: Promise<{
  personalizations: SquarePersonalization[];
  extra: SquareExtraEntry[];
}> | null = null;

function resolveAssetUrl(path: string) {
  if (typeof window === "undefined") return path;
  const base = window.SITE_BASEURL || "";
  if (path.startsWith("/")) {
    return `${base}${path}`;
  }
  return `${base}/${path}`;
}

async function loadSquareData() {
  if (!squareDataPromise) {
    const personalizationsUrl = resolveAssetUrl("/build/squarePersonalizations.json");
    const extraUrl = resolveAssetUrl("/build/squareExtra.json");
    squareDataPromise = Promise.all([fetch(personalizationsUrl), fetch(extraUrl)])
      .then(async ([persRes, extraRes]) => {
        if (!persRes.ok || !extraRes.ok) {
          throw new Error("Failed to fetch board data");
        }
        const [personalizations, extra] = await Promise.all([persRes.json(), extraRes.json()]);
        return { personalizations, extra };
      })
      .catch((error) => {
        squareDataPromise = null;
        throw error;
      });
  }
  return squareDataPromise;
}

function renderMapStory() {
  return `
    <div class="page-home" style="padding: 2rem;">
      <article id="${MAP_ROOT_ID}" style="display: grid; gap: 0.75rem; max-width: 1040px; margin: 0 auto; color: #ffd700;">
        <h1 class="home-title">The first <span class="no-break">ERC-721</span> NFT</h1>
        <p style="color: #ffd700;">
          Click an empty square to mint an available Su Square. Clicking an already minted and personalized one will activate its hyperlink.
        </p>
        <p class="mobile-hint" style="color: #ffd700;">Pinch to zoom, drag to pan</p>
        <a class="map-container" data-map-anchor target="_blank" rel="noopener noreferrer">
          <div class="map-wrapper">
            <img data-map-image class="map-image" alt="All Su Squares" />
            <div class="map-position" data-map-position></div>
            <div class="map-tooltip" data-map-tooltip style="color: #ffd700;"></div>
            <div class="map-fence" data-map-fence></div>
          </div>
        </a>
        <button type="button" class="map-reset-btn" data-map-reset>Reset zoom</button>
        <p data-map-status style="text-align:center; color: #ffd700; margin-top: 0.5rem;">
          Loading board dataƒ?İ
        </p>
      </article>
    </div>
  `;
}

function renderFeedStory() {
  return `
    <div class="page-home" style="padding: 2rem;">
      <article class="newly-feed" id="${FEED_ROOT_ID}" style="color: #ffd700;">
        <section class="newly-feed__section">
          <strong class="newly-feed__heading">Newly minted</strong>
          <div class="newly-feed__items" data-feed-minted>
            <p data-feed-placeholder style="margin:0; color: #ffd700;">Loadingƒ?İ</p>
          </div>
        </section>
        <section class="newly-feed__section">
          <strong class="newly-feed__heading">Latest personalized</strong>
          <div class="newly-feed__items" data-feed-personalized>
            <p data-feed-placeholder style="margin:0; color: #ffd700;">Loadingƒ?İ</p>
          </div>
        </section>
      </article>
    </div>
  `;
}

function describeSquarePlacement(square: number) {
  const row = Math.floor((square - 1) / GRID_DIMENSION) + 1;
  const col = ((square - 1) % GRID_DIMENSION) + 1;
  return `Row ${row}, Column ${col}`;
}

function initMapInteractions(root: HTMLElement, data: { personalizations: SquarePersonalization[]; extra: SquareExtraEntry[] }) {
  const mapImage = root.querySelector<HTMLImageElement>("[data-map-image]");
  const positionEl = root.querySelector<HTMLDivElement>("[data-map-position]");
  const tooltipEl = root.querySelector<HTMLDivElement>("[data-map-tooltip]");
  const anchor = root.querySelector<HTMLAnchorElement>("[data-map-anchor]");
  const resetBtn = root.querySelector<HTMLButtonElement>("[data-map-reset]");
  const statusEl = root.querySelector<HTMLElement>("[data-map-status]");
  const wrapper = root.querySelector<HTMLElement>(".map-wrapper");
  if (!mapImage || !positionEl || !tooltipEl || !wrapper) return;

  const boardUrl = resolveAssetUrl("/build/wholeSquare.png");
  mapImage.src = boardUrl;
  if (statusEl) {
    statusEl.textContent = "Hover or tap to inspect squares.";
  }

  const panZoom = createPanZoom(wrapper);
  resetBtn?.addEventListener("click", () => {
    panZoom?.reset?.();
  });

  const normalizeHref =
    typeof window !== "undefined" && typeof window.suNormalizeHref === "function"
      ? window.suNormalizeHref
      : (href: string) => href;

  let activeSquare = 1;

  function getCellSize() {
    if (panZoom && panZoom.isActive) {
      return wrapper.offsetWidth / GRID_DIMENSION;
    }
    const rect = mapImage.getBoundingClientRect();
    return rect.width ? rect.width / GRID_DIMENSION : 10;
  }

  function setTooltipPosition(col: number, row: number, cellSize: number) {
    const isLeftHalf = col < GRID_DIMENSION / 2;
    const isBottomHalf = row >= GRID_DIMENSION / 2;

    if (isLeftHalf) {
      tooltipEl.style.left = `${col * cellSize + cellSize * 1.5}px`;
      tooltipEl.style.right = "auto";
    } else {
      tooltipEl.style.left = "auto";
      tooltipEl.style.right = `${(GRID_DIMENSION - col - 1) * cellSize + cellSize * 1.5}px`;
    }

    const horizontalOrigin = isLeftHalf ? "left" : "right";
    const verticalOrigin = isBottomHalf ? "bottom" : "top";
    tooltipEl.style.transformOrigin = `${horizontalOrigin} ${verticalOrigin}`;

    const verticalOffset = isBottomHalf ? -cellSize * 0.5 : cellSize * 1.5;
    const rawTop = row * cellSize + verticalOffset;
    const wrapperHeight = wrapper?.offsetHeight || GRID_DIMENSION * cellSize;
    const clampedTop = Math.min(Math.max(rawTop, 0), wrapperHeight - cellSize);
    tooltipEl.style.top = `${clampedTop}px`;

    if (panZoom && panZoom.isActive && typeof panZoom.scale === "number") {
      const scale = (panZoom as any).scale || 1;
      tooltipEl.style.transform = `scale(${1 / scale})`;
    } else {
      tooltipEl.style.transform = "";
    }
  }

  function updateActiveSquare(square: number) {
    activeSquare = square;
    const col = (square - 1) % GRID_DIMENSION;
    const row = Math.floor((square - 1) / GRID_DIMENSION);
    const cellSize = getCellSize();

    positionEl.style.display = "block";
    positionEl.style.width = `${cellSize}px`;
    positionEl.style.height = `${cellSize}px`;
    positionEl.style.left = `${col * cellSize}px`;
    positionEl.style.top = `${row * cellSize}px`;

    const details = data.personalizations[square - 1];
    const normalizedHref = details?.[1] ? normalizeHref(details[1]) : "";
    if (!details) {
      tooltipEl.textContent = `Square #${square} is available for sale, click to buy.`;
      anchor?.setAttribute("href", `/buy?square=${square}`);
    } else if (!details[0] && !details[1]) {
      tooltipEl.textContent = `Square #${square} was purchased but not yet personalized.`;
      anchor?.removeAttribute("href");
    } else {
      tooltipEl.textContent = `Square #${square} — ${details[0] || "Personalized square"}`;
      if (normalizedHref) {
        anchor?.setAttribute("href", normalizedHref);
      } else {
        anchor?.removeAttribute("href");
      }
    }

    if (anchor) {
      anchor.setAttribute("title", describeSquarePlacement(square));
    }

    tooltipEl.style.display = "block";
    setTooltipPosition(col, row, cellSize);
  }

  function clearSelection() {
    positionEl.style.display = "none";
    tooltipEl.style.display = "none";
  }

  function getSquareFromPointer(clientX: number, clientY: number) {
    let x: number;
    let y: number;
    if (panZoom && panZoom.isActive) {
      const coords = panZoom.screenToCanvas(clientX, clientY);
      x = coords.x;
      y = coords.y;
    } else {
      const rect = mapImage.getBoundingClientRect();
      x = clientX - rect.left;
      y = clientY - rect.top;
    }
    const cellSize = getCellSize();
    const col = Math.min(Math.max(Math.floor(x / cellSize), 0), GRID_DIMENSION - 1);
    const row = Math.min(Math.max(Math.floor(y / cellSize), 0), GRID_DIMENSION - 1);
    return row * GRID_DIMENSION + col + 1;
  }

  mapImage.addEventListener("mousemove", (event) => {
    const square = getSquareFromPointer(event.clientX, event.clientY);
    updateActiveSquare(square);
  });

  mapImage.addEventListener("mouseleave", () => {
    clearSelection();
  });

  mapImage.addEventListener("touchend", (event) => {
    if (panZoom && typeof (panZoom as any).hasPanned === "function" && (panZoom as any).hasPanned()) {
      return;
    }
    if (event.changedTouches && event.changedTouches[0]) {
      const touch = event.changedTouches[0];
      const square = getSquareFromPointer(touch.clientX, touch.clientY);
      updateActiveSquare(square);
    }
  });

  window.addEventListener("resize", () => {
    if (tooltipEl.style.display === "block") {
      updateActiveSquare(activeSquare);
    }
  });
}

function buildFeedItems(entries: Array<{ square: number; row: number; col: number }>, listEl: HTMLElement | null, emptyText: string) {
  if (!listEl) return;
  listEl.querySelectorAll<HTMLElement>("[data-feed-placeholder]").forEach((node) => node.remove());

  const boardUrl = resolveAssetUrl("/build/wholeSquare.png");
  if (!entries.length) {
    const emptyState = document.createElement("p");
    emptyState.style.margin = "0";
    emptyState.style.color = "#ffd700";
    emptyState.textContent = emptyText;
    listEl.appendChild(emptyState);
    return;
  }

  entries.forEach(({ square, row, col }) => {
    const item = document.createElement("a");
    item.className = "newly-feed__item";
    item.href = `/square#${square}`;
    item.target = "_blank";
    item.rel = "noopener noreferrer";

    const thumb = document.createElement("span");
    thumb.className = "newly-feed__thumb";
    thumb.style.backgroundImage = `url('${boardUrl}')`;
    thumb.style.backgroundPosition = `${-col * 10}px ${-row * 10}px`;

    const label = document.createElement("p");
    label.textContent = `#${square}`;

    item.appendChild(thumb);
    item.appendChild(label);
    listEl.appendChild(item);
  });
}

function getLatestSquares(extra: SquareExtraEntry[], type: "minted" | "personalized", limit = 5) {
  const comparator = type === "minted" ? (entry: SquareExtraEntry) => entry?.[0] ?? 0 : (entry: SquareExtraEntry) => entry?.[1] ?? 0;
  return extra
    .map((entry, index) => {
      if (!entry) return null;
      const [mintedBlock, updatedBlock] = entry;
      if (type === "personalized" && updatedBlock === mintedBlock) {
        return null;
      }
      return {
        square: index + 1,
        row: Math.floor(index / GRID_DIMENSION),
        col: index % GRID_DIMENSION,
        mintedBlock,
        updatedBlock,
        sortKey: comparator(entry),
      };
    })
    .filter((entry): entry is { square: number; row: number; col: number; mintedBlock: number; updatedBlock: number; sortKey: number } => Boolean(entry))
    .sort((a, b) => b.sortKey - a.sortKey)
    .slice(0, limit);
}

export const MainMap: Story = {
  render: () => renderMapStory(),
  play: async () => {
    const root = document.getElementById(MAP_ROOT_ID);
    if (!root) return;
    const statusEl = root.querySelector<HTMLElement>("[data-map-status]");
    try {
      const data = await loadSquareData();
      initMapInteractions(root, data);
      if (statusEl) {
        statusEl.textContent = "Hover or tap to inspect squares.";
      }
    } catch (error) {
      if (statusEl) {
        statusEl.textContent = "Unable to load board data.";
      }
      // eslint-disable-next-line no-console
      console.error("Storybook map init failed", error);
    }
  },
};

export const NewlyMintedFeed: Story = {
  render: () => renderFeedStory(),
  play: async () => {
    const root = document.getElementById(FEED_ROOT_ID);
    if (!root) return;
    const mintedList = root.querySelector<HTMLElement>("[data-feed-minted]");
    const personalizedList = root.querySelector<HTMLElement>("[data-feed-personalized]");
    try {
      const data = await loadSquareData();
      const mintedSquares = getLatestSquares(data.extra, "minted", 5).map(({ square, row, col }) => ({
        square,
        row,
        col,
      }));
      const personalizedSquares = getLatestSquares(data.extra, "personalized", 5).map(({ square, row, col }) => ({
        square,
        row,
        col,
      }));
      buildFeedItems(mintedSquares, mintedList, "No recent mints found.");
      buildFeedItems(personalizedSquares, personalizedList, "No recent personalizations found.");
    } catch (error) {
      const message = document.createElement("p");
      message.style.margin = "0";
      message.style.color = "#ffd700";
      message.textContent = "Unable to load feed data.";
      mintedList?.appendChild(message.cloneNode(true));
      personalizedList?.appendChild(message);
      // eslint-disable-next-line no-console
      console.error("Storybook feed init failed", error);
    }
  },
};
