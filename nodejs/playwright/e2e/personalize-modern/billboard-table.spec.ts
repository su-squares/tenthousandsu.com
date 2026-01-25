import { test, expect } from '@playwright/test';
import { setupTest } from '../../wallet/index.js';
import { installMockRpc } from '../mocks/rpc/index.js';
import { expectTxStatus } from '../helpers/tx-flow.js';
import { maybeConnectWallet } from '../helpers/wallet-flow.js';
import {
  getRed10x10Path,
  visitPersonalizeModernPage,
  waitForBillboardPreviewImages,
  waitForOwnedGlowStatic,
  waitForSquareImages,
  waitForSquares,
} from '../helpers/personalize-modern.js';

let e2eEnv: any = null;
let walletConfigFromEnv: any = null;
let logE2eEnvOnce: () => void = () => {};
let envLoadError: Error | null = null;

test.describe('Personalize Modern - Billboard Table', () => {
  test.beforeAll(async () => {
    try {
      const env = await import('../../env.js');
      e2eEnv = env.e2eEnv;
      walletConfigFromEnv = env.walletConfigFromEnv;
      logE2eEnvOnce = env.logE2eEnvOnce;
    } catch (error) {
      envLoadError = error instanceof Error ? error : new Error(String(error));
      console.warn('[personalize-modern-billboard] Skipping: env missing/invalid.', envLoadError.message);
    }

    test.skip(Boolean(envLoadError), 'wallet env missing/invalid');
  });

  test('billboard-table', async ({ page }) => {
    test.setTimeout(30_000);
    test.skip(!walletConfigFromEnv, 'wallet env missing/invalid');
    logE2eEnvOnce();

    const rawSquareIds = Array.isArray(e2eEnv?.personalizeModernSquareIds)
      ? (e2eEnv.personalizeModernSquareIds as number[])
      : [];
    const squareIds = Array.from(new Set(rawSquareIds))
      .map((id: number) => Number(id))
      .filter((id: number) => Number.isInteger(id) && id >= 1 && id <= 10000);
    test.skip(squareIds.length === 0, 'PERSONALIZE_MODERN_SQUARE_IDS missing/empty');

    const useMockRpc = Boolean(e2eEnv?.mockRpc);
    if (useMockRpc) {
      await installMockRpc(page, {
        chainId: e2eEnv.chainId,
        ownerAddress: e2eEnv.address,
        ownedSquares: squareIds,
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

    await visitPersonalizeModernPage(page);
    await setup.waitForWagmi();

    await page
      .locator('#personalize-billboard-section')
      .evaluate((el) => el.scrollIntoView({ block: 'center', inline: 'center' }));

    const glowToggle = page.locator('#glow-toggle');
    if (!(await glowToggle.isChecked())) {
      await glowToggle.check({ force: true });
    }

    const showOwnedButton = page.locator('#billboard-show-owned');
    await showOwnedButton.click();
    await maybeConnectWallet(page, walletConfigFromEnv.walletName || 'Wallet', {
      forceClick: true,
    });
    await waitForOwnedGlowStatic(page, squareIds);

    const grid = page.locator('.personalize-billboard__grid');
    await grid.waitFor();
    await grid.evaluate((el) =>
      el.scrollIntoView({ block: 'center', inline: 'center' })
    );

    for (const squareId of squareIds) {
      await page
        .locator(`.personalize-billboard__cell[data-square="${squareId}"]`)
        .click();
    }

    const updateButton = page.locator('#billboard-update');
    await expect(updateButton).toBeVisible();
    await updateButton.click();

    await waitForSquares(page, squareIds);
    await page
      .locator('.personalize-table-section')
      .evaluate((el) => el.scrollIntoView({ block: 'center', inline: 'center' }));

    const imagePath = getRed10x10Path();
    const titleFor = (id: number) => `Title ${id}`;
    const uriFor = (id: number) => `https://example.com/${id}`;

    const findRowIndex = async (squareId: number) => {
      await page.waitForFunction((id) => {
        const rows = Array.from(
          document.querySelectorAll('#personalize-table-body tr')
        );
        return rows.some((row) => {
          const input = row.querySelector(
            'input.personalize-table__input'
          ) as HTMLInputElement | null;
          return input?.value === String(id);
        });
      }, squareId);
      const index = await page.evaluate((id) => {
        const rows = Array.from(
          document.querySelectorAll('#personalize-table-body tr')
        );
        return rows.findIndex((row) => {
          const input = row.querySelector(
            'input.personalize-table__input'
          ) as HTMLInputElement | null;
          return input?.value === String(id);
        });
      }, squareId);
      if (index < 0) {
        throw new Error(`Row not found for square ${squareId}`);
      }
      return index;
    };

    for (const squareId of squareIds) {
      const index = await findRowIndex(squareId);
      const row = page.locator('#personalize-table-body tr').nth(index);
      await row.evaluate((el) => el.scrollIntoView({ block: 'center' }));
      const textareas = row.locator('textarea');
      await textareas.nth(0).fill(titleFor(squareId));
      await textareas.nth(1).fill(uriFor(squareId));
      await row.locator('input.personalize-table__file-input').setInputFiles(imagePath);
      await expect(row.locator('img.personalize-table__image-preview')).toBeVisible();
    }

    await waitForSquareImages(page, squareIds);

    await page.locator('.personalize-billboard__mode-btn[data-mode="preview"]').click();
    await waitForBillboardPreviewImages(page, squareIds);

    await page.locator('#personalize').click();
    await maybeConnectWallet(page, walletConfigFromEnv.walletName || 'Wallet');
    await expectTxStatus(page, 'success');
  });
});
