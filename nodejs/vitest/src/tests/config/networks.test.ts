
describe('config/networks.js - normalizeChainKey()', () => {
  let normalizeChainKey: any;
  let DEFAULT_CHAIN: any;

  beforeEach(async () => {
    const module = await import('@web3/config/networks.js');
    normalizeChainKey = module.normalizeChainKey;
    DEFAULT_CHAIN = module.DEFAULT_CHAIN;
  });

  describe('valid chain keys', () => {
    it('should return mainnet for "mainnet"', () => {
      expect(normalizeChainKey('mainnet')).toBe('mainnet');
    });

    it('should return mainnet for "MAINNET" (uppercase)', () => {
      expect(normalizeChainKey('MAINNET')).toBe('mainnet');
    });

    it('should return mainnet for "Mainnet" (mixed case)', () => {
      expect(normalizeChainKey('Mainnet')).toBe('mainnet');
    });

    it('should return sepolia for "sepolia"', () => {
      expect(normalizeChainKey('sepolia')).toBe('sepolia');
    });

    it('should return sepolia for "SEPOLIA" (uppercase)', () => {
      expect(normalizeChainKey('SEPOLIA')).toBe('sepolia');
    });

    it('should return sunet for "sunet"', () => {
      expect(normalizeChainKey('sunet')).toBe('sunet');
    });

    it('should return sunet for "SUNET" (uppercase)', () => {
      expect(normalizeChainKey('SUNET')).toBe('sunet');
    });
  });

  describe('invalid/missing values', () => {
    it('should return DEFAULT_CHAIN for null', () => {
      expect(normalizeChainKey(null)).toBe(DEFAULT_CHAIN);
    });

    it('should return DEFAULT_CHAIN for undefined', () => {
      expect(normalizeChainKey(undefined)).toBe(DEFAULT_CHAIN);
    });

    it('should return DEFAULT_CHAIN for empty string', () => {
      expect(normalizeChainKey('')).toBe(DEFAULT_CHAIN);
    });

    it('should return DEFAULT_CHAIN for invalid chain name', () => {
      expect(normalizeChainKey('polygon')).toBe(DEFAULT_CHAIN);
    });

    it('should return DEFAULT_CHAIN for invalid chain name "invalid"', () => {
      expect(normalizeChainKey('invalid')).toBe(DEFAULT_CHAIN);
    });

    it('should return DEFAULT_CHAIN for number input', () => {
      expect(normalizeChainKey(123 as any)).toBe(DEFAULT_CHAIN);
    });

    it('should return DEFAULT_CHAIN for object input', () => {
      expect(normalizeChainKey({} as any)).toBe(DEFAULT_CHAIN);
    });

    it('should return DEFAULT_CHAIN for array input', () => {
      expect(normalizeChainKey([] as any)).toBe(DEFAULT_CHAIN);
    });
  });

  describe('whitespace handling', () => {
    it('should handle leading whitespace', () => {
      expect(normalizeChainKey('  mainnet')).toBe(DEFAULT_CHAIN);
    });

    it('should handle trailing whitespace', () => {
      expect(normalizeChainKey('mainnet  ')).toBe(DEFAULT_CHAIN);
    });

    it('should handle whitespace in the middle', () => {
      expect(normalizeChainKey('main net')).toBe(DEFAULT_CHAIN);
    });
  });
});
