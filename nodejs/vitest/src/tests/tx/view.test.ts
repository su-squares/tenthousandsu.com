import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createMockTxState } from '@fixtures/state';
import { createTestContainer, cleanupTestContainer, queryBySelector } from '@test-helpers/dom';

describe('tx/view.js', () => {
  let container: HTMLElement;
  let renderTxView: any;

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
});
