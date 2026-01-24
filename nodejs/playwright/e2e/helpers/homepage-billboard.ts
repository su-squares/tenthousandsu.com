import { expect, type Page, type Locator } from '@playwright/test';
import {
  BLOCKED_DOMAINS_JSON,
  BLOCKED_SQUARES_JSON,
  HOMEPAGE_EXTRA_JSON,
  HOMEPAGE_PERSONALIZATIONS_JSON,
} from '../fixtures/homepage-billboard.js';

export const HOMEPAGE_SELECTORS = {
  grid: '[data-testid="billboard-grid"]',
  tooltip: '#tooltip',
  linkAnchor: '#wheretogo',
  leavingVisible: '.su-leaving-backdrop.is-visible',
  leavingUrl: '.su-leaving__url',
  leavingStay: '.su-leaving__button--stay',
  blockedVisible: '.su-blocked-backdrop.is-visible',
  blockedTitle: '.su-blocked__title',
  blockedButton: '.su-blocked__button',
};

export type HomepageRouteOverrides = {
  personalizationsJson?: string;
  extraJson?: string;
  blockedSquaresJson?: string;
  blockedDomainsJson?: string;
};

async function routeJson(page: Page, pattern: string | RegExp, body: string) {
  await page.route(pattern, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body,
    })
  );
}

export async function routeHomepageBillboardMocks(
  page: Page,
  overrides: HomepageRouteOverrides = {}
) {
  await routeJson(
    page,
    /squarePersonalizations\.json/i,
    overrides.personalizationsJson ?? HOMEPAGE_PERSONALIZATIONS_JSON
  );
  await routeJson(
    page,
    /squareExtra\.json/i,
    overrides.extraJson ?? HOMEPAGE_EXTRA_JSON
  );
  await routeJson(
    page,
    /blocklist-squares\.json/i,
    overrides.blockedSquaresJson ?? BLOCKED_SQUARES_JSON
  );
  await routeJson(
    page,
    /blocklist-domains\.json/i,
    overrides.blockedDomainsJson ?? BLOCKED_DOMAINS_JSON
  );
}

export async function setupHomepageBillboard(page: Page) {
  await routeHomepageBillboardMocks(page);

  const personalizationsResponse = page.waitForResponse(/squarePersonalizations\.json/i);
  const extraResponse = page.waitForResponse(/squareExtra\.json/i);

  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await Promise.all([personalizationsResponse, extraResponse]);

  await page.locator(HOMEPAGE_SELECTORS.grid).waitFor({ state: 'visible', timeout: 20_000 });
}

export function squareCell(page: Page, squareNumber: number): Locator {
  return page.locator(`${HOMEPAGE_SELECTORS.grid} [data-square="${squareNumber}"]`);
}

export async function hoverSquare(page: Page, squareNumber: number) {
  await squareCell(page, squareNumber).hover();
}

export async function clickSquare(page: Page, squareNumber: number) {
  await squareCell(page, squareNumber).click();
}

export async function expectTooltipContains(page: Page, text: string) {
  await expect(page.locator(HOMEPAGE_SELECTORS.tooltip)).toContainText(text);
}

export async function expectLeavingModal(page: Page, urlText: string) {
  await expect(page.locator(HOMEPAGE_SELECTORS.leavingVisible)).toBeVisible();
  await expect(page.locator(HOMEPAGE_SELECTORS.leavingUrl)).toContainText(urlText);
}

export async function closeLeavingModal(page: Page) {
  await page.locator(HOMEPAGE_SELECTORS.leavingStay).click();
}

export async function expectBlockedModal(page: Page, title: string) {
  await expect(page.locator(HOMEPAGE_SELECTORS.blockedVisible)).toBeVisible();
  await expect(page.locator(HOMEPAGE_SELECTORS.blockedTitle)).toHaveText(title);
}

export async function closeBlockedModal(page: Page) {
  await page.locator(HOMEPAGE_SELECTORS.blockedButton).click();
}
