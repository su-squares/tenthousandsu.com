import type { Page } from '@playwright/test';

const TOTAL_SQUARES = 10000;
const GRID_DIMENSION = 100;
const CELL_SIZE = 10;
const IMAGE_SIZE = GRID_DIMENSION * CELL_SIZE;

export type MockBillboardOptions = {
  ownedAndPersonalizedIds?: number[];
  ownedNotPersonalizedIds?: number[];
  ownedBySomeoneElseIds?: number[];
  blockedSquareIds?: number[];
  blockedDomains?: string[];
};

function normalizeSquareIds(ids: number[] = []): number[] {
  return Array.from(new Set(ids.map((value) => Number(value))))
    .filter((value) => Number.isInteger(value) && value >= 1 && value <= TOTAL_SQUARES);
}

async function routeJson(page: Page, pattern: string | RegExp, body: string) {
  await page.route(pattern, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body,
    })
  );
}

async function routeSvg(page: Page, pattern: string | RegExp, body: string) {
  await page.route(pattern, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'image/svg+xml',
      body,
    })
  );
}

function buildPersonalizedSvg(personalizedIds: number[]) {
  const rects = personalizedIds
    .map((squareId) => {
      const index = squareId - 1;
      const row = Math.floor(index / GRID_DIMENSION);
      const col = index % GRID_DIMENSION;
      const x = col * CELL_SIZE;
      const y = row * CELL_SIZE;
      return `<rect x="${x}" y="${y}" width="${CELL_SIZE}" height="${CELL_SIZE}" fill="#ff0000" />`;
    })
    .join('');

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${IMAGE_SIZE}" height="${IMAGE_SIZE}" viewBox="0 0 ${IMAGE_SIZE} ${IMAGE_SIZE}">`,
    `<rect width="${IMAGE_SIZE}" height="${IMAGE_SIZE}" fill="#ffffff" />`,
    rects,
    '</svg>',
  ].join('');
}

function setPersonalized(
  personalizations: Array<[string, string] | null>,
  extra: Array<[number, number, boolean, number] | null>,
  squareId: number,
  label: string,
  href: string
) {
  personalizations[squareId - 1] = [label, href];
  extra[squareId - 1] = [0, 0, true, 1];
}

function setMintedUnpersonalized(
  personalizations: Array<[string, string] | null>,
  extra: Array<[number, number, boolean, number] | null>,
  squareId: number
) {
  personalizations[squareId - 1] = ['', ''];
  extra[squareId - 1] = [0, 0, false, 1];
}

export async function installMockBillboard(page: Page, options: MockBillboardOptions = {}) {
  const ownedAndPersonalizedIds = normalizeSquareIds(options.ownedAndPersonalizedIds);
  const ownedNotPersonalizedIds = normalizeSquareIds(options.ownedNotPersonalizedIds);
  const ownedBySomeoneElseIds = normalizeSquareIds(options.ownedBySomeoneElseIds);
  const blockedSquareIds = normalizeSquareIds(options.blockedSquareIds);
  const blockedDomains = Array.from(
    new Set((options.blockedDomains || []).map((domain) => String(domain).toLowerCase().trim()))
  ).filter(Boolean);

  const personalizations: Array<[string, string] | null> = Array.from(
    { length: TOTAL_SQUARES },
    () => null
  );
  const extra: Array<[number, number, boolean, number] | null> = Array.from(
    { length: TOTAL_SQUARES },
    () => null
  );

  ownedAndPersonalizedIds.forEach((squareId) => {
    setPersonalized(
      personalizations,
      extra,
      squareId,
      `Owned ${squareId}`,
      `https://example.com/${squareId}`
    );
  });

  ownedNotPersonalizedIds.forEach((squareId) => {
    setMintedUnpersonalized(personalizations, extra, squareId);
  });

  ownedBySomeoneElseIds.forEach((squareId) => {
    setPersonalized(
      personalizations,
      extra,
      squareId,
      `Other ${squareId}`,
      `https://example.com/other/${squareId}`
    );
  });

  const personalizedIds = normalizeSquareIds([
    ...ownedAndPersonalizedIds,
    ...ownedBySomeoneElseIds,
  ]);
  const svg = buildPersonalizedSvg(personalizedIds);

  await routeJson(page, /squarePersonalizations\.json/i, JSON.stringify(personalizations));
  await routeJson(page, /squareExtra\.json/i, JSON.stringify(extra));
  await routeJson(page, /blocklist-squares\.json/i, JSON.stringify({ blocked: blockedSquareIds }));
  await routeJson(page, /blocklist-domains\.json/i, JSON.stringify(blockedDomains));
  await routeSvg(page, /wholeSquare\.png/i, svg);
}
