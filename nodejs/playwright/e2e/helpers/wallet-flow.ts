import { expect, type Page } from '@playwright/test';

const SELECTORS = {
  connectButton: '#connect-wallet',
};

export async function openConnectWalletModal(page: Page) {
  const connectButton = page.locator(SELECTORS.connectButton);
  await expect(connectButton).toBeVisible({ timeout: 10_000 });
  await expect(connectButton).toBeEnabled({ timeout: 10_000 });
  await connectButton.click();

  const listHeading = page.getByRole('heading', { name: /connect your wallet/i });
  await expect(listHeading).toBeVisible({ timeout: 10_000 });
}

export async function connectWalletFromModal(
  page: Page,
  walletName: string,
  options: { requireConnecting?: boolean; forceClick?: boolean } = {}
) {
  const walletButton = page.getByRole('button', { name: new RegExp(walletName, 'i') });
  await expect(walletButton).toBeVisible({ timeout: 10_000 });
  await walletButton.click({ force: options.forceClick });

  const connectingHeading = page.getByRole('heading', { name: /connecting/i });
  if (options.requireConnecting) {
    await expect(connectingHeading).toBeVisible({ timeout: 10_000 });
  } else {
    await connectingHeading.waitFor({ state: 'visible', timeout: 10_000 }).catch(() => {});
  }
}

export async function maybeConnectWallet(
  page: Page,
  walletName: string,
  options: { requireConnecting?: boolean; forceClick?: boolean } = {}
) {
  const connectHeading = page.getByRole('heading', { name: /connect your wallet/i });
  const connectVisible = await connectHeading
    .waitFor({ state: 'visible', timeout: 3000 })
    .then(() => true)
    .catch(() => false);

  if (connectVisible) {
    await connectWalletFromModal(page, walletName, options);
  }
}
