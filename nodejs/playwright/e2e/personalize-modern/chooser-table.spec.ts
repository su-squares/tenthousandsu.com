import { test, expect } from '@playwright/test';
import { setupTest } from '../../wallet/index.js';
import { installMockRpc } from '../mocks/rpc/index.js';
import { maybeConnectWallet } from '../helpers/wallet-flow.js';
import {
  getRed10x10Path,
  visitPersonalizeModernPage,
  waitForSquareImages,
  waitForSquares,
} from '../helpers/personalize-modern.js';

let e2eEnv: any = null;
let walletConfigFromEnv: any = null;
let logE2eEnvOnce: () => void = () => {};
let envLoadError: Error | null = null;

test.describe('Personalize Modern - Chooser Table', () => {
  test.beforeAll(async () => {
    try {
      const env = await import('../../env.js');
      e2eEnv = env.e2eEnv;
      walletConfigFromEnv = env.walletConfigFromEnv;
      logE2eEnvOnce = env.logE2eEnvOnce;
    } catch (error) {
      envLoadError = error instanceof Error ? error : new Error(String(error));
      console.warn('[personalize-modern-chooser] Skipping: env missing/invalid.', envLoadError.message);
    }

    test.skip(Boolean(envLoadError), 'wallet env missing/invalid');
  });

  test('chooser-table', async ({ page }) => {
    test.setTimeout(120_000);
    test.skip(!walletConfigFromEnv, 'wallet env missing/invalid');
    logE2eEnvOnce();

    const rawSquareIds = Array.isArray(e2eEnv?.personalizeSquareIds)
      ? (e2eEnv.personalizeSquareIds as number[])
      : [];
    const squareIds = Array.from(new Set(rawSquareIds))
      .map((id: number) => Number(id))
      .filter((id: number) => Number.isInteger(id) && id >= 1 && id <= 10000);
    test.skip(squareIds.length === 0, 'PERSONALIZE_SQUARE_ID missing/empty');

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

    const chooserTrigger = page.locator('#open-square-chooser');
    await chooserTrigger.click();
    await maybeConnectWallet(page, walletConfigFromEnv.walletName || 'Wallet', {
      forceClick: true,
    });

    const chooserBackdrop = page.locator('.su-chooser-backdrop');
    await chooserBackdrop.waitFor();
    await expect(chooserBackdrop).toHaveClass(/is-open/);
    const chooserGrid = chooserBackdrop.locator('.su-chooser__grid');
    await chooserGrid.waitFor();

    for (const squareId of squareIds) {
      const button = chooserGrid.getByRole('button', { name: `#${squareId}` });
      await expect(button).toBeVisible();
      await button.click();
    }

    await chooserBackdrop.locator('.su-chooser__okay-btn').click();
    await expect(chooserBackdrop).not.toHaveClass(/is-open/);

    await waitForSquares(page, squareIds);
    await page.waitForFunction((ids: number[]) => {
      const values = Array.from(
        document.querySelectorAll('#personalize-table-body tr')
      )
        .map((row) =>
          (row.querySelector('input.personalize-table__input') as HTMLInputElement | null)
            ?.value
        )
        .filter(Boolean);
      return ids.every((id) => values.includes(String(id)));
    }, squareIds);

    const imagePath = getRed10x10Path();
    const titleFor = (id: number) => `Title ${id}`;
    const uriFor = (id: number) => `https://example.com/${id}`;

    for (const squareId of squareIds) {
      const rowIndex = await page.evaluate((id) => {
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

      if (rowIndex < 0) {
        throw new Error(`Row not found for square ${squareId}`);
      }

      const row = page.locator('#personalize-table-body tr').nth(rowIndex);
      await row.evaluate((el) => el.scrollIntoView({ block: 'center' }));
      await expect(row.locator('input.personalize-table__input')).toHaveValue(
        String(squareId)
      );
      const textareas = row.locator('textarea');
      await textareas.nth(0).fill(titleFor(squareId));
      await textareas.nth(1).fill(uriFor(squareId));
      await row.locator('input.personalize-table__file-input').setInputFiles(imagePath);
      await expect(row.locator('img.personalize-table__image-preview')).toBeVisible();
    }

    await waitForSquareImages(page, squareIds);
  });
});
