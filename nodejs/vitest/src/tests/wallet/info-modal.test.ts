import { vi } from 'vitest';

describe('wallet/info-modal/index.js', () => {
  let openInfoModal: (onBack?: (() => void) | null) => Promise<void>;
  let closeInfoModal: () => void;

  beforeEach(async () => {
    vi.resetModules();
    const module = await import('@web3/wallet/info-modal/index.js');
    openInfoModal = module.openInfoModal;
    closeInfoModal = module.closeInfoModal;
  });

  afterEach(() => {
    if (closeInfoModal) closeInfoModal();
  });

  it('opens with aria attributes and resolves on back', async () => {
    const onBack = vi.fn();
    const promise = openInfoModal(onBack);

    const overlay = document.getElementById('wallet-info-modal') as HTMLElement;
    expect(overlay).toBeTruthy();
    expect(overlay.classList.contains('is-visible')).toBe(true);

    const modal = overlay.querySelector('.wallet-modal') as HTMLElement;
    expect(modal.getAttribute('aria-labelledby')).toBe('wallet-info-title');
    expect(modal.getAttribute('aria-describedby')).toBe('wallet-info-text');

    const backButton = overlay.querySelector('.wallet-back') as HTMLButtonElement;
    expect(backButton).toBeTruthy();
    backButton.click();

    await promise;
    expect(onBack).toHaveBeenCalledTimes(1);
    expect(overlay.classList.contains('is-visible')).toBe(false);
  });

  it('resolves when closed programmatically', async () => {
    const promise = openInfoModal();

    closeInfoModal();

    await promise;
  });
});
