import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

const mockGetWeb3Config = vi.fn();
const mockGetReadContractFn = vi.fn();

vi.mock('@web3/config/index.js', () => ({
  getWeb3Config: mockGetWeb3Config,
}));

vi.mock('@web3/config/logger.js', () => ({
  createDebugLogger: vi.fn(() => vi.fn()),
}));

vi.mock('@web3/services/pricing.js', () => ({
  getReadContractFn: mockGetReadContractFn,
}));

describe('services/ownership.js', () => {
  let fetchOwnedSquares: any;
  let fetchOwnedSquaresForIds: any;
  let clearOwnedSquaresCache: any;

  beforeEach(async () => {
    vi.resetModules();

    mockGetWeb3Config.mockReturnValue({
      activeNetwork: { chainId: 1 },
      contracts: { primary: '0xprimary' },
    });

    const module = await import('@web3/services/ownership.js');
    fetchOwnedSquares = module.fetchOwnedSquares;
    fetchOwnedSquaresForIds = module.fetchOwnedSquaresForIds;
    clearOwnedSquaresCache = module.clearOwnedSquaresCache;

    clearOwnedSquaresCache();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('fetchOwnedSquares', () => {
    it('should throw if address is missing', async () => {
      await expect(fetchOwnedSquares(null, {})).rejects.toThrow('Missing wallet address');
      await expect(fetchOwnedSquares('', {})).rejects.toThrow('Missing wallet address');
    });

    it('should throw if no readContract available', async () => {
      mockGetReadContractFn.mockReturnValue(null);

      await expect(fetchOwnedSquares('0xaddress', {})).rejects.toThrow(
        'no readContract available'
      );
    });

    it('should throw on invalid balance result', async () => {
      const mockRead = vi.fn().mockResolvedValue(-1);
      mockGetReadContractFn.mockReturnValue(mockRead);

      await expect(fetchOwnedSquares('0xaddress', {})).rejects.toThrow('invalid balance result');
    });

    it('should return empty set for zero balance', async () => {
      const mockRead = vi.fn().mockResolvedValue(BigInt(0));
      mockGetReadContractFn.mockReturnValue(mockRead);

      const result = await fetchOwnedSquares('0xaddress', {});

      expect(result).toBeInstanceOf(Set);
      expect(result.size).toBe(0);
    });

    it('should enumerate owned tokens', async () => {
      const mockRead = vi.fn()
        .mockResolvedValueOnce(BigInt(2)) // balanceOf
        .mockResolvedValueOnce(BigInt(42)) // tokenOfOwnerByIndex(0)
        .mockResolvedValueOnce(BigInt(99)); // tokenOfOwnerByIndex(1)
      mockGetReadContractFn.mockReturnValue(mockRead);

      const result = await fetchOwnedSquares('0xaddress', {});

      expect(result).toEqual(new Set([42, 99]));
    });

    it('should call onProgress callback', async () => {
      const mockRead = vi.fn()
        .mockResolvedValueOnce(BigInt(2))
        .mockResolvedValueOnce(BigInt(1))
        .mockResolvedValueOnce(BigInt(2));
      mockGetReadContractFn.mockReturnValue(mockRead);

      const onProgress = vi.fn();
      await fetchOwnedSquares('0xaddress', {}, { onProgress });

      expect(onProgress).toHaveBeenCalledWith({ total: 2, completed: 0 });
      expect(onProgress).toHaveBeenCalledWith({ total: 2, completed: 1 });
      expect(onProgress).toHaveBeenCalledWith({ total: 2, completed: 2 });
    });

    it('should cache results and reuse on second call', async () => {
      const mockRead = vi.fn()
        .mockResolvedValueOnce(BigInt(1))
        .mockResolvedValueOnce(BigInt(42))
        .mockResolvedValueOnce(BigInt(1)); // balance check on second call
      mockGetReadContractFn.mockReturnValue(mockRead);

      const result1 = await fetchOwnedSquares('0xaddress', {});
      expect(result1).toEqual(new Set([42]));
      expect(mockRead).toHaveBeenCalledTimes(2);

      const result2 = await fetchOwnedSquares('0xaddress', {});
      expect(result2).toEqual(new Set([42]));
      expect(mockRead).toHaveBeenCalledTimes(3);
    });

    it('should invalidate cache when balance changes', async () => {
      const mockRead = vi.fn()
        .mockResolvedValueOnce(BigInt(1)) // initial balanceOf
        .mockResolvedValueOnce(BigInt(42)) // tokenOfOwnerByIndex(0)
        .mockResolvedValueOnce(BigInt(2)) // second call balanceOf (changed!)
        .mockResolvedValueOnce(BigInt(2)) // re-enumerate: new balanceOf
        .mockResolvedValueOnce(BigInt(42)) // tokenOfOwnerByIndex(0)
        .mockResolvedValueOnce(BigInt(99)); // tokenOfOwnerByIndex(1)
      mockGetReadContractFn.mockReturnValue(mockRead);

      const result1 = await fetchOwnedSquares('0xaddress', {});
      expect(result1).toEqual(new Set([42]));

      const result2 = await fetchOwnedSquares('0xaddress', {});
      expect(result2).toEqual(new Set([42, 99]));
    });

    it('should use different cache keys for different addresses', async () => {
      const mockRead = vi.fn()
        .mockResolvedValueOnce(BigInt(1))
        .mockResolvedValueOnce(BigInt(1))
        .mockResolvedValueOnce(BigInt(1))
        .mockResolvedValueOnce(BigInt(2));
      mockGetReadContractFn.mockReturnValue(mockRead);

      await fetchOwnedSquares('0xaddress1', {});
      await fetchOwnedSquares('0xaddress2', {});

      expect(mockRead).toHaveBeenCalledTimes(4);
    });

    it('should bypass cache with forceRefresh', async () => {
      const mockRead = vi.fn()
        .mockResolvedValueOnce(BigInt(1))
        .mockResolvedValueOnce(BigInt(1))
        .mockResolvedValueOnce(BigInt(1))
        .mockResolvedValueOnce(BigInt(1));
      mockGetReadContractFn.mockReturnValue(mockRead);

      await fetchOwnedSquares('0xaddress', {});
      await fetchOwnedSquares('0xaddress', {}, { forceRefresh: true });

      expect(mockRead).toHaveBeenCalledTimes(4);
    });
  });

  describe('fetchOwnedSquaresForIds', () => {
    it('should throw if address is missing', async () => {
      await expect(fetchOwnedSquaresForIds(null, [1, 2], {})).rejects.toThrow(
        'Missing wallet address'
      );
    });

    it('should throw if no readContract available', async () => {
      mockGetReadContractFn.mockReturnValue(null);

      await expect(fetchOwnedSquaresForIds('0xaddress', [1], {})).rejects.toThrow(
        'no readContract available'
      );
    });

    it('should filter out invalid square IDs', async () => {
      const mockRead = vi.fn().mockResolvedValue('0xaddress');
      mockGetReadContractFn.mockReturnValue(mockRead);

      await fetchOwnedSquaresForIds('0xaddress', [0, 1, 10000, 10001, -1, 5000], {});

      expect(mockRead).toHaveBeenCalledTimes(3);
    });

    it('should validate square ID range (1-10000)', async () => {
      const mockRead = vi.fn().mockResolvedValue('0xaddress');
      mockGetReadContractFn.mockReturnValue(mockRead);

      const onProgress = vi.fn();
      await fetchOwnedSquaresForIds('0xaddress', [0, 1, 10000, 10001], {}, { onProgress });

      expect(onProgress).toHaveBeenCalledWith({ total: 2, completed: 0 });
    });

    it('should return owned squares matching address', async () => {
      const mockRead = vi.fn()
        .mockResolvedValueOnce('0xaddress')
        .mockResolvedValueOnce('0xother')
        .mockResolvedValueOnce('0xADDRESS');
      mockGetReadContractFn.mockReturnValue(mockRead);

      const result = await fetchOwnedSquaresForIds('0xaddress', [1, 2, 3], {});

      expect(result).toEqual(new Set([1, 3]));
    });

    it('should handle read errors gracefully', async () => {
      const mockRead = vi.fn()
        .mockResolvedValueOnce('0xaddress')
        .mockRejectedValueOnce(new Error('Token does not exist'))
        .mockResolvedValueOnce('0xaddress');
      mockGetReadContractFn.mockReturnValue(mockRead);

      const result = await fetchOwnedSquaresForIds('0xaddress', [1, 2, 3], {});

      expect(result).toEqual(new Set([1, 3]));
    });

    it('should deduplicate input square IDs', async () => {
      const mockRead = vi.fn().mockResolvedValue('0xaddress');
      mockGetReadContractFn.mockReturnValue(mockRead);

      await fetchOwnedSquaresForIds('0xaddress', [1, 1, 1, 2, 2], {});

      expect(mockRead).toHaveBeenCalledTimes(2);
    });
  });

  describe('clearOwnedSquaresCache', () => {
    it('should clear both caches', async () => {
      const mockRead = vi.fn()
        .mockResolvedValueOnce(BigInt(1))
        .mockResolvedValueOnce(BigInt(42))
        .mockResolvedValueOnce(BigInt(1))
        .mockResolvedValueOnce(BigInt(42));
      mockGetReadContractFn.mockReturnValue(mockRead);

      await fetchOwnedSquares('0xaddress', {});
      clearOwnedSquaresCache();
      await fetchOwnedSquares('0xaddress', {});

      expect(mockRead).toHaveBeenCalledTimes(4);
    });
  });
});
