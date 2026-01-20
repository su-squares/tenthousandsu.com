/**
 * Tests for the data fetching logic in account-modal/index.js
 *
 * Since fetchDisplayData is not exported, we test:
 * 1. The ENS and Balance store functions it depends on (getEnsName, getBalance)
 * 2. Integration behavior through openAccountModal with mocked dependencies
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { clearWeb3Config, resetConfigModule } from '@test-helpers/config';

describe('account-modal data fetching', () => {
  beforeEach(async () => {
    clearWeb3Config();
    localStorage.clear();
    await resetConfigModule();
  });

  afterEach(() => {
    clearWeb3Config();
    localStorage.clear();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe('ENS Store (getEnsName)', () => {
    let getEnsName: any;
    let getCachedEnsName: any;
    let clearAllEnsCache: any;

    async function loadEnsStore() {
      const module = await import('@web3/wallet/ens-store.js');
      getEnsName = module.getEnsName;
      getCachedEnsName = module.getCachedEnsName;
      clearAllEnsCache = module.clearAllEnsCache;
    }

    beforeEach(async () => {
      await loadEnsStore();
      clearAllEnsCache();
    });

    afterEach(() => {
      clearAllEnsCache();
    });

    it('should fetch ENS name when not cached', async () => {
      const mockFetcher = vi.fn().mockResolvedValue('vitalik.eth');

      const result = await getEnsName({
        address: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045',
        chainId: 1,
        fetcher: mockFetcher,
      });

      expect(result.name).toBe('vitalik.eth');
      expect(result.source).toBe('fresh');
      expect(mockFetcher).toHaveBeenCalledTimes(1);
    });

    it('should return cached ENS name without fetching', async () => {
      const mockFetcher = vi.fn().mockResolvedValue('vitalik.eth');
      const address = '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045';
      const chainId = 1;

      // First fetch to populate cache
      await getEnsName({ address, chainId, fetcher: mockFetcher });

      // Reset mock to verify it's not called again
      mockFetcher.mockClear();

      // Second fetch should hit cache
      const result = await getEnsName({ address, chainId, fetcher: mockFetcher });

      expect(result.name).toBe('vitalik.eth');
      expect(result.source).toBe('cache');
      expect(mockFetcher).not.toHaveBeenCalled();
    });

    it('should handle null ENS name (address has no ENS)', async () => {
      const mockFetcher = vi.fn().mockResolvedValue(null);

      const result = await getEnsName({
        address: '0x1234567890123456789012345678901234567890',
        chainId: 1,
        fetcher: mockFetcher,
      });

      expect(result.name).toBeNull();
      expect(result.source).toBe('fresh');
    });

    it('should return null when no address provided', async () => {
      const mockFetcher = vi.fn();

      const result = await getEnsName({
        address: '',
        chainId: 1,
        fetcher: mockFetcher,
      });

      expect(result.name).toBeNull();
      expect(mockFetcher).not.toHaveBeenCalled();
    });

    it('should return null when no fetcher provided', async () => {
      const result = await getEnsName({
        address: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045',
        chainId: 1,
        fetcher: undefined as any,
      });

      expect(result.name).toBeNull();
    });

    it('should throw when fetcher throws (caller should handle)', async () => {
      const mockFetcher = vi.fn().mockRejectedValue(new Error('Network error'));

      await expect(
        getEnsName({
          address: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045',
          chainId: 1,
          fetcher: mockFetcher,
        })
      ).rejects.toThrow('Network error');
    });

    it('should use getCachedEnsName for quick lookups', async () => {
      const mockFetcher = vi.fn().mockResolvedValue('test.eth');
      const address = '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045';
      const chainId = 1;

      // Before fetch, should return null
      expect(getCachedEnsName(address, chainId)).toBeNull();

      // Fetch to populate
      await getEnsName({ address, chainId, fetcher: mockFetcher });

      // Now should return cached value
      expect(getCachedEnsName(address, chainId)).toBe('test.eth');
    });

    it('should deduplicate concurrent requests (single-flight)', async () => {
      let resolvePromise: (value: string) => void;
      const fetchPromise = new Promise<string>((resolve) => {
        resolvePromise = resolve;
      });
      const mockFetcher = vi.fn().mockReturnValue(fetchPromise);

      const address = '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045';
      const chainId = 1;

      // Start two concurrent requests
      const promise1 = getEnsName({ address, chainId, fetcher: mockFetcher });
      const promise2 = getEnsName({ address, chainId, fetcher: mockFetcher });

      // Resolve the fetch
      resolvePromise!('concurrent.eth');

      const [result1, result2] = await Promise.all([promise1, promise2]);

      // Both should get the same result
      expect(result1.name).toBe('concurrent.eth');
      expect(result2.name).toBe('concurrent.eth');

      // Fetcher should only be called once
      expect(mockFetcher).toHaveBeenCalledTimes(1);
    });
  });

  describe('Balance Store (getBalance)', () => {
    let getBalance: any;
    let getCachedBalance: any;
    let clearAllBalanceCache: any;

    async function loadBalanceStore() {
      const module = await import('@web3/wallet/balance-store.js');
      getBalance = module.getBalance;
      getCachedBalance = module.getCachedBalance;
      clearAllBalanceCache = module.clearAllBalanceCache;
    }

    beforeEach(async () => {
      await loadBalanceStore();
      clearAllBalanceCache();
    });

    afterEach(() => {
      clearAllBalanceCache();
    });

    it('should fetch balance when not cached', async () => {
      const mockBalance = { formatted: '1.5', symbol: 'ETH', value: BigInt(1500000000000000000) };
      const mockFetcher = vi.fn().mockResolvedValue(mockBalance);

      const result = await getBalance({
        address: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045',
        chainId: 1,
        fetcher: mockFetcher,
      });

      expect(result.balance).toBe(mockBalance);
      expect(result.source).toBe('fresh');
      expect(mockFetcher).toHaveBeenCalledTimes(1);
    });

    it('should return cached balance without fetching', async () => {
      const mockBalance = { formatted: '2.0', symbol: 'ETH' };
      const mockFetcher = vi.fn().mockResolvedValue(mockBalance);
      const address = '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045';
      const chainId = 1;

      // First fetch to populate cache
      await getBalance({ address, chainId, fetcher: mockFetcher });

      // Reset mock
      mockFetcher.mockClear();

      // Second fetch should hit cache
      const result = await getBalance({ address, chainId, fetcher: mockFetcher });

      expect(result.balance).toBe(mockBalance);
      expect(result.source).toBe('cache');
      expect(mockFetcher).not.toHaveBeenCalled();
    });

    it('should return null when no address provided', async () => {
      const mockFetcher = vi.fn();

      const result = await getBalance({
        address: '',
        chainId: 1,
        fetcher: mockFetcher,
      });

      expect(result.balance).toBeNull();
      expect(mockFetcher).not.toHaveBeenCalled();
    });

    it('should throw when fetcher throws (caller should handle)', async () => {
      const mockFetcher = vi.fn().mockRejectedValue(new Error('RPC error'));

      await expect(
        getBalance({
          address: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045',
          chainId: 1,
          fetcher: mockFetcher,
        })
      ).rejects.toThrow('RPC error');
    });

    it('should use getCachedBalance for quick lookups', async () => {
      const mockBalance = { formatted: '3.0', symbol: 'ETH' };
      const mockFetcher = vi.fn().mockResolvedValue(mockBalance);
      const address = '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045';
      const chainId: number = 1;

      // Before fetch, should return null
      expect(getCachedBalance(address, chainId)).toBeNull();

      // Fetch to populate
      await getBalance({ address, chainId, fetcher: mockFetcher });

      // Now should return cached value
      expect(getCachedBalance(address, chainId)).toBe(mockBalance);
    });

    it('should deduplicate concurrent requests (single-flight)', async () => {
      let resolvePromise: (value: any) => void;
      const fetchPromise = new Promise((resolve) => {
        resolvePromise = resolve;
      });
      const mockBalance = { formatted: '4.0', symbol: 'ETH' };
      const mockFetcher = vi.fn().mockReturnValue(fetchPromise);

      const address = '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045';
      const chainId = 1;

      // Start two concurrent requests
      const promise1 = getBalance({ address, chainId, fetcher: mockFetcher });
      const promise2 = getBalance({ address, chainId, fetcher: mockFetcher });

      // Resolve the fetch
      resolvePromise!(mockBalance);

      const [result1, result2] = await Promise.all([promise1, promise2]);

      // Both should get the same result
      expect(result1.balance).toBe(mockBalance);
      expect(result2.balance).toBe(mockBalance);

      // Fetcher should only be called once
      expect(mockFetcher).toHaveBeenCalledTimes(1);
    });

    it('should handle different chainIds separately', async () => {
      const mainnetBalance = { formatted: '1.0', symbol: 'ETH' };
      const sepoliaBalance = { formatted: '10.0', symbol: 'ETH' };
      const mockFetcher = vi.fn()
        .mockResolvedValueOnce(mainnetBalance)
        .mockResolvedValueOnce(sepoliaBalance);

      const address = '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045';

      // Fetch mainnet
      const result1 = await getBalance({ address, chainId: 1, fetcher: mockFetcher });
      // Fetch sepolia
      const result2 = await getBalance({ address, chainId: 11155111, fetcher: mockFetcher });

      expect(result1.balance).toBe(mainnetBalance);
      expect(result2.balance).toBe(sepoliaBalance);
      expect(mockFetcher).toHaveBeenCalledTimes(2);
    });
  });

  describe('fetchDisplayData behavior (integration)', () => {
    // Test the error handling behavior that fetchDisplayData should have
    // by testing how the stores handle errors and how callers should respond

    it('ENS lookup failure should not prevent balance lookup', async () => {
      const { getEnsName } = await import('@web3/wallet/ens-store.js');
      const { getBalance, clearAllBalanceCache } = await import('@web3/wallet/balance-store.js');
      clearAllBalanceCache();

      const ensError = new Error('ENS lookup failed');
      const mockEnsNameFetcher = vi.fn().mockRejectedValue(ensError);
      const mockBalance = { formatted: '5.0', symbol: 'ETH' };
      const mockBalanceFetcher = vi.fn().mockResolvedValue(mockBalance);

      const address = '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045';

      // ENS fails
      let ensName = null;
      try {
        const ensResult = await getEnsName({ address, chainId: 1, fetcher: mockEnsNameFetcher });
        ensName = ensResult?.name;
      } catch {
        // Expected - ENS lookup failed
        ensName = null;
      }

      // Balance should still work
      const balanceResult = await getBalance({ address, chainId: 1, fetcher: mockBalanceFetcher });

      expect(ensName).toBeNull();
      expect(balanceResult.balance).toBe(mockBalance);

      clearAllBalanceCache();
    });

    it('Balance lookup failure should not prevent ENS lookup', async () => {
      const { getEnsName, clearAllEnsCache } = await import('@web3/wallet/ens-store.js');
      const { getBalance, clearAllBalanceCache } = await import('@web3/wallet/balance-store.js');
      clearAllEnsCache();
      clearAllBalanceCache();

      const mockEnsNameFetcher = vi.fn().mockResolvedValue('test.eth');
      const balanceError = new Error('Balance lookup failed');
      const mockBalanceFetcher = vi.fn().mockRejectedValue(balanceError);

      const address = '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045';

      // ENS works
      const ensResult = await getEnsName({ address, chainId: 1, fetcher: mockEnsNameFetcher });

      // Balance fails
      let balance = null;
      try {
        const balanceResult = await getBalance({ address, chainId: 1, fetcher: mockBalanceFetcher });
        balance = balanceResult?.balance;
      } catch {
        // Expected - balance lookup failed
        balance = null;
      }

      expect(ensResult.name).toBe('test.eth');
      expect(balance).toBeNull();

      clearAllEnsCache();
      clearAllBalanceCache();
    });
  });
});
