import { test, expect } from '@playwright/test';
import { setupTest } from '../wallet/index.js';
import { installMockRpc } from './mocks/rpc/index.js';
import { resolveSquareNumber, completeMint } from './helpers/buy-flow.js';
import { routeHomepageBillboardMocks, HOMEPAGE_SELECTORS } from './helpers/homepage-billboard.js';
import { getRed10x10Path, waitForPersonalizeModernReady } from './helpers/personalize-modern.js';
import { expectTxStatus } from './helpers/tx-flow.js';
import { maybeConnectWallet } from './helpers/wallet-flow.js';

let e2eEnv: any = null;
let walletConfigFromEnv: any = null;
let logE2eEnvOnce: () => void = () => {};
let envLoadError: Error | null = null;

test.describe('Happy path flow', () => {
  test.beforeAll(async () => {
    try {
      const env = await import('../env.js');
      e2eEnv = env.e2eEnv;
      walletConfigFromEnv = env.walletConfigFromEnv;
      logE2eEnvOnce = env.logE2eEnvOnce;
    } catch (error) {
      envLoadError = error instanceof Error ? error : new Error(String(error));
      console.warn('[happy-path-test] Skipping: env missing/invalid.', envLoadError.message);
    }

    test.skip(Boolean(envLoadError), 'wallet env missing/invalid');
  });

  test('happy-path', async ({ page }) => {
    test.setTimeout(120_000);
    test.skip(!walletConfigFromEnv, 'wallet env missing/invalid');
    logE2eEnvOnce();

    const useMockRpc = Boolean(e2eEnv?.mockRpc);
    if (useMockRpc) {
      await installMockRpc(page, {
        chainId: e2eEnv.chainId,
        ownerAddress: e2eEnv.address,
      });
    }

    const walletConfig = { ...walletConfigFromEnv };
    if (useMockRpc) {
      delete walletConfig.privateKey;
      delete walletConfig.rpcUrl;
    }

    const setup = await setupTest(page, {
      clearStorage: true,
      injectWallet: true,
      walletConfig,
    });

    const preferredSquareId = e2eEnv?.buySquareId || 1;

    if (useMockRpc) {
      const emptyPersonalizations = Array.from({ length: 10000 }, () => null);
      const emptyExtra = Array.from({ length: 10000 }, () => null);
      await routeHomepageBillboardMocks(page, {
        personalizationsJson: JSON.stringify(emptyPersonalizations),
        extraJson: JSON.stringify(emptyExtra),
        blockedSquaresJson: JSON.stringify({ blocked: [] }),
        blockedDomainsJson: JSON.stringify([]),
      });
    }

    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page
      .locator(HOMEPAGE_SELECTORS.grid)
      .waitFor({ state: 'visible', timeout: 20_000 });

    await page.evaluate(() => {
      const anchor = document.getElementById('wheretogo');
      if (anchor) anchor.setAttribute('target', '_self');
    });

    const squareId = useMockRpc
      ? preferredSquareId
      : await resolveSquareNumber(page, preferredSquareId);

    await Promise.all([
      page.waitForURL(/\/buy(\.html)?\?square=/),
      page.locator(`${HOMEPAGE_SELECTORS.grid} [data-square="${squareId}"]`).click(),
    ]);

    await setup.waitForWagmi();

    const squareInput = page.locator('#square-number');
    await expect(squareInput).toHaveValue(String(squareId));

    await page.locator('#select-square').click();
    await expect(page.locator('#mint-selected-square')).toBeVisible();

    const walletName = walletConfigFromEnv.walletName || 'Wallet';
    await completeMint(page, walletName, false);
    await expect(page.locator('#mint-success')).toBeVisible();

    const personalizeNow = page.locator('#personalize-now');
    await expect(personalizeNow).toBeVisible();
    await Promise.all([
      page.waitForURL(/\/personalize-modern(\.html)?\?square=/),
      personalizeNow.click(),
    ]);

    await waitForPersonalizeModernReady(page);
    await setup.waitForWagmi();

    const row = page.locator('#personalize-table-body tr').first();
    await row.waitFor();

    const squareCellInput = row.locator('input.personalize-table__input');
    await expect(squareCellInput).toHaveValue(String(squareId));

    const title = `Happy Path ${squareId}`;
    const uri = `https://example.com/${squareId}`;
    const textareas = row.locator('textarea');
    await textareas.nth(0).fill(title);
    await textareas.nth(1).fill(uri);

    const imagePath = getRed10x10Path();
    await row.locator('input.personalize-table__file-input').setInputFiles(imagePath);
    await expect(row.locator('img.personalize-table__image-preview')).toBeVisible();

    await page.locator('#personalize').click();
    await maybeConnectWallet(page, walletName);
    await expectTxStatus(page, 'success');
  });
});
