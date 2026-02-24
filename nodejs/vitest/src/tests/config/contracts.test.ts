import { describe, it, expect, beforeEach } from 'vitest';
import { MOCK_CONTRACT_ADDRESSES } from '@fixtures/contracts';

describe('config/contracts.js - resolveContractAddresses()', () => {
  let resolveContractAddresses: any;
  let ChainKey: any;

  beforeEach(async () => {
    const contractsModule = await import('@web3/config/contracts.js');
    const networksModule = await import('@web3/config/networks.js');

    resolveContractAddresses = contractsModule.resolveContractAddresses;
    ChainKey = networksModule.ChainKey;
  });

  describe('mainnet', () => {
    it('should resolve mainnet addresses when provided', () => {
      const addresses = {
        mainnet: MOCK_CONTRACT_ADDRESSES.mainnet
      };

      const result = resolveContractAddresses(ChainKey.MAINNET, addresses);

      expect(result).toEqual({
        primary: MOCK_CONTRACT_ADDRESSES.mainnet.primary,
        underlay: MOCK_CONTRACT_ADDRESSES.mainnet.underlay
      });
    });

    it('should use mainnet fallback addresses when not provided', () => {
      const result = resolveContractAddresses(ChainKey.MAINNET, {});

      expect(result).toHaveProperty('primary');
      expect(result).toHaveProperty('underlay');
      expect(result.primary).toMatch(/^0x[a-fA-F0-9]{40}$/);
      expect(result.underlay).toMatch(/^0x[a-fA-F0-9]{40}$/);
    });

    it('should use fallback for missing primary address', () => {
      const addresses = {
        mainnet: { underlay: MOCK_CONTRACT_ADDRESSES.mainnet.underlay }
      };

      const result = resolveContractAddresses(ChainKey.MAINNET, addresses);

      expect(result.primary).toMatch(/^0x[a-fA-F0-9]{40}$/);
      expect(result.underlay).toBe(MOCK_CONTRACT_ADDRESSES.mainnet.underlay);
    });

    it('should use fallback for missing underlay address', () => {
      const addresses = {
        mainnet: { primary: MOCK_CONTRACT_ADDRESSES.mainnet.primary }
      };

      const result = resolveContractAddresses(ChainKey.MAINNET, addresses);

      expect(result.primary).toBe(MOCK_CONTRACT_ADDRESSES.mainnet.primary);
      expect(result.underlay).toMatch(/^0x[a-fA-F0-9]{40}$/);
    });
  });

  describe('sepolia', () => {
    it('should resolve sepolia addresses when provided', () => {
      const addresses = {
        sepolia: MOCK_CONTRACT_ADDRESSES.sepolia
      };

      const result = resolveContractAddresses(ChainKey.SEPOLIA, addresses);

      expect(result).toEqual({
        primary: MOCK_CONTRACT_ADDRESSES.sepolia.primary,
        underlay: MOCK_CONTRACT_ADDRESSES.sepolia.underlay
      });
    });

    it('should throw error when sepolia addresses not provided', () => {
      expect(() => {
        resolveContractAddresses(ChainKey.SEPOLIA, {});
      }).toThrow();
    });

    it('should throw error with message containing "sepolia"', () => {
      expect(() => {
        resolveContractAddresses(ChainKey.SEPOLIA, {});
      }).toThrow(/sepolia/i);
    });

    it('should throw error when only primary provided', () => {
      const addresses = {
        sepolia: { primary: MOCK_CONTRACT_ADDRESSES.sepolia.primary }
      };

      expect(() => {
        resolveContractAddresses(ChainKey.SEPOLIA, addresses);
      }).toThrow();
    });

    it('should throw error when only underlay provided', () => {
      const addresses = {
        sepolia: { underlay: MOCK_CONTRACT_ADDRESSES.sepolia.underlay }
      };

      expect(() => {
        resolveContractAddresses(ChainKey.SEPOLIA, addresses);
      }).toThrow();
    });
  });

  describe('sunet', () => {
    it('should resolve sunet addresses when provided', () => {
      const addresses = {
        sunet: MOCK_CONTRACT_ADDRESSES.sunet
      };

      const result = resolveContractAddresses(ChainKey.SUNET, addresses);

      expect(result).toEqual({
        primary: MOCK_CONTRACT_ADDRESSES.sunet.primary,
        underlay: MOCK_CONTRACT_ADDRESSES.sunet.underlay
      });
    });

    it('should throw error when sunet addresses not provided', () => {
      expect(() => {
        resolveContractAddresses(ChainKey.SUNET, {});
      }).toThrow();
    });

    it('should throw error with message containing "sunet"', () => {
      expect(() => {
        resolveContractAddresses(ChainKey.SUNET, {});
      }).toThrow(/sunet/i);
    });
  });

  describe('edge cases', () => {
    it('should handle null addresses object', () => {
      const result = resolveContractAddresses(ChainKey.MAINNET, null);

      expect(result).toHaveProperty('primary');
      expect(result).toHaveProperty('underlay');
    });

    it('should handle undefined addresses object', () => {
      const result = resolveContractAddresses(ChainKey.MAINNET, undefined);

      expect(result).toHaveProperty('primary');
      expect(result).toHaveProperty('underlay');
    });

    it('should handle addresses object with wrong structure for mainnet', () => {
      const addresses = {
        mainnet: {}
      };

      const result = resolveContractAddresses(ChainKey.MAINNET, addresses);

      expect(result).toHaveProperty('primary');
      expect(result).toHaveProperty('underlay');
    });
  });
});
