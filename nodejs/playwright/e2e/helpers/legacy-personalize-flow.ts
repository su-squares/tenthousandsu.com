import { expect, type Page } from '@playwright/test';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { expectTxStatus } from './tx-flow.js';
import { maybeConnectWallet } from './wallet-flow.js';

type LegacyPersonalizeOptions = {
  squareNumber: number;
  title: string;
  url: string;
  imagePath: string;
  walletName: string;
};

const SELECTORS = {
  squareInput: '#square-number',
  titleInput: '#title',
  urlInput: '#url',
  imageInput: '#image',
  imageStatus: '#image-status',
  personalizeButton: '#personalize',
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export function getLegacyPersonalizeImagePath() {
  return resolve(__dirname, '..', 'fixtures', 'red-10x10.png');
}

export async function visitLegacyPersonalizePage(page: Page) {
  await page.goto('/personalize.html', { waitUntil: 'domcontentloaded' });
}

export async function fillLegacyPersonalizeForm(page: Page, options: LegacyPersonalizeOptions) {
  const squareInput = page.locator(SELECTORS.squareInput);
  await expect(squareInput).toBeVisible();
  await squareInput.fill(String(options.squareNumber));

  const titleInput = page.locator(SELECTORS.titleInput);
  await expect(titleInput).toBeVisible();
  await titleInput.fill(options.title);

  const urlInput = page.locator(SELECTORS.urlInput);
  await expect(urlInput).toBeVisible();
  await urlInput.fill(options.url);

  const imageInput = page.locator(SELECTORS.imageInput);
  await expect(imageInput).toBeVisible();
  await imageInput.setInputFiles(options.imagePath);

  const imageStatus = page.locator(SELECTORS.imageStatus);
  await expect(imageStatus).toContainText(/image loaded/i, { timeout: 10_000 });
}

export async function runLegacyPersonalizeFlow(page: Page, options: LegacyPersonalizeOptions) {
  await fillLegacyPersonalizeForm(page, options);

  const personalizeButton = page.locator(SELECTORS.personalizeButton);
  await expect(personalizeButton).toBeVisible();
  await personalizeButton.click();

  await maybeConnectWallet(page, options.walletName);
  await expectTxStatus(page, 'success');
}
