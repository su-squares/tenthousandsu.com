import { vi } from 'vitest';
import {
  getBalance,
  getCachedBalance,
  subscribeBalance,
  clearAllBalanceCache,
  getBalanceStoreStatus,
  BALANCE_POLL_INTERVAL_MS
} from '@web3/wallet/balance-store.js';

describe('wallet/balance-store.js', () => {
  afterEach(() => {
    clearAllBalanceCache();
    vi.useRealTimers();
  });

  it('returns cached balance when fresh', async () => {
    const fetcher = vi.fn(async () => ({ formatted: '1.0', symbol: 'ETH' }));
    const address = '0x1234567890123456789012345678901234567890';
    const chainId = 1;

    const first = await getBalance({ address, chainId, fetcher });
    const second = await getBalance({ address, chainId, fetcher });

    expect(first.source).toBe('fresh');
    expect(second.source).toBe('cache');
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(getCachedBalance(address, chainId)).toEqual(first.balance);
  });

  it('dedupes in-flight balance fetches', async () => {
    let resolveFetch!: (value: any) => void;
    const fetcher = vi.fn(() => new Promise((resolve) => {
      resolveFetch = resolve;
    }));
    const address = '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd';
    const chainId = 1;

    const promiseOne = getBalance({ address, chainId, fetcher });
    const promiseTwo = getBalance({ address, chainId, fetcher });

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(promiseTwo).toBe(promiseOne);

    resolveFetch({ formatted: '3.0', symbol: 'ETH' });

    const result = await promiseOne;
    expect(result.balance).toBeTruthy();
  });

  it('polls while subscribers are active', async () => {
    vi.useFakeTimers();

    const fetcher = vi.fn(async () => ({ formatted: '4.2', symbol: 'ETH' }));
    const address = '0x9999999999999999999999999999999999999999';
    const chainId = 1;
    const events: Array<{ address: string }> = [];

    const unsubscribe = subscribeBalance((payload) => {
      events.push(payload);
    });

    await getBalance({ address, chainId, fetcher });

    expect(getBalanceStoreStatus().isPolling).toBe(true);

    await vi.advanceTimersByTimeAsync(BALANCE_POLL_INTERVAL_MS + 1);

    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(events.length).toBeGreaterThan(0);

    unsubscribe();

    expect(getBalanceStoreStatus().isPolling).toBe(false);
  });
});
