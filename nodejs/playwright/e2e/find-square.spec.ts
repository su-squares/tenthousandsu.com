import { test, expect, type Page } from '@playwright/test';

const FADE_IN_DELAY_MS = 1000;

const waitForFadeIn = async (page: Page) => {
  await page.waitForTimeout(FADE_IN_DELAY_MS);
};

test('find square flow', async ({ page }) => {
  test.setTimeout(15_000);

  await page.goto('/square.html', { waitUntil: 'domcontentloaded' });
  await waitForFadeIn(page);

  const defaultHeading = page.locator('#square-default-state h1');
  await expect(defaultHeading).toHaveText(/Look up Su Squares/i);
  await expect(page.getByTestId('square-lookup')).toBeVisible();

  const input = page.getByTestId('square-lookup-input');
  const submitButton = page.getByTestId('square-lookup-submit');
  await input.fill('1');

  await Promise.all([
    page.waitForURL(/\/square(?:\.html)?#1/i),
    submitButton.click(),
  ]);
  await page.waitForLoadState('domcontentloaded');
  await waitForFadeIn(page);

  const detailsHeading = page.locator('#square-details h1');
  await expect(detailsHeading).toContainText('Square #1');

  await expect(page.getByTestId('square-nft-table')).toBeVisible();
  await expect(page.locator('#image')).toBeVisible({ timeout: 10_000 });
  await expect(page.getByRole('heading', { level: 2, name: 'Location' })).toBeVisible();
  await expect(page.getByRole('heading', { level: 2, name: 'Emojified' })).toBeVisible();
  await expect(page.locator('#emojified')).toBeVisible();
  await expect(page.locator('#copy-emojified')).toBeVisible();

  const chooseListButton = page.getByTestId('square-lookup-choose-list');
  await chooseListButton.click();

  const chooserBackdrop = page.locator('.su-chooser-backdrop.is-open');
  await expect(chooserBackdrop).toBeVisible({ timeout: 10_000 });

  const square2Button = chooserBackdrop.getByRole('button', { name: 'Square 2', exact: true });
  await expect(square2Button).toBeVisible({ timeout: 10_000 });

  await Promise.all([
    page.waitForURL(/\/square(?:\.html)?#2/i),
    square2Button.click(),
  ]);
  await page.waitForLoadState('domcontentloaded');
  await waitForFadeIn(page);

  await expect(detailsHeading).toContainText('Square #2');

  await page.goto('/square.html#fail', { waitUntil: 'domcontentloaded' });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await waitForFadeIn(page);

  await expect(defaultHeading).toHaveText(/Look up Su Squares/i);
  await expect(page.locator('#square-details')).toHaveAttribute('aria-hidden', 'true');
});
