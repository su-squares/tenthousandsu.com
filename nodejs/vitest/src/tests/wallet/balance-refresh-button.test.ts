import { describe, it, expect, afterEach } from 'vitest';
import {
  getRefreshButtonHTML,
  ensureRefreshButtonStyles,
  attachRefreshHandler,
  renderBalanceDisplay
} from '@web3/wallet/balance-refresh-button.js';
import { createTestContainer, cleanupTestContainer } from '@test-helpers/dom';

describe('wallet/balance-refresh-button.js', () => {
  afterEach(() => {
    const style = document.getElementById('balance-refresh-styles');
    if (style) style.remove();
  });

  it('renders refresh button HTML with loading state', () => {
    const html = getRefreshButtonHTML({ loading: true, ariaLabel: 'Refresh now' });

    expect(html).toContain('balance-refresh--spinning');
    expect(html).toContain('disabled');
    expect(html).toContain('aria-label="Refresh now"');
  });

  it('injects styles only once', () => {
    ensureRefreshButtonStyles();
    ensureRefreshButtonStyles();

    const styles = document.querySelectorAll('#balance-refresh-styles');
    expect(styles.length).toBe(1);
  });

  it('toggles spinner and disabled state during refresh', async () => {
    const container = createTestContainer();
    container.innerHTML = getRefreshButtonHTML();

    let resolveClick!: () => void;
    const onClick = () => new Promise<void>((resolve) => {
      resolveClick = resolve;
    });

    const cleanup = attachRefreshHandler(container, onClick);
    const button = container.querySelector('button') as HTMLButtonElement;

    button.click();

    expect(button.disabled).toBe(true);
    expect(button.classList.contains('balance-refresh--spinning')).toBe(true);

    resolveClick();
    await Promise.resolve();

    expect(button.disabled).toBe(false);
    expect(button.classList.contains('balance-refresh--spinning')).toBe(false);

    cleanup();
    cleanupTestContainer(container);
  });

  it('renders balance display with values', () => {
    const html = renderBalanceDisplay({
      balance: { formatted: '2.5', symbol: 'ETH' },
      loading: false
    });

    expect(html).toContain('2.5');
    expect(html).toContain('ETH');
  });

  it('renders loading display without balance', () => {
    const html = renderBalanceDisplay({ balance: null, loading: true });

    expect(html).toContain('Loading balance...');
  });
});
