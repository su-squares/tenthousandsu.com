import { test } from '@playwright/test';
import { setupTest } from '../wallet/index.js';
import { installMockRpc } from './mocks/rpc/index.js';
import { runUnpersonalizeFlow } from './helpers/unpersonalize-flow.js';

const NON_OWNER_ADDRESS = '0x000000000000000000000000000000000000dead';

let e2eEnv: any = null;
let walletConfigFromEnv: any = null;
let logE2eEnvOnce: () => void = () => {};
let envLoadError: Error | null = null;

async function mockMainContractPersonalization(page: any, squareIds: number[]) {
  const normalized = squareIds.filter((id) => Number.isFinite(id) && id >= 1);
  if (!normalized.length) return;

  const maxId = Math.max(...normalized);
  const extra = Array(maxId).fill(null);
  const personalizations = Array(maxId).fill(null);

  for (const id of normalized) {
    extra[id - 1] = [0, 0, true, 1];
    personalizations[id - 1] = ['Mock Title', 'https://example.com'];
  }

  await page.addInitScript(
    ({
      extra,
      personalizations,
    }: {
      extra: Array<unknown>;
      personalizations: Array<[string, string] | null>;
    }) => {
      const originalFetch = window.fetch.bind(window);
      window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === 'string'
          ? input
          : input instanceof Request
            ? input.url
            : input?.toString?.() || '';
        if (/squareExtra\.json/i.test(url)) {
          return new Response(JSON.stringify(extra), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        if (/squarePersonalizations\.json/i.test(url)) {
          return new Response(JSON.stringify(personalizations), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        return originalFetch(input as RequestInfo, init);
      };
    },
    { extra, personalizations }
  );
}

test.describe.serial('Legacy unpersonalize flow', () => {
  test.beforeAll(async () => {
    try {
      const env = await import('../env.js');
      e2eEnv = env.e2eEnv;
      walletConfigFromEnv = env.walletConfigFromEnv;
      logE2eEnvOnce = env.logE2eEnvOnce;
    } catch (error) {
      envLoadError = error instanceof Error ? error : new Error(String(error));
      console.warn('[legacy-unpersonalize-test] Skipping: env missing/invalid.', envLoadError.message);
    }

    test.skip(Boolean(envLoadError), 'wallet env missing/invalid');
  });

  test('legacy-unpersonalize', async ({ page }) => {
    test.setTimeout(60_000);
    test.skip(!walletConfigFromEnv, 'wallet env missing/invalid');
    logE2eEnvOnce();

    const useMockRpc = Boolean(e2eEnv?.mockRpc);
    if (useMockRpc) {
      await installMockRpc(page, {
        chainId: e2eEnv.chainId,
        ownerAddress: walletConfigFromEnv.address,
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

    const squareNumber = e2eEnv?.legacyUnpersonalizeSquareId || 1;
    await mockMainContractPersonalization(page, [squareNumber]);
    await page.goto('/personalize-modern.html', { waitUntil: 'domcontentloaded' });
    await setup.waitForWagmi();

    const walletName = walletConfigFromEnv.walletName || 'Wallet';

    await runUnpersonalizeFlow(page, { squareNumber, walletName });
  });

  test('legacy-unpersonalize-unowned', async ({ page }) => {
    test.setTimeout(60_000);
    test.skip(!walletConfigFromEnv, 'wallet env missing/invalid');
    logE2eEnvOnce();

    const failSquare = e2eEnv?.legacyUnpersonalizeFailSquareId;
    test.skip(!failSquare, 'no unowned square configured');
    test.skip(
      failSquare === e2eEnv?.legacyUnpersonalizeSquareId,
      'unowned square matches owned square'
    );

    const useMockRpc = Boolean(e2eEnv?.mockRpc);
    if (useMockRpc) {
      await installMockRpc(page, {
        chainId: e2eEnv.chainId,
        ownerAddress: walletConfigFromEnv.address,
        ownerOverrides: [
          { squareId: failSquare, owner: NON_OWNER_ADDRESS },
        ],
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

    await mockMainContractPersonalization(page, [failSquare]);
    await page.goto('/personalize-modern.html', { waitUntil: 'domcontentloaded' });
    await setup.waitForWagmi();

    const walletName = walletConfigFromEnv.walletName || 'Wallet';

    await runUnpersonalizeFlow(page, {
      squareNumber: failSquare,
      walletName,
      expectFailure: true,
    });
  });
});
