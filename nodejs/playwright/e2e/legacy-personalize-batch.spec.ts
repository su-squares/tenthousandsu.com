import { test } from '@playwright/test';
import { setupTest } from '../wallet/index.js';
import { installMockRpc } from './mocks/rpc/index.js';
import { installMockBillboard } from './mocks/billboard/index.js';
import {
  getLegacyPersonalizeBatchImagePath,
  runLegacyPersonalizeBatchFlow,
  visitLegacyPersonalizeBatchPage,
} from './helpers/legacy-personalize-batch-flow.js';

let e2eEnv: any = null;
let walletConfigFromEnv: any = null;
let logE2eEnvOnce: () => void = () => {};
let envLoadError: Error | null = null;

test.describe('Legacy personalize batch flow', () => {
  test.beforeAll(async () => {
    try {
      const env = await import('../env.js');
      e2eEnv = env.e2eEnv;
      walletConfigFromEnv = env.walletConfigFromEnv;
      logE2eEnvOnce = env.logE2eEnvOnce;
    } catch (error) {
      envLoadError = error instanceof Error ? error : new Error(String(error));
      console.warn('[legacy-personalize-batch-test] Skipping: env missing/invalid.', envLoadError.message);
    }

    test.skip(Boolean(envLoadError), 'wallet env missing/invalid');
  });

  test('legacy-personalize-batch', async ({ page }) => {
    test.setTimeout(60_000);
    test.skip(!walletConfigFromEnv, 'wallet env missing/invalid');
    logE2eEnvOnce();

    const useMockRpc = Boolean(e2eEnv?.mockRpc);
    const useMockBillboard = Boolean(e2eEnv?.mockBillboard);
    if (useMockRpc) {
      await installMockRpc(page, {
        chainId: e2eEnv.chainId,
      });
    }
    if (useMockRpc && useMockBillboard) {
      await installMockBillboard(page, e2eEnv.mockBillboardConfig);
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

    await visitLegacyPersonalizeBatchPage(page);
    await setup.waitForWagmi();

    const topLeftSquareNumber = e2eEnv?.legacyPersonalizeBatchSquareId || 1;
    const walletName = walletConfigFromEnv.walletName || 'Wallet';
    const imagePath = getLegacyPersonalizeBatchImagePath();

    await runLegacyPersonalizeBatchFlow(page, {
      topLeftSquareNumber,
      walletName,
      title: 'My Su Squares',
      url: 'https://example.com',
      imagePath,
      expectedRowCount: 16,
    });
  });
});
