import { expect, type Page } from '@playwright/test';

type BuyFlowOptions = {
  squareNumber: number;
  walletName: string;
  expectFailure?: boolean;
};

const SELECTORS = {
  squareInput: '#square-number',
  selectButton: '#select-square',
  mintSelected: '#mint-selected-square',
  mintButton: '#mint',
  mintSuccess: '#mint-success',
  mintAnother: '#mint-another',
  pickSquare: '#pick-a-square',
  txStatus: '[data-testid="tx-status"]',
};

export async function visitBuyPage(page: Page) {
  await page.goto('/buy.html', { waitUntil: 'domcontentloaded' });
}

export async function resolveSquareNumber(page: Page, preferred: number) {
  try {
    const baseurl = await page.evaluate(() => (window as any).SITE_BASEURL || '');
    const result = await page.evaluate(async ({ preferred, baseurl }) => {
      const module = await import(`${baseurl}/assets/js/square-data.js`);
      const data = await module.loadSquareData();
      const extra = data?.extra || [];
      if (!Array.isArray(extra) || extra.length === 0) {
        return { squareNumber: preferred, usedFallback: false };
      }

      const isAvailable = (idx: number) => extra[idx] == null;
      const total = extra.length;
      const preferredIdx = ((preferred - 1) % total + total) % total;

      for (let step = 0; step < total; step += 1) {
        const idx = (preferredIdx + step) % total;
        if (isAvailable(idx)) {
          return { squareNumber: idx + 1, usedFallback: step > 0 };
        }
      }

      return { squareNumber: preferred, usedFallback: false };
    }, { preferred, baseurl });

    if (result?.usedFallback) {
      console.warn(`[buy-flow] Preferred square ${preferred} unavailable per squareExtra.json; using ${result.squareNumber}.`);
    }
    return result?.squareNumber ?? preferred;
  } catch (error) {
    console.warn('[buy-flow] Unable to resolve square availability; using preferred square.', error);
    return preferred;
  }
}

export async function selectSquare(page: Page, squareNumber: number) {
  const input = page.locator(SELECTORS.squareInput);
  await expect(input).toBeVisible();
  await input.fill(String(squareNumber));

  const selectButton = page.locator(SELECTORS.selectButton);
  await expect(selectButton).toBeVisible();
  await selectButton.click();

  await expect(page.locator(SELECTORS.mintSelected)).toBeVisible();
}

export async function completeMint(page: Page, walletName: string, expectFailure: boolean) {
  const mintButton = page.locator(SELECTORS.mintButton);
  await expect(mintButton).toBeVisible();
  await mintButton.click();

  const connectHeading = page.getByRole('heading', { name: /connect your wallet/i });
  const connectVisible = await connectHeading
    .waitFor({ state: 'visible', timeout: 3000 })
    .then(() => true)
    .catch(() => false);

  if (connectVisible) {
    const walletButton = page.getByRole('button', { name: new RegExp(walletName, 'i') });
    await expect(walletButton).toBeVisible({ timeout: 10_000 });
    await walletButton.click();

    const connectingHeading = page.getByRole('heading', { name: /connecting/i });
    await connectingHeading.waitFor({ state: 'visible', timeout: 10_000 }).catch(() => {});
  }

  const status = page.locator(SELECTORS.txStatus);
  await expect(status).toHaveAttribute('data-status', expectFailure ? 'error' : 'success', { timeout: 20_000 });

  if (expectFailure) {
    await expect(page.locator(SELECTORS.mintSuccess)).toBeHidden();
  } else {
    await expect(page.locator(SELECTORS.mintSuccess)).toBeVisible();
  }
}

export async function runBuyFlow(page: Page, options: BuyFlowOptions) {
  await selectSquare(page, options.squareNumber);
  await completeMint(page, options.walletName, Boolean(options.expectFailure));
}

export async function resetBuyFlow(page: Page) {
  const mintAnother = page.locator(SELECTORS.mintAnother);
  await expect(mintAnother).toBeVisible();
  await mintAnother.click();
  await expect(page.locator(SELECTORS.pickSquare)).toBeVisible();
}
