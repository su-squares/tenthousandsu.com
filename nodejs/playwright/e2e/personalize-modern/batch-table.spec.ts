import { test } from '@playwright/test';
import { setupTest } from '../../wallet/index.js';
import { installMockRpc } from '../mocks/rpc/index.js';
import {
  getRed10x10Path,
  uploadCsvBatch,
  uploadImageBatch,
  visitPersonalizeModernPage,
  waitForSquareImages,
  waitForSquareText,
  waitForSquares,
} from '../helpers/personalize-modern.js';

let e2eEnv: any = null;
let walletConfigFromEnv: any = null;
let logE2eEnvOnce: () => void = () => {};
let envLoadError: Error | null = null;

test.describe('Personalize Modern - Batch Table', () => {
  test.beforeAll(async () => {
    try {
      const env = await import('../../env.js');
      e2eEnv = env.e2eEnv;
      walletConfigFromEnv = env.walletConfigFromEnv;
      logE2eEnvOnce = env.logE2eEnvOnce;
    } catch (error) {
      envLoadError = error instanceof Error ? error : new Error(String(error));
      console.warn('[personalize-modern-batch] Skipping: env missing/invalid.', envLoadError.message);
    }

    test.skip(Boolean(envLoadError), 'wallet env missing/invalid');
  });

  test('batch-table', async ({ page }) => {
    test.setTimeout(60_000);
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

    const csvEntries = squareIds.map((id) => ({
      squareId: id,
      title: `Title ${id}`,
      uri: `https://example.com/${id}`,
    }));

    await uploadCsvBatch(page, squareIds);
    await waitForSquares(page, squareIds);
    await waitForSquareText(page, csvEntries);

    const imagePath = getRed10x10Path();
    await uploadImageBatch(page, squareIds, imagePath);
    await waitForSquareImages(page, squareIds);
  });
});
