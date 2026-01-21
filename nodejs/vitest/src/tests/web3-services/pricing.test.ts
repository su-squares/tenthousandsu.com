import { vi } from 'vitest';

const mockGetWeb3Config = vi.fn();

vi.mock('@web3/config/index.js', () => ({
  getWeb3Config: mockGetWeb3Config,
}));

vi.mock('@web3/config/logger.js', () => ({
  createDebugLogger: vi.fn(() => vi.fn()),
}));

describe('services/pricing.js', () => {
  let getReadContractFn: any;
  let getMintPriceWei: any;
  let getPersonalizePriceWei: any;

  beforeEach(async () => {
    vi.resetModules();

    mockGetWeb3Config.mockReturnValue({
      activeNetwork: { chainId: 1 },
      contracts: {
        primary: '0x1234567890123456789012345678901234567890',
        underlay: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
      },
    });

    const module = await import('@web3/services/pricing.js');
    getReadContractFn = module.getReadContractFn;
    getMintPriceWei = module.getMintPriceWei;
    getPersonalizePriceWei = module.getPersonalizePriceWei;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('getReadContractFn', () => {
    it('should return wagmi.readContract if available', () => {
      const mockReadContract = vi.fn();
      const wagmi = { readContract: mockReadContract };

      const result = getReadContractFn(wagmi);

      expect(result).toBe(mockReadContract);
    });

    it('should fall back to publicClient.readContract', () => {
      const mockReadContract = vi.fn();
      const wagmi = {
        config: {
          publicClient: {
            readContract: mockReadContract,
          },
        },
      };

      const result = getReadContractFn(wagmi);

      expect(result).not.toBeNull();
      result({ test: 'args' });
      expect(mockReadContract).toHaveBeenCalledWith({ test: 'args' });
    });

    it('should return null if no readContract available', () => {
      expect(getReadContractFn(null)).toBeNull();
      expect(getReadContractFn({})).toBeNull();
      expect(getReadContractFn({ config: {} })).toBeNull();
    });
  });

  describe('getMintPriceWei', () => {
    it('should throw if no readContract available', async () => {
      await expect(getMintPriceWei({})).rejects.toThrow('no readContract available');
    });

    it('should throw if contract address not configured', async () => {
      mockGetWeb3Config.mockReturnValue({
        activeNetwork: { chainId: 1 },
        contracts: { primary: null },
      });

      const wagmi = { readContract: vi.fn() };
      await expect(getMintPriceWei(wagmi)).rejects.toThrow('contract address not configured');
    });

    it('should read price from contract and cache it', async () => {
      const mockReadContract = vi.fn().mockResolvedValue(BigInt(1000000000000000));
      const wagmi = { readContract: mockReadContract };

      const price1 = await getMintPriceWei(wagmi);
      expect(price1).toBe(BigInt(1000000000000000));
      expect(mockReadContract).toHaveBeenCalledTimes(1);

      const price2 = await getMintPriceWei(wagmi);
      expect(price2).toBe(BigInt(1000000000000000));
      expect(mockReadContract).toHaveBeenCalledTimes(1);
    });

    it('should throw if contract returns non-bigint', async () => {
      const mockReadContract = vi.fn().mockResolvedValue('not a bigint');
      const wagmi = { readContract: mockReadContract };

      await expect(getMintPriceWei(wagmi)).rejects.toThrow('invalid price type');
    });
  });

  describe('getPersonalizePriceWei', () => {
    it('should throw if no readContract available', async () => {
      await expect(getPersonalizePriceWei({})).rejects.toThrow('no readContract available');
    });

    it('should read personalization price from underlay contract', async () => {
      const mockReadContract = vi.fn().mockResolvedValue(BigInt(500000000000000));
      const wagmi = { readContract: mockReadContract };

      const price = await getPersonalizePriceWei(wagmi);

      expect(price).toBe(BigInt(500000000000000));
      expect(mockReadContract).toHaveBeenCalledWith(
        expect.objectContaining({
          address: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
          functionName: 'pricePerSquare',
        })
      );
    });
  });
});
