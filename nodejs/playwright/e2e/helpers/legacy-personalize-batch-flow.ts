import { expect, type Page } from '@playwright/test';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { expectTxStatus } from './tx-flow.js';
import { maybeConnectWallet } from './wallet-flow.js';

type LegacyPersonalizeBatchOptions = {
  topLeftSquareNumber: number;
  title: string;
  url: string;
  imagePath: string;
  walletName: string;
  expectedRowCount?: number;
};

const SELECTORS = {
  topLeftSquareInput: '#top-left-square-number',
  titleInput: '#title',
  urlInput: '#url',
  imageInput: '#image',
  imageStatus: '#image-status',
  preflightButton: '#preflight',
  preflightOutput: '#preflight-output',
  preflightStatus: '#preflight-status',
  personalizeButton: '#personalize',
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export function getLegacyPersonalizeBatchImagePath() {
  return resolve(__dirname, '..', 'fixtures', 'red-40x40.png');
}

export async function visitLegacyPersonalizeBatchPage(page: Page) {
  await page.goto('/personalize-batch.html', { waitUntil: 'domcontentloaded' });
}

export async function fillLegacyPersonalizeBatchForm(page: Page, options: LegacyPersonalizeBatchOptions) {
  const topLeftInput = page.locator(SELECTORS.topLeftSquareInput);
  await expect(topLeftInput).toBeVisible();
  await topLeftInput.fill(String(options.topLeftSquareNumber));
  await page.dispatchEvent(SELECTORS.topLeftSquareInput, 'input');

  const titleInput = page.locator(SELECTORS.titleInput);
  await expect(titleInput).toBeVisible();
  await titleInput.fill(options.title);
  await page.dispatchEvent(SELECTORS.titleInput, 'input');

  const urlInput = page.locator(SELECTORS.urlInput);
  await expect(urlInput).toBeVisible();
  await urlInput.fill(options.url);
  await page.dispatchEvent(SELECTORS.urlInput, 'input');

  const imageInput = page.locator(SELECTORS.imageInput);
  await expect(imageInput).toBeVisible();
  await imageInput.setInputFiles(options.imagePath);

  const imageStatus = page.locator(SELECTORS.imageStatus);
  await expect(imageStatus).toContainText(/image is/i, { timeout: 10_000 });

  const statusText = await imageStatus.innerText();
  const match = statusText.match(/which is\s+(\d+)[^0-9]+(\d+)\s*Squares/i);
  if (match) {
    const squaresWide = Number(match[1]);
    const squaresTall = Number(match[2]);
    const topLeftColumn = ((options.topLeftSquareNumber - 1) % 100) + 1;
    const topLeftRow = Math.floor((options.topLeftSquareNumber - 1) / 100) + 1;
    const maxColumn = 101 - squaresWide;
    const maxRow = 101 - squaresTall;

    if (topLeftColumn > maxColumn || topLeftRow > maxRow) {
      throw new Error(
        `Top-left square ${options.topLeftSquareNumber} with image size ${squaresWide}x${squaresTall} exceeds the 100x100 grid. ` +
          `Choose a top-left square with column <= ${maxColumn} and row <= ${maxRow} (set LEGACY_PERSONALIZE_BATCH_SQUARE_NUMBER).`
      );
    }
  }
}

export async function runLegacyPersonalizeBatchPreflight(
  page: Page,
  expectedRowCount: number
) {
  const preflightButton = page.locator(SELECTORS.preflightButton);
  await expect(preflightButton).toBeVisible();
  await preflightButton.click();

  const preflightOutput = page.locator(SELECTORS.preflightOutput);
  await expect.poll(async () => {
    const value = await preflightOutput.inputValue();
    const rows = value.trim().split(/\r\n|\n|\r/).filter(Boolean);
    return rows.length;
  }).toBe(expectedRowCount);

  const preflightStatus = page.locator(SELECTORS.preflightStatus);
  await expect(preflightStatus).toContainText(/successful/i, { timeout: 10_000 });
  await expect(preflightStatus).toContainText(
    new RegExp(`ready to personalize ${expectedRowCount} Squares`, 'i'),
    { timeout: 10_000 }
  );
}

export async function runLegacyPersonalizeBatchFlow(page: Page, options: LegacyPersonalizeBatchOptions) {
  const expectedRowCount = options.expectedRowCount ?? 16;

  await fillLegacyPersonalizeBatchForm(page, options);
  await runLegacyPersonalizeBatchPreflight(page, expectedRowCount);

  const personalizeButton = page.locator(SELECTORS.personalizeButton);
  await expect(personalizeButton).toBeVisible();
  await personalizeButton.click();

  await maybeConnectWallet(page, options.walletName);
  await expectTxStatus(page, 'success');
}
