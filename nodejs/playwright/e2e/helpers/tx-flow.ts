import { expect, type Page } from '@playwright/test';

export type TxStatus = 'processing' | 'pending' | 'success' | 'error';

export async function expectTxStatus(page: Page, status: TxStatus) {
  const statusEl = page.locator('[data-testid="tx-status"]');
  await expect(statusEl).toHaveAttribute('data-status', status, { timeout: 20_000 });
}
