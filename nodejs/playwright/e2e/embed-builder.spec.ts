import { test, expect } from '@playwright/test';
import { expectEmbedState, parseEmbedUrl, waitForEmbedReady } from './helpers/embed.js';

test('embed builder updates url and preview', async ({ page }) => {
  await page.goto('/embed-builder.html', { waitUntil: 'domcontentloaded' });

  const urlOutput = page.locator('#embed-url-output');
  await expect(urlOutput).toHaveValue(/embed\.html/);

  await page.locator('#panzoom-toggle').uncheck();

  await page.getByRole('tab', { name: 'Theme' }).click();
  await page.locator('#bg-transparent').check();

  await page.getByRole('tab', { name: 'Header' }).click();
  await page.locator('input[name="header"][value="squares"]').check();
  await page.locator('#header-size-value').fill('1.5');
  await page.locator('#header-size-unit').selectOption('rem');

  await page.getByRole('tab', { name: 'Blocklist' }).click();
  await page.locator('#block-squares').fill('10-12');
  await page.locator('#block-domains').fill('example.com,evil.com');

  await expect.poll(async () => {
    const urlValue = await urlOutput.inputValue();
    return parseEmbedUrl(urlValue).headerSize;
  }).toBe('1.5rem');

  await expect.poll(async () => {
    const urlValue = await urlOutput.inputValue();
    return parseEmbedUrl(urlValue).blockDomains;
  }).toBe('example.com,evil.com');

  const urlValue = await urlOutput.inputValue();
  const params = parseEmbedUrl(urlValue);
  expect(params.panzoom).toBe('off');
  expect(params.bg).toBe('transparent');
  expect(params.header).toBe('squares');
  expect(params.headerSize).toBe('1.5rem');
  expect(params.blockSquares).toBe('10-12');
  expect(params.blockDomains).toBe('example.com,evil.com');

  const previewFrame = page.frameLocator('#embed-preview');
  await waitForEmbedReady(previewFrame);

  await expectEmbedState(previewFrame, {
    bg: 'transparent',
    headerHidden: false,
    headerText: 'Su Squares',
  });

  const previewSrc = await page.locator('#embed-preview').getAttribute('src');
  expect(previewSrc).not.toBeNull();
  const previewParams = parseEmbedUrl(previewSrc ?? '', page.url());
  expect(previewParams.panzoom).toBe('off');
});
