import { test } from '@playwright/test';
import { setupTest } from '../../wallet/index.js';
import { installMockRpc } from '../mocks/rpc/index.js';
import {
  getRed40x40Path,
  visitPersonalizeModernPage,
  waitForSquareImages,
} from '../helpers/personalize-modern.js';

let e2eEnv: any = null;
let walletConfigFromEnv: any = null;
let logE2eEnvOnce: () => void = () => {};
let envLoadError: Error | null = null;

const EXPECTED_SQUARES = [
  4849, 4850, 4851, 4852,
  4949, 4950, 4951, 4952,
  5049, 5050, 5051, 5052,
  5149, 5150, 5151, 5152,
];

test.describe('Personalize Modern - Image Billboard', () => {
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

  test('image-billboard', async ({ page }) => {
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

    await visitPersonalizeModernPage(page);
    await setup.waitForWagmi();

    const imagePath = getRed40x40Path();
    await page.locator('#placement-image-input').setInputFiles(imagePath);

    const overlay = page.locator('.personalize-billboard__placement-overlay');
    await overlay.waitFor({ state: 'visible' });
    await page.waitForFunction(() => {
      const accept = document.getElementById('placement-accept');
      return accept && !accept.hasAttribute('disabled');
    });
    await overlay.click();
    await page.keyboard.press('Enter');

    await waitForSquareImages(page, EXPECTED_SQUARES);
  });
});
