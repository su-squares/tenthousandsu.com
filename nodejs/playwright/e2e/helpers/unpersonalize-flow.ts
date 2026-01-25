import { expect, type Page } from '@playwright/test';
import { maybeConnectWallet } from './wallet-flow.js';

type UnpersonalizeOptions = {
  squareNumber: number;
  walletName: string;
  expectFailure?: boolean;
};

const SELECTORS = {
  trigger: '#open-unpersonalize-modal',
  modal: '#unpersonalize-modal',
  tokenInput: '#unpersonalize-token-id',
  submit: '#unpersonalize-submit',
};

export async function openUnpersonalizeModal(page: Page) {
  const trigger = page.locator(SELECTORS.trigger);
  await expect(trigger).toBeVisible({ timeout: 10_000 });
  await trigger.click();

  const modal = page.locator(SELECTORS.modal);
  await expect(modal).toHaveClass(/is-visible/, { timeout: 10_000 });
  await expect(page.locator(SELECTORS.tokenInput)).toBeVisible({ timeout: 10_000 });
  await expect(page.locator('#unpersonalize-tx-fixture .su-tx-card')).toBeVisible({ timeout: 10_000 });
}

export async function runUnpersonalizeFlow(page: Page, options: UnpersonalizeOptions) {
  await openUnpersonalizeModal(page);

  const tokenInput = page.locator(SELECTORS.tokenInput);
  await tokenInput.fill(String(options.squareNumber));
  await page.dispatchEvent(SELECTORS.tokenInput, 'input');

  const submit = page.locator(SELECTORS.submit);
  await expect(submit).toBeEnabled({ timeout: 15_000 });

  if (options.expectFailure) {
    let dialogMessage: string | null = null;
    page.once('dialog', (dialog) => {
      dialogMessage = dialog.message();
      dialog.accept().catch(() => {});
    });

    await submit.click();
    await page.evaluate(() => {
      const modal = document.getElementById('unpersonalize-modal');
      if (modal) modal.style.pointerEvents = 'none';
    });
    await maybeConnectWallet(page, options.walletName, { forceClick: true });

    const status = page.locator(`${SELECTORS.modal} [data-testid="tx-status"]`);
    await expect(status).toHaveAttribute('data-status', 'error', { timeout: 20_000 });

    const message = page.locator('#unpersonalize-tx-fixture .su-tx-message');
    await expect(message).toContainText(/do not own/i, { timeout: 10_000 });

    if (dialogMessage) {
      expect(dialogMessage).toMatch(/do not own/i);
    }
    return;
  }

  await submit.click();
  await page.evaluate(() => {
    const modal = document.getElementById('unpersonalize-modal');
    if (modal) modal.style.pointerEvents = 'none';
  });
  await maybeConnectWallet(page, options.walletName, { forceClick: true });

  const status = page.locator(`${SELECTORS.modal} [data-testid="tx-status"]`);
  await expect(status).toHaveAttribute('data-status', 'success', { timeout: 20_000 });
}
