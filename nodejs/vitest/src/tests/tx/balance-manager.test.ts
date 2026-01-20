import { createMockTxState } from '@fixtures/state';
import { createMockBalance } from '@test-helpers/balance';
import { TEST_ADDRESSES } from '@fixtures/addresses';
import { waitFor } from '@testing-library/dom';

vi.mock('@web3/wallet/balance-store.js', () => ({
  getBalance: vi.fn(async ({ address, chainId, fetcher }) => {
    const balance = await fetcher(address, chainId);
    return { balance, source: 'fresh' };
  }),
  getCachedBalance: vi.fn(() => null),
  subscribeBalance: vi.fn(() => {
    return vi.fn();
  }),
  invalidateBalance: vi.fn(),
  refreshBalance: vi.fn(async (address, chainId, fetcher) => {
    return fetcher(address, chainId);
  })
}));

import {
  getBalance,
  getCachedBalance,
  subscribeBalance,
  invalidateBalance,
  refreshBalance
} from '@web3/wallet/balance-store.js';

const getBalanceMock = vi.mocked(getBalance);
const getCachedBalanceMock = vi.mocked(getCachedBalance);
const subscribeBalanceMock = vi.mocked(subscribeBalance);
const invalidateBalanceMock = vi.mocked(invalidateBalance);
const refreshBalanceMock = vi.mocked(refreshBalance);
type BalanceSubscriber = (payload: {
  address: string;
  chainId: number;
  balance: any;
  source: string;
}) => void;

const createDeferred = <T>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

describe('tx/balance-manager.js', () => {
  let state: ReturnType<typeof createMockTxState>;
  let updateStateCalls: any[];
  let createBalanceManager: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    state = createMockTxState();
    updateStateCalls = [];
    const module = await import('@web3/tx/balance-manager.js');
    createBalanceManager = module.createBalanceManager;

    getBalanceMock.mockImplementation(async ({ address, chainId, fetcher }) => {
      const balance = await fetcher(address, chainId);
      return { balance, source: 'fresh' };
    });
    getCachedBalanceMock.mockReturnValue(null);
    subscribeBalanceMock.mockImplementation(() => vi.fn());
    refreshBalanceMock.mockImplementation(async (address, chainId, fetcher) => {
      return fetcher(address, chainId);
    });
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

  it('should apply cached balance before fresh fetch resolves', async () => {
    const manager = createManager();
    const cachedBalance = createMockBalance('2.0', 'ETH');
    const freshBalance = createMockBalance('3.0', 'ETH');
    const deferred = createDeferred<ReturnType<typeof createMockBalance>>();
    const mockFetcher = vi.fn(async () => deferred.promise);

    getCachedBalanceMock.mockReturnValue(cachedBalance);

    const contextPromise = manager.setContext({
      address: TEST_ADDRESSES.WALLET_1,
      chainId: 1,
      fetcher: mockFetcher
    });

    await waitFor(() => {
      expect(state.balance).toEqual(cachedBalance);
      expect(state.balanceLoading).toBe(false);
    });

    deferred.resolve(freshBalance);
    await contextPromise;

    expect(state.balance).toEqual(freshBalance);
  });

  it('should update balance from subscription updates', async () => {
    const manager = createManager();
    const subscriptionBalance = createMockBalance('9.9', 'ETH');
    let subscriber: BalanceSubscriber | null = null;

    subscribeBalanceMock.mockImplementation((handler) => {
      subscriber = handler;
      return vi.fn();
    });

    await manager.setContext({
      address: TEST_ADDRESSES.WALLET_1,
      chainId: 1,
      fetcher: vi.fn(async () => createMockBalance())
    });

    (subscriber as BalanceSubscriber | null)?.({
      address: TEST_ADDRESSES.WALLET_1,
      chainId: 1,
      balance: subscriptionBalance,
      source: 'fresh'
    });
    expect(state.balance).toEqual(subscriptionBalance);
  });

  it('should ignore subscription updates for other addresses', async () => {
    const manager = createManager();
    let subscriber: BalanceSubscriber | null = null;

    subscribeBalanceMock.mockImplementation((handler) => {
      subscriber = handler;
      return vi.fn();
    });

    await manager.setContext({
      address: TEST_ADDRESSES.WALLET_1,
      chainId: 1,
      fetcher: vi.fn(async () => createMockBalance())
    });

    const currentBalance = state.balance;
    (subscriber as BalanceSubscriber | null)?.({
      address: TEST_ADDRESSES.WALLET_2,
      chainId: 1,
      balance: createMockBalance('4.2', 'ETH'),
      source: 'fresh'
    });
    expect(state.balance).toEqual(currentBalance);
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

  it('should invalidate and refresh when context exists', async () => {
    const manager = createManager();
    const mockFetcher = vi.fn(async () => createMockBalance());

    await manager.setContext({
      address: TEST_ADDRESSES.WALLET_1,
      chainId: 1,
      fetcher: mockFetcher
    });

    await manager.invalidateAndRefresh();

    expect(invalidateBalanceMock).toHaveBeenCalledWith(TEST_ADDRESSES.WALLET_1, 1);
    expect(refreshBalanceMock).toHaveBeenCalledWith(TEST_ADDRESSES.WALLET_1, 1, mockFetcher);
    expect(state.balanceLoading).toBe(true);
  });

  it('should refresh when context exists', async () => {
    const manager = createManager();
    const mockFetcher = vi.fn(async () => createMockBalance());

    await manager.setContext({
      address: TEST_ADDRESSES.WALLET_1,
      chainId: 1,
      fetcher: mockFetcher
    });

    await manager.refresh();

    expect(refreshBalanceMock).toHaveBeenCalledWith(TEST_ADDRESSES.WALLET_1, 1, mockFetcher);
  });

  it('should cleanup subscription on destroy', async () => {
    const manager = createManager();
    const unsubscribe = vi.fn();
    subscribeBalanceMock.mockImplementation(() => unsubscribe);

    await manager.setContext({
      address: TEST_ADDRESSES.WALLET_1,
      chainId: 1,
      fetcher: vi.fn(async () => createMockBalance())
    });

    expect(() => manager.destroy()).not.toThrow();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });
});
