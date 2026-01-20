import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

const mockGetWeb3Config = vi.fn();
const mockGetPersonalizePriceWei = vi.fn();

vi.mock('@web3/config/index.js', () => ({
  getWeb3Config: mockGetWeb3Config,
}));

vi.mock('@web3/config/logger.js', () => ({
  createDebugLogger: vi.fn(() => vi.fn()),
}));

vi.mock('@web3/services/pricing.js', () => ({
  getPersonalizePriceWei: mockGetPersonalizePriceWei,
}));

describe('services/underlay-batch.js', () => {
  let personalizeUnderlayBatch: any;

  beforeEach(async () => {
    vi.resetModules();

    mockGetWeb3Config.mockReturnValue({
      contracts: { underlay: '0xunderlay' },
    });

    mockGetPersonalizePriceWei.mockResolvedValue(BigInt(100000000000000)); // 0.0001 ETH

    const module = await import('@web3/services/underlay-batch.js');
    personalizeUnderlayBatch = module.personalizeUnderlayBatch;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('personalizeUnderlayBatch', () => {
    it('should calculate total value as count * pricePerSquare', async () => {
      const mockWriteContract = vi.fn().mockResolvedValue({ hash: '0xabc' });
      const wagmi = { writeContract: mockWriteContract };

      const personalizations = [
        { squareId: 1, rgbData: '0x000000', title: 'Test 1', href: 'https://test1.com' },
        { squareId: 2, rgbData: '0x000000', title: 'Test 2', href: 'https://test2.com' },
        { squareId: 3, rgbData: '0x000000', title: 'Test 3', href: 'https://test3.com' },
      ];

      await personalizeUnderlayBatch(personalizations, wagmi);

      expect(mockWriteContract).toHaveBeenCalledWith(
        expect.objectContaining({
          value: BigInt(300000000000000), // 3 * 0.0001 ETH
        })
      );
    });

    it('should pass personalizations array to contract', async () => {
      const mockWriteContract = vi.fn().mockResolvedValue({ hash: '0xabc' });
      const wagmi = { writeContract: mockWriteContract };

      const personalizations = [
        { squareId: 42, rgbData: '0xffffff', title: 'My Square', href: 'https://example.com' },
      ];

      await personalizeUnderlayBatch(personalizations, wagmi);

      expect(mockWriteContract).toHaveBeenCalledWith(
        expect.objectContaining({
          address: '0xunderlay',
          functionName: 'personalizeSquareUnderlayBatch',
          args: [personalizations],
        })
      );
    });

    it('should handle single personalization', async () => {
      const mockWriteContract = vi.fn().mockResolvedValue({ hash: '0xabc' });
      const wagmi = { writeContract: mockWriteContract };

      const personalizations = [
        { squareId: 1, rgbData: '0x000000', title: 'Test', href: 'https://test.com' },
      ];

      await personalizeUnderlayBatch(personalizations, wagmi);

      expect(mockWriteContract).toHaveBeenCalledWith(
        expect.objectContaining({
          value: BigInt(100000000000000), // 1 * price
        })
      );
    });

    it('should handle large batch correctly with BigInt math', async () => {
      const mockWriteContract = vi.fn().mockResolvedValue({ hash: '0xabc' });
      const wagmi = { writeContract: mockWriteContract };

      // 100 personalizations
      const personalizations = Array.from({ length: 100 }, (_, i) => ({
        squareId: i + 1,
        rgbData: '0x000000' as const,
        title: `Square ${i + 1}`,
        href: `https://example.com/${i + 1}`,
      }));

      await personalizeUnderlayBatch(personalizations, wagmi);

      expect(mockWriteContract).toHaveBeenCalledWith(
        expect.objectContaining({
          value: BigInt(10000000000000000), // 100 * 0.0001 ETH = 0.01 ETH
        })
      );
    });

    it('should return transaction result from writeContract', async () => {
      const expectedResult = { hash: '0xdef456' };
      const mockWriteContract = vi.fn().mockResolvedValue(expectedResult);
      const wagmi = { writeContract: mockWriteContract };

      const result = await personalizeUnderlayBatch(
        [{ squareId: 1, rgbData: '0x000000', title: 'Test', href: 'https://test.com' }],
        wagmi
      );

      expect(result).toEqual(expectedResult);
    });

    it('should fetch price before calculating value', async () => {
      const callOrder: string[] = [];
      mockGetPersonalizePriceWei.mockImplementation(async () => {
        callOrder.push('getPrice');
        return BigInt(100000000000000);
      });
      const mockWriteContract = vi.fn().mockImplementation(async () => {
        callOrder.push('writeContract');
        return { hash: '0xabc' };
      });
      const wagmi = { writeContract: mockWriteContract };

      await personalizeUnderlayBatch(
        [{ squareId: 1, rgbData: '0x000000', title: 'Test', href: 'https://test.com' }],
        wagmi
      );

      expect(mockGetPersonalizePriceWei).toHaveBeenCalledWith(wagmi);
      expect(callOrder).toEqual(['getPrice', 'writeContract']);
    });
  });
});
