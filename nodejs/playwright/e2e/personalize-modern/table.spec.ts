import { test, expect } from '@playwright/test';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { setupTest } from '../../wallet/index.js';
import { installMockRpc } from '../mocks/rpc/index.js';
import { installMockBillboard } from '../mocks/billboard/index.js';
import { expectTxStatus } from '../helpers/tx-flow.js';
import { connectWalletFromModal, maybeConnectWallet, openConnectWalletModal } from '../helpers/wallet-flow.js';
import { getRed10x10Path, visitPersonalizeModernPage } from '../helpers/personalize-modern.js';

let e2eEnv: any = null;
let walletConfigFromEnv: any = null;
let logE2eEnvOnce: () => void = () => {};
let envLoadError: Error | null = null;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const RUNTIME_CONFIG_PATH = resolve(
  __dirname,
  '..',
  '..',
  '..',
  '..',
  'assets',
  'web3',
  'config',
  'runtime.generated.js'
);

function buildRuntimeOverride(chainKey: string, chainId: number) {
  const source = readFileSync(RUNTIME_CONFIG_PATH, 'utf-8');
  const normalized = String(chainKey || '').toLowerCase();
  const isSunet = normalized === 'sunet';
  const override = [
    '',
    'window.suWeb3 = Object.assign({}, window.suWeb3, {',
    `  chain: "${normalized}",`,
    ...(isSunet ? [`  sunetChainId: ${Number(chainId)}`] : []),
    '});',
    '',
  ].join('\n');
  return source + override;
}

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

    const rawSquareIds = Array.isArray(e2eEnv?.personalizeSquareIds)
      ? (e2eEnv.personalizeSquareIds as number[])
      : [];
    const squareIds = rawSquareIds
      .map((id: number) => Number(id))
      .filter((id: number) => Number.isInteger(id) && id >= 1 && id <= 10000);
    test.skip(squareIds.length === 0, 'PERSONALIZE_SQUARE_ID missing/empty');

    const squareId = squareIds[0];
    const title = `Manual Title ${squareId}`;
    const uri = `https://example.com/${squareId}`;

    const useMockRpc = Boolean(e2eEnv?.mockRpc);
    const useMockBillboard = Boolean(e2eEnv?.mockBillboard);
    if (useMockRpc) {
      await installMockRpc(page, {
        chainId: e2eEnv.chainId,
        ownerAddress: e2eEnv.address,
        ownedSquares: squareIds,
        interceptAllRpc: true,
      });
    }
    if (useMockRpc && useMockBillboard) {
      await installMockBillboard(page, e2eEnv.mockBillboardConfig);
    }

    if (useMockRpc) {
      const overrideScript = buildRuntimeOverride(e2eEnv.network, e2eEnv.chainId);
      await page.route(/assets\/web3\/config\/runtime\.generated\.js/i, (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/javascript',
          body: overrideScript,
        })
      );
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

    // Connect wallet before ownership-dependent actions
    await openConnectWalletModal(page);
    await connectWalletFromModal(page, walletConfigFromEnv.walletName || 'Wallet', { forceClick: true });
    await setup.waitForAccounts();

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
