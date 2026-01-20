import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createMockTxState } from '@fixtures/state';
import { createMockBalance } from '@test-helpers/balance';
import { TEST_ADDRESSES } from '@fixtures/addresses';

vi.mock('@web3/wallet/balance-store.js', () => ({
  getBalance: vi.fn(async ({ address, chainId, fetcher }) => {
    const balance = await fetcher(address, chainId);
    return { balance, source: 'fresh' };
  }),
  getCachedBalance: vi.fn(() => null),
  subscribeBalance: vi.fn((callback) => {
    return vi.fn();
  }),
  invalidateBalance: vi.fn(),
  refreshBalance: vi.fn(async (address, chainId, fetcher) => {
    return fetcher(address, chainId);
  })
}));

describe('tx/balance-manager.js', () => {
  let state: ReturnType<typeof createMockTxState>;
  let updateStateCalls: any[];
  let createBalanceManager: any;

  beforeEach(async () => {
    state = createMockTxState();
    updateStateCalls = [];
    const module = await import('@web3/tx/balance-manager.js');
    createBalanceManager = module.createBalanceManager;
  });

  function createManager() {
    return createBalanceManager({
      updateState: (patch: any) => {
        updateStateCalls.push(patch);
        if (typeof patch === 'function') {
          patch(state);
        } else {
          Object.assign(state, patch);
        }
      },
      getState: () => state
    });
  }

  it('should initialize without errors', () => {
    const manager = createManager();
    expect(manager).toBeTruthy();
    expect(manager.setContext).toBeInstanceOf(Function);
    expect(manager.refresh).toBeInstanceOf(Function);
    expect(manager.destroy).toBeInstanceOf(Function);
  });

  it('should clear balance when setContext called with null', async () => {
    const manager = createManager();

    await manager.setContext(null);

    expect(state.showBalance).toBe(false);
    expect(state.balance).toBeNull();
    expect(state.balanceContext).toBeNull();
    expect(state.balanceLoading).toBe(false);
  });

  it('should set balanceLoading to true when fetching', async () => {
    const manager = createManager();
    const mockFetcher = vi.fn(async () => createMockBalance());

    const contextPromise = manager.setContext({
      address: TEST_ADDRESSES.WALLET_1,
      chainId: 1,
      fetcher: mockFetcher
    });

    expect(state.balanceLoading).toBe(true);

    await contextPromise;
  });

  it('should fetch and update balance on setContext', async () => {
    const manager = createManager();
    const mockBalance = createMockBalance('5.5', 'ETH');
    const mockFetcher = vi.fn(async () => mockBalance);

    await manager.setContext({
      address: TEST_ADDRESSES.WALLET_1,
      chainId: 1,
      fetcher: mockFetcher
    });

    expect(state.balance).toEqual(mockBalance);
    expect(state.balanceLoading).toBe(false);
    expect(state.showBalance).toBe(true);
    expect(mockFetcher).toHaveBeenCalled();
  });

  it('should handle fetch errors gracefully', async () => {
    const manager = createManager();
    const mockFetcher = vi.fn(async () => {
      throw new Error('Network error');
    });

    await manager.setContext({
      address: TEST_ADDRESSES.WALLET_1,
      chainId: 1,
      fetcher: mockFetcher
    });

    expect(state.balanceLoading).toBe(false);
  });

  it('should cleanup subscription on destroy', () => {
    const manager = createManager();

    expect(() => manager.destroy()).not.toThrow();
  });
});
