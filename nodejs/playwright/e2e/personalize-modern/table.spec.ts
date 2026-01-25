import { test, expect } from '@playwright/test';
import { setupTest } from '../../wallet/index.js';
import { installMockRpc } from '../mocks/rpc/index.js';
import { expectTxStatus } from '../helpers/tx-flow.js';
import { maybeConnectWallet } from '../helpers/wallet-flow.js';
import { getRed10x10Path, visitPersonalizeModernPage } from '../helpers/personalize-modern.js';

let e2eEnv: any = null;
let walletConfigFromEnv: any = null;
let logE2eEnvOnce: () => void = () => {};
let envLoadError: Error | null = null;

test.describe('Personalize Modern - Table', () => {
  test.beforeAll(async () => {
    try {
      const env = await import('../../env.js');
      e2eEnv = env.e2eEnv;
      walletConfigFromEnv = env.walletConfigFromEnv;
      logE2eEnvOnce = env.logE2eEnvOnce;
    } catch (error) {
      envLoadError = error instanceof Error ? error : new Error(String(error));
      console.warn('[personalize-modern-table] Skipping: env missing/invalid.', envLoadError.message);
    }

    test.skip(Boolean(envLoadError), 'wallet env missing/invalid');
  });

  test('table', async ({ page }) => {
    test.setTimeout(120_000);
    test.skip(!walletConfigFromEnv, 'wallet env missing/invalid');
    logE2eEnvOnce();

    const rawSquareIds = Array.isArray(e2eEnv?.personalizeModernSquareIds)
      ? (e2eEnv.personalizeModernSquareIds as number[])
      : [];
    const squareIds = rawSquareIds
      .map((id: number) => Number(id))
      .filter((id: number) => Number.isInteger(id) && id >= 1 && id <= 10000);
    test.skip(squareIds.length === 0, 'PERSONALIZE_MODERN_SQUARE_IDS missing/empty');

    const squareId = squareIds[0];
    const title = `Manual Title ${squareId}`;
    const uri = `https://example.com/${squareId}`;

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

    await visitPersonalizeModernPage(page);
    await setup.waitForWagmi();

    const row = page.locator('#personalize-table-body tr').first();
    await row.waitFor();
    await row.locator('input.personalize-table__input').fill(String(squareId));
    const textareas = row.locator('textarea');
    await textareas.nth(0).fill(title);
    await textareas.nth(1).fill(uri);

    const imagePath = getRed10x10Path();
    await row.locator('input.personalize-table__file-input').setInputFiles(imagePath);
    await expect(row.locator('img.personalize-table__image-preview')).toBeVisible();

    await page.locator('#personalize').click();
    await maybeConnectWallet(page, walletConfigFromEnv.walletName || 'Wallet');
    await expectTxStatus(page, 'success');
  });
});
