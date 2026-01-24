import { test, expect } from '@playwright/test';
import { SQUARE_IDS } from './fixtures/homepage-billboard.js';
import {
  HOMEPAGE_SELECTORS,
  setupHomepageBillboard,
  squareCell,
  hoverSquare,
  clickSquare,
  expectTooltipContains,
  expectLeavingModal,
  closeLeavingModal,
  expectBlockedModal,
  closeBlockedModal,
} from './helpers/homepage-billboard.js';

test.describe('Homepage billboard', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    await setupHomepageBillboard(page);
  });

  test('shows leaving modal for external links', async ({ page }) => {
    await hoverSquare(page, SQUARE_IDS.external);
    await expectTooltipContains(page, 'William Entriken');

    await clickSquare(page, SQUARE_IDS.external);
    await expectLeavingModal(page, 'williamentriken.net');
    await closeLeavingModal(page);
  });

  test('blocks javascript uri links', async ({ page }) => {
    await hoverSquare(page, SQUARE_IDS.javascript);
    await expectTooltipContains(page, 'Link blocked for your protection');

    await clickSquare(page, SQUARE_IDS.javascript);
    await expectBlockedModal(page, 'This deeplink is disallowed');
    await closeBlockedModal(page);
  });

  test('blocks domain blocked links', async ({ page }) => {
    await hoverSquare(page, SQUARE_IDS.blockedDomain);
    await expectTooltipContains(page, 'disabled');

    await clickSquare(page, SQUARE_IDS.blockedDomain);
    await expectBlockedModal(page, 'This link has been blocked for your protection');
    await closeBlockedModal(page);
  });

  test('shows blocked square tooltip and modal', async ({ page }) => {
    const cell = squareCell(page, SQUARE_IDS.blockedSquare);
    await expect(cell).toHaveAttribute('data-override', 'true');

    await hoverSquare(page, SQUARE_IDS.blockedSquare);
    await expectTooltipContains(page, 'disabled');

    await clickSquare(page, SQUARE_IDS.blockedSquare);
    await expectBlockedModal(page, 'This square is disabled for your protection');
    await closeBlockedModal(page);
  });

  test('available squares open the buy page', async ({ page }) => {
    await hoverSquare(page, SQUARE_IDS.available);
    await expectTooltipContains(page, 'available for sale');

    await page.evaluate(() => {
      const anchor = document.getElementById('wheretogo');
      if (anchor) anchor.setAttribute('target', '_self');
    });

    await Promise.all([
      page.waitForURL(/\/buy\?square=5$/),
      clickSquare(page, SQUARE_IDS.available),
    ]);
  });
});
