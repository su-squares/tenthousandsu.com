import { describe, it, expect } from 'vitest';

describe('client/wagmi.js', () => {
  let truncateAddress: any;
  let MAINNET_CHAIN_ID: any;
  let SEPOLIA_CHAIN_ID: any;

  beforeAll(async () => {
    const wagmiModule = await import('@web3/client/wagmi.js');
    truncateAddress = wagmiModule.truncateAddress;
    MAINNET_CHAIN_ID = wagmiModule.MAINNET_CHAIN_ID;
    SEPOLIA_CHAIN_ID = wagmiModule.SEPOLIA_CHAIN_ID;
  });

  describe('constants', () => {
    it('should export MAINNET_CHAIN_ID', () => {
      expect(MAINNET_CHAIN_ID).toBe(1);
    });

    it('should export SEPOLIA_CHAIN_ID', () => {
      expect(SEPOLIA_CHAIN_ID).toBe(11155111);
    });
  });

  describe('truncateAddress()', () => {
    it('should truncate long address', () => {
      const address = '0x1234567890123456789012345678901234567890';
      const result = truncateAddress(address);

      expect(result).toContain('0x1234');
      expect(result).toContain('7890');
      expect(result).toContain('…');
      expect(result.length).toBeLessThan(address.length);
    });

    it('should return empty string for null', () => {
      expect(truncateAddress(null)).toBe('');
    });

    it('should return empty string for undefined', () => {
      expect(truncateAddress(undefined)).toBe('');
    });

    it('should return empty string for empty string', () => {
      expect(truncateAddress('')).toBe('');
    });

    it('should handle short addresses gracefully', () => {
      const result = truncateAddress('0x123');
      expect(result).toBeDefined();
    });

    it('should format address with ellipsis in middle', () => {
      const address = '0xabcdefABCDEF123456789012345678901234567890';
      const result = truncateAddress(address);

      expect(result).toMatch(/^0x[a-fA-F0-9]+…[a-fA-F0-9]+$/);
    });
  });

  describe('module exports', () => {
    it('should export loadWagmiClient function', async () => {
      const wagmiModule = await import('@web3/client/wagmi.js');

      expect(wagmiModule.loadWagmiClient).toBeDefined();
      expect(typeof wagmiModule.loadWagmiClient).toBe('function');
    });

    it('should export truncateAddress function', async () => {
      const wagmiModule = await import('@web3/client/wagmi.js');

      expect(wagmiModule.truncateAddress).toBeDefined();
      expect(typeof wagmiModule.truncateAddress).toBe('function');
    });
  });
});
