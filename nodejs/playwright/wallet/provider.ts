// dapp/e2e/playwright/wallet/provider.ts
import type { Page } from '@playwright/test';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { DEFAULT_WALLET_CONFIG } from './defaults.js';
import type { WalletStubConfig } from './types.js';

// ESM-safe __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Injects the bundled provider into the page, after seeding window.__TEST_WALLET_CONFIG.
 * IMPORTANT: ensure e2e/playwright/wallet/injected/provider.js exists (built by esbuild).
 */
export async function injectWallet(page: Page, config: WalletStubConfig = {}) {
  const finalConfig = { ...DEFAULT_WALLET_CONFIG, ...config };

  // 1) Seed runtime config
  await page.addInitScript((cfg: any) => {
    (window as any).__TEST_WALLET_CONFIG = cfg;
  }, finalConfig);

  // 2) Inject the bundled browser script (ESM-safe path)
  const injectedPath = join(__dirname, 'injected', 'provider.js');
  await page.addInitScript({ path: injectedPath });

  return finalConfig;
}

export type { WalletStubConfig } from './types.js';
