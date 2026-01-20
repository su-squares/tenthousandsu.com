import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createMockTxState } from '@fixtures/state';
import { createTestContainer, cleanupTestContainer, queryBySelector } from '@test-helpers/dom';

describe('tx/view.js', () => {
  let container: HTMLElement;
  let renderTxView: any;
  const normalizeText = (value?: string | null) => (value ?? '').replace(/\s+/g, ' ').trim();

  beforeEach(async () => {
    container = createTestContainer();
    const module = await import('@web3/tx/view.js');
    renderTxView = module.renderTxView;
  });

  afterEach(() => {
    cleanupTestContainer(container);
  });

  it('should render idle state with title', () => {
    const state = createMockTxState({ title: 'Test Transaction' });
    const handlers = {};

    renderTxView(container, state, handlers);

    const title = queryBySelector(container, '.su-tx-card__title');
    expect(title).toBeTruthy();
    expect(title?.textContent).toBe('Test Transaction');
  });

  it('should render balance with em dash when no balance', () => {
    const state = createMockTxState({
      showBalance: true,
      balanceContext: {
        address: '0x123',
        chainId: 1,
        fetcher: async () => null
      },
      balance: null,
      balanceLoading: false
    });

    renderTxView(container, state, {});

    const balanceValue = queryBySelector(container, '.su-tx-balance__value');
    expect(balanceValue?.textContent).toBe('—');
  });

  it('should render balance with formatted value', () => {
    const state = createMockTxState({
      showBalance: true,
      balanceContext: {
        address: '0x123',
        chainId: 1,
        fetcher: async () => null
      },
      balance: { formatted: '1.234567', symbol: 'ETH' },
      balanceLoading: false
    });

    renderTxView(container, state, {});

    const balanceValue = queryBySelector(container, '.su-tx-balance__value');
    expect(balanceValue?.textContent).toContain('1.2345');
    expect(balanceValue?.textContent).toContain('ETH');
  });

  it('should show loading state for balance', () => {
    const state = createMockTxState({
      showBalance: true,
      balanceContext: {
        address: '0x123',
        chainId: 1,
        fetcher: async () => null
      },
      balanceLoading: true
    });

    renderTxView(container, state, {});

    const balanceValue = queryBySelector(container, '.su-tx-balance__value');
    expect(balanceValue?.textContent).toBe('Loading...');
  });

  it('should attach event handlers to buttons', () => {
    const onClose = vi.fn();
    const state = createMockTxState({ status: 'success' });

    renderTxView(container, state, { onClose }, { showClose: true });

    const closeButton = queryBySelector<HTMLButtonElement>(container, '[data-tx-close]');
    expect(closeButton).toBeTruthy();

    closeButton?.click();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('should not render balance section when showBalance is false', () => {
    const state = createMockTxState({ showBalance: false });

    renderTxView(container, state, {});

    const balanceSection = queryBySelector(container, '.su-tx-balance');
    expect(balanceSection).toBeNull();
  });

  it('should render status bar, message, and help text for non-idle status', () => {
    const state = createMockTxState({ status: 'error', message: 'Something failed', helpText: '' });

    renderTxView(container, state, {});

    const barLabel = queryBySelector(container, '.su-tx-bar span');
    expect(barLabel?.textContent).toBe('Error!');

    const message = queryBySelector(container, '.su-tx-message');
    expect(message?.textContent).toBe('Something failed');

    const help = queryBySelector(container, '.su-tx-help');
    expect(normalizeText(help?.textContent)).toBe(
      'Need to retry? You can restart the transaction or clear this panel.'
    );
  });

  it('should render pricing totals for personalize mode', () => {
    const state = createMockTxState({
      status: 'idle',
      mode: 'personalize',
      showPersonalizeTotal: true,
      personalizeCount: 3,
      pricing: { mintPriceEth: 0.5, personalizePriceEth: 0.1 }
    });

    renderTxView(container, state, {});

    const items = Array.from(container.querySelectorAll('.su-tx-price__item'))
      .map(item => normalizeText(item.textContent))
      .filter(Boolean);
    const totalLine = items.find(item => item.startsWith('Total:'));
    expect(totalLine).toContain('3 * 0.1 = 0.3 ETH');
  });

  it('should render transaction list with badges and links', () => {
    const pendingHash = '0x1234567890abcdef';
    const confirmedHash = '0xabcdef1234567890';
    const state = createMockTxState({
      status: 'error',
      pending: [{ hash: pendingHash, url: 'https://explorer.test/tx/123' }],
      confirmed: [{ hash: confirmedHash }]
    });

    renderTxView(container, state, {});

    const pendingBadge = queryBySelector(container, '.su-tx-list__badge--error');
    expect(pendingBadge?.textContent).toBe('Failed');

    const confirmedBadge = queryBySelector(container, '.su-tx-list__badge--success');
    expect(confirmedBadge?.textContent).toBe('Confirmed');

    const pendingLink = queryBySelector<HTMLAnchorElement>(container, '.su-tx-list__item a');
    expect(pendingLink?.getAttribute('href')).toBe('https://explorer.test/tx/123');
    expect(pendingLink?.textContent).toBe('0x123456...abcdef');
  });

  it('should render wallet and cancel buttons and invoke handlers', () => {
    const onOpenWallet = vi.fn();
    const onCancel = vi.fn();
    const state = createMockTxState({ status: 'pending', showWalletButton: true });

    renderTxView(container, state, { onOpenWallet, onCancel });

    const walletButton = queryBySelector<HTMLButtonElement>(container, '[data-tx-open-wallet]');
    const cancelButton = queryBySelector<HTMLButtonElement>(container, '[data-tx-cancel]');

    expect(walletButton).toBeTruthy();
    expect(cancelButton).toBeTruthy();

    walletButton?.click();
    cancelButton?.click();

    expect(onOpenWallet).toHaveBeenCalledTimes(1);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('should attach refresh handler when provided', () => {
    const onRefreshBalance = vi.fn().mockResolvedValue(undefined);
    const state = createMockTxState({
      showBalance: true,
      balanceContext: {
        address: '0x123',
        chainId: 1,
        fetcher: async () => null
      }
    });

    renderTxView(container, state, { onRefreshBalance });

    const refreshButton = queryBySelector<HTMLButtonElement>(container, '[data-balance-refresh]');
    expect(refreshButton).toBeTruthy();

    refreshButton?.click();
    expect(onRefreshBalance).toHaveBeenCalledTimes(1);
  });
});
