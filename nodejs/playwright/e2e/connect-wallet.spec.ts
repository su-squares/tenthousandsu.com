import { test, expect } from '@playwright/test';
import { setupTest } from '../wallet/index.js';
import { connectWalletFromModal, openConnectWalletModal } from './helpers/wallet-flow.js';

let walletConfigFromEnv: any = null;
let logE2eEnvOnce: () => void = () => {};
let envLoadError: Error | null = null;

test.describe('Connect Wallet modal', () => {
  test.beforeAll(async () => {
    try {
      const env = await import('../env.js');
      walletConfigFromEnv = env.walletConfigFromEnv;
      logE2eEnvOnce = env.logE2eEnvOnce;
    } catch (error) {
      envLoadError = error instanceof Error ? error : new Error(String(error));
      console.warn('[wallet-test] Skipping: env missing/invalid.', envLoadError.message);
    }

    test.skip(Boolean(envLoadError), 'wallet env missing/invalid');
  });

  test('connect-wallet', async ({ page }) => {
    const DEBUG_WALLET = false;
    test.skip(!walletConfigFromEnv, 'wallet env missing/invalid');
    logE2eEnvOnce();

    const setup = await setupTest(page, {
      clearStorage: true,
      injectWallet: true,
      walletConfig: walletConfigFromEnv,
    });

    await page.goto('/', { waitUntil: 'networkidle' });
    await setup.waitForWagmi();

    const connectButton = page.locator('#connect-wallet');
    await openConnectWalletModal(page);
    await connectWalletFromModal(page, walletConfigFromEnv.walletName, { requireConnecting: true });

    // Wait for wallet connection to be recorded in the injected provider.
    await page.waitForFunction(
      () => Array.isArray((window as any).ethereum?._accounts) && (window as any).ethereum._accounts.length > 0,
      { timeout: 15_000 }
    );

    const dumpState = async (label: string) => {
      if (!DEBUG_WALLET) return;
      const state = await page.evaluate(() => {
        let wagmiStore: string | null = null;
        let wagmiConnected: string | null = null;
        try {
          wagmiStore = localStorage.getItem('wagmi.store');
          wagmiConnected = localStorage.getItem('wagmi.connected');
        } catch (err) {
          wagmiStore = `localStorage error: ${(err as Error).message}`;
        }

        const eth: any = (window as any).ethereum;
        return {
          wagmiStore,
          wagmiConnected,
          ethAccounts: Array.isArray(eth?._accounts) ? eth._accounts : null,
          ethConnected: eth?._connected ?? null,
          ethChainId: eth?._chainId ?? null,
          overlayVisible: Boolean(document.querySelector('.wallet-overlay.is-visible')),
        };
      });
      console.log(`[wallet-debug] ${label}: ${JSON.stringify(state)}`);
    };

    await dumpState('after-connect');

    // Wait for modal to fully close (let the animation complete)
    await expect(page.locator('.wallet-overlay.is-visible')).toHaveCount(0, { timeout: 10_000 });
    await page.waitForTimeout(500); // Extra buffer for modal close animation

    // Click the connect button again to open the account modal
    await expect(connectButton).toBeEnabled({ timeout: 10_000 });
    await connectButton.click();

    // Handle both modals: account modal (success) or connect modal (need retry)
    const disconnectButton = page.getByTestId('disconnect-wallet-button');
    const walletListHeading = page.getByRole('heading', { name: /connect your wallet/i });

    // Race between account modal and connect modal
    const result = await Promise.race([
      disconnectButton.waitFor({ state: 'visible', timeout: 5000 }).then(() => 'account-modal' as const),
      walletListHeading.waitFor({ state: 'visible', timeout: 5000 }).then(() => 'connect-modal' as const),
    ]).catch(() => 'timeout' as const);

    if (result === 'connect-modal') {
      if (DEBUG_WALLET) {
        console.log('[wallet-debug] Got connect modal instead of account modal, reconnecting...');
      }

      // Select the wallet to trigger connection
      await connectWalletFromModal(page, walletConfigFromEnv.walletName);

      // Wait for provider to have accounts (handles both new connection and reconnection)
      await page.waitForFunction(
        () => Array.isArray((window as any).ethereum?._accounts) && (window as any).ethereum._accounts.length > 0,
        { timeout: 15_000 }
      );

      // Wait for modal to close
      await expect(page.locator('.wallet-overlay.is-visible')).toHaveCount(0, { timeout: 10_000 });
      await page.waitForTimeout(500);

      // Click connect button again to open account modal
      await connectButton.click();
    }

    // Now we should see the account modal with disconnect button
    await expect(disconnectButton).toBeVisible({ timeout: 15_000 });
    await dumpState('after-account-modal');
  });
});
