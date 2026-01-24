import { test, expect, type Page } from '@playwright/test';

const openMenu = async (page: Page) => {
  await page
    .locator('.su-nav-overlay')
    .waitFor({ state: 'hidden', timeout: 5000 })
    .catch(() => {});
  await page.waitForTimeout(300);
  // Keep using role+name for Open menu on purpose
  const openButton = page.getByRole('button', { name: 'Open menu' });
  const dialog = page.getByRole('dialog', { name: 'Main menu' });

  await expect(openButton).toBeVisible();

  for (let attempt = 0; attempt < 3; attempt += 1) {
    await openButton.click();
    try {
      await expect(dialog).toBeVisible({ timeout: 1000 });
      return;
    } catch {
      await page.waitForTimeout(250);
    }
  }

  await expect(dialog).toBeVisible({ timeout: 3000 });
};

const clickLinkWithRetry = async (page: Page, linkTestId: string) => {
  const menu = page.getByLabel('Main navigation');
  let link = menu.getByTestId(linkTestId);

  if (!(await link.isVisible())) {
    await openMenu(page);
    link = menu.getByTestId(linkTestId);
    await expect(link).toBeVisible();
  }

  await page.waitForTimeout(300);

  await Promise.all([
    page.waitForLoadState('domcontentloaded'),
    link.click(),
  ]);

  await page
    .locator('.su-nav-overlay')
    .waitFor({ state: 'hidden', timeout: 5000 })
    .catch(() => {});
};

// Extended helper to handle submenu buttons like “Articles”
const clickButtonWithRetry = async (page: Page, buttonTestId: string) => {
  const menu = page.getByLabel('Main navigation');
  let button = menu.getByTestId(buttonTestId);

  if (!(await button.isVisible())) {
    await openMenu(page);
    button = menu.getByTestId(buttonTestId);
    await expect(button).toBeVisible();
  }

  await page.waitForTimeout(300);
  await button.click();
  await page.waitForTimeout(300);

  // Special case for Articles → Back to main menu
  if (buttonTestId === 'nav-articles') {
    const backButton = page.getByTestId('nav-back-main');
    await expect(backButton).toBeVisible();
    await backButton.click();
    await page.waitForTimeout(300);
  }
};

test('test', async ({ page }) => {
  test.setTimeout(30_000);

  await page.goto('/');

  await expect(page.getByRole('button', { name: 'Open menu' })).toBeVisible();
  await openMenu(page);

  await expect(page.getByRole('dialog', { name: 'Main menu' })).toBeVisible();

  await expect(page.getByTestId('nav-close-menu')).toBeVisible();
  await expect(page.getByTestId('nav-x')).toBeVisible();
  await expect(page.getByTestId('nav-discord')).toBeVisible();
  await expect(page.getByTestId('nav-opensea')).toBeVisible();

  await clickLinkWithRetry(page, 'nav-mint');
  await openMenu(page);

  await clickLinkWithRetry(page, 'nav-personalize');
  await expect(page).toHaveURL(/\/personalize-modern\/?$/);
  await openMenu(page);

  await clickLinkWithRetry(page, 'nav-square-lookup');
  await openMenu(page);

  await clickLinkWithRetry(page, 'nav-about');
  await openMenu(page);

  await clickLinkWithRetry(page, 'nav-faq');
  await openMenu(page);

  await clickButtonWithRetry(page, 'nav-articles');

  await page.getByTestId('nav-close-menu').click();
  await openMenu(page);

  await clickLinkWithRetry(page, 'nav-home');
});
