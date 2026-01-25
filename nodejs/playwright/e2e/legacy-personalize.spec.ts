import { test } from '@playwright/test';
import { setupTest } from '../wallet/index.js';
import { installMockRpc } from './mocks/rpc/index.js';
import {
  getLegacyPersonalizeImagePath,
  runLegacyPersonalizeFlow,
  visitLegacyPersonalizePage,
} from './helpers/legacy-personalize-flow.js';

let e2eEnv: any = null;
let walletConfigFromEnv: any = null;
let logE2eEnvOnce: () => void = () => {};
let envLoadError: Error | null = null;

test.describe('Legacy personalize flow', () => {
  test.beforeAll(async () => {
    try {
      const env = await import('../env.js');
      e2eEnv = env.e2eEnv;
      walletConfigFromEnv = env.walletConfigFromEnv;
      logE2eEnvOnce = env.logE2eEnvOnce;
    } catch (error) {
      envLoadError = error instanceof Error ? error : new Error(String(error));
      console.warn('[legacy-personalize-test] Skipping: env missing/invalid.', envLoadError.message);
    }

    test.skip(Boolean(envLoadError), 'wallet env missing/invalid');
  });

  test('legacy-personalize', async ({ page }) => {
    test.setTimeout(30_000);
    test.skip(!walletConfigFromEnv, 'wallet env missing/invalid');
    logE2eEnvOnce();

    const useMockRpc = Boolean(e2eEnv?.mockRpc);
    if (useMockRpc) {
      await installMockRpc(page, {
        chainId: e2eEnv.chainId,
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

    await visitLegacyPersonalizePage(page);
    await setup.waitForWagmi();

    const squareNumber = e2eEnv?.legacyPersonalizeSquareId || 1;
    const walletName = walletConfigFromEnv.walletName || 'Wallet';
    const imagePath = getLegacyPersonalizeImagePath();

    await runLegacyPersonalizeFlow(page, {
      squareNumber,
      walletName,
      title: 'My Su Square',
      url: 'https://example.com',
      imagePath,
    });
  });
});
