import { test } from '@playwright/test';
import { setupTest } from '../wallet/index.js';
import { installMockRpc } from './mocks/rpc/index.js';
import { visitBuyPage, runBuyFlow, resetBuyFlow, resolveSquareNumber } from './helpers/buy-flow.js';

let e2eEnv: any = null;
let walletConfigFromEnv: any = null;
let logE2eEnvOnce: () => void = () => {};
let envLoadError: Error | null = null;

test.describe('Buy Square flow', () => {
  test.beforeAll(async () => {
    try {
      const env = await import('../env.js');
      e2eEnv = env.e2eEnv;
      walletConfigFromEnv = env.walletConfigFromEnv;
      logE2eEnvOnce = env.logE2eEnvOnce;
    } catch (error) {
      envLoadError = error instanceof Error ? error : new Error(String(error));
      console.warn('[buy-square-test] Skipping: env missing/invalid.', envLoadError.message);
    }

    test.skip(Boolean(envLoadError), 'wallet env missing/invalid');
  });

  test('buy-square', async ({ page }, testInfo) => {
    test.setTimeout(60_000);
    test.skip(!walletConfigFromEnv, 'wallet env missing/invalid');
    logE2eEnvOnce();

    const useMockRpc = Boolean(e2eEnv?.mockRpc);
    if (useMockRpc) {
      await installMockRpc(page, {
        chainId: e2eEnv.chainId,
        failDuplicatePurchase: true,
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

    await visitBuyPage(page);
    await setup.waitForWagmi();

    const preferredSquareId = e2eEnv?.buySquareId || 1;
    const walletName = walletConfigFromEnv.walletName || 'Wallet';

    const projectNames = (testInfo.config.projects || []).map((project) => project.name);
    const projectIndex = Math.max(0, projectNames.indexOf(testInfo.project.name));
    const offsetSquare = useMockRpc
      ? preferredSquareId
      : ((preferredSquareId - 1 + projectIndex) % 10000) + 1;

    const squareNumber = useMockRpc
      ? offsetSquare
      : await resolveSquareNumber(page, offsetSquare);

    await runBuyFlow(page, { squareNumber, walletName, expectFailure: false });
    await resetBuyFlow(page);
    await runBuyFlow(page, { squareNumber, walletName, expectFailure: true });
  });
});
