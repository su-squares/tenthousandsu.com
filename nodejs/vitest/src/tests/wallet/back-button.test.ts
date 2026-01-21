import { describe, it, expect, vi } from 'vitest';
import { ensureBackButton } from '@web3/wallet/back-button.js';
import { createTestContainer, cleanupTestContainer } from '@test-helpers/dom';

describe('wallet/back-button.js', () => {
  it('creates a back button once and toggles visibility', () => {
    const container = createTestContainer();
    const modal = document.createElement('div');
    container.appendChild(modal);

    const onBack = vi.fn();
    const backButton = ensureBackButton(modal, onBack);

    expect(backButton).toBeTruthy();
    expect(backButton?.className).toBe('wallet-back');
    expect(backButton?.style.display).toBe('block');

    backButton?.click();
    expect(onBack).toHaveBeenCalledTimes(1);

    const reusedButton = ensureBackButton(modal, null);
    expect(reusedButton).toBe(backButton);
    expect(reusedButton?.style.display).toBe('none');

    cleanupTestContainer(container);
  });

  it('returns null when modal element is missing', () => {
    const result = ensureBackButton(null as unknown as HTMLElement, null);
    expect(result).toBeNull();
  });
});
