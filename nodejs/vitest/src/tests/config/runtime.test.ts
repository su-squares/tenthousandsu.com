import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mockWeb3Config, clearWeb3Config, mockSiteBaseUrl, clearSiteBaseUrl, resetConfigModule } from '@test-helpers/config';

describe('config/runtime.js - getRuntimeFlags()', () => {
  let getRuntimeFlags: any;
  let ChainKey: any;
  let DEFAULT_CHAIN: any;

  beforeEach(async () => {
    clearWeb3Config();
    clearSiteBaseUrl();
    await resetConfigModule();

    const module = await import('@web3/config/runtime.js');
    const networksModule = await import('@web3/config/networks.js');

    getRuntimeFlags = module.getRuntimeFlags;
    ChainKey = networksModule.ChainKey;
    DEFAULT_CHAIN = networksModule.DEFAULT_CHAIN;
  });

  afterEach(() => {
    clearWeb3Config();
    clearSiteBaseUrl();
  });

  describe('basic parsing', () => {
    it('should return defaults when window.suWeb3 is undefined', () => {
      const result = getRuntimeFlags();

      expect(result.chain).toBe(DEFAULT_CHAIN);
      expect(result.debug).toBe(false);
      expect(result.walletConnectProjectId).toBeTruthy();
    });

    it('should parse chain from window.suWeb3.chain', () => {
      mockWeb3Config({ chain: 'sepolia' });

      const result = getRuntimeFlags();

      expect(result.chain).toBe('sepolia');
    });

    it('should parse chain from window.suWeb3.CHAIN (uppercase)', () => {
      mockWeb3Config({ CHAIN: 'SUNET' });

      const result = getRuntimeFlags();

      expect(result.chain).toBe('sunet');
    });

    it('should prefer camelCase over UPPERCASE_SNAKE_CASE', () => {
      mockWeb3Config({ chain: 'sepolia', CHAIN: 'mainnet' });

      const result = getRuntimeFlags();

      expect(result.chain).toBe('sepolia');
    });
  });

  describe('boolean parsing', () => {
    it('should parse debug as boolean true from boolean', () => {
      mockWeb3Config({ debug: true });

      const result = getRuntimeFlags();

      expect(result.debug).toBe(true);
    });

    it('should parse debug as boolean true from string "true"', () => {
      mockWeb3Config({ debug: 'true' });

      const result = getRuntimeFlags();

      expect(result.debug).toBe(true);
    });

    it('should parse debug as boolean true from string "TRUE"', () => {
      mockWeb3Config({ debug: 'TRUE' });

      const result = getRuntimeFlags();

      expect(result.debug).toBe(true);
    });

    it('should parse debug as boolean true from string "1"', () => {
      mockWeb3Config({ debug: '1' });

      const result = getRuntimeFlags();

      expect(result.debug).toBe(true);
    });

    it('should parse debug as boolean true from string "yes"', () => {
      mockWeb3Config({ debug: 'yes' });

      const result = getRuntimeFlags();

      expect(result.debug).toBe(true);
    });

    it('should parse debug as boolean true from string "YES"', () => {
      mockWeb3Config({ debug: 'YES' });

      const result = getRuntimeFlags();

      expect(result.debug).toBe(true);
    });

    it('should parse debug as boolean true from string "on"', () => {
      mockWeb3Config({ debug: 'on' });

      const result = getRuntimeFlags();

      expect(result.debug).toBe(true);
    });

    it('should parse debug as boolean false from boolean', () => {
      mockWeb3Config({ debug: false });

      const result = getRuntimeFlags();

      expect(result.debug).toBe(false);
    });

    it('should parse debug as boolean false from string "false"', () => {
      mockWeb3Config({ debug: 'false' });

      const result = getRuntimeFlags();

      expect(result.debug).toBe(false);
    });

    it('should parse debug as boolean false from string "0"', () => {
      mockWeb3Config({ debug: '0' });

      const result = getRuntimeFlags();

      expect(result.debug).toBe(false);
    });

    it('should parse debug as boolean false from string "no"', () => {
      mockWeb3Config({ debug: 'no' });

      const result = getRuntimeFlags();

      expect(result.debug).toBe(false);
    });

    it('should default to false for invalid boolean values', () => {
      mockWeb3Config({ debug: 'maybe' });

      const result = getRuntimeFlags();

      expect(result.debug).toBe(false);
    });
  });

  describe('number parsing', () => {
    it('should parse sunetChainId as integer from number', () => {
      mockWeb3Config({ sunetChainId: 12345 });

      const result = getRuntimeFlags();

      expect(result.overrides.sunetChainId).toBe(12345);
    });

    it('should parse sunetChainId as integer from string', () => {
      mockWeb3Config({ sunetChainId: '12345' });

      const result = getRuntimeFlags();

      expect(result.overrides.sunetChainId).toBe(12345);
    });

    it('should use default for invalid sunetChainId', () => {
      mockWeb3Config({ sunetChainId: 'invalid' });

      const result = getRuntimeFlags();

      expect(result.overrides.sunetChainId).toBeTruthy();
      expect(typeof result.overrides.sunetChainId).toBe('number');
    });

    it('should parse mintPriceEth as float from number', () => {
      mockWeb3Config({ pricing: { mintPriceEth: 0.5 } });

      const result = getRuntimeFlags();

      expect(result.pricing.mintPriceEth).toBe(0.5);
    });

    it('should parse mintPriceEth as float from string', () => {
      mockWeb3Config({ pricing: { mintPriceEth: '0.5' } });

      const result = getRuntimeFlags();

      expect(result.pricing.mintPriceEth).toBe(0.5);
    });

    it('should parse personalizePriceEth as float from number', () => {
      mockWeb3Config({ pricing: { personalizePriceEth: 0.001 } });

      const result = getRuntimeFlags();

      expect(result.pricing.personalizePriceEth).toBe(0.001);
    });

    it('should use default pricing when not provided', () => {
      mockWeb3Config({});

      const result = getRuntimeFlags();

      expect(result.pricing.mintPriceEth).toBeTruthy();
      expect(result.pricing.personalizePriceEth).toBeTruthy();
    });
  });

  describe('contract addresses', () => {
    it('should parse mainnet addresses from camelCase', () => {
      mockWeb3Config({
        mainnetPrimaryAddress: '0x1111111111111111111111111111111111111111',
        mainnetUnderlayAddress: '0x2222222222222222222222222222222222222222'
      });

      const result = getRuntimeFlags();

      expect(result.addresses.mainnet.primary).toBe('0x1111111111111111111111111111111111111111');
      expect(result.addresses.mainnet.underlay).toBe('0x2222222222222222222222222222222222222222');
    });

    it('should parse addresses from UPPERCASE_SNAKE_CASE', () => {
      mockWeb3Config({
        MAINNET_PRIMARY_ADDRESS: '0x1111111111111111111111111111111111111111',
        SEPOLIA_UNDERLAY_ADDRESS: '0x3333333333333333333333333333333333333333'
      });

      const result = getRuntimeFlags();

      expect(result.addresses.mainnet.primary).toBe('0x1111111111111111111111111111111111111111');
      expect(result.addresses.sepolia.underlay).toBe('0x3333333333333333333333333333333333333333');
    });

    it('should handle all three chains', () => {
      mockWeb3Config({
        mainnetPrimaryAddress: '0x1111111111111111111111111111111111111111',
        sepoliaPrimaryAddress: '0x2222222222222222222222222222222222222222',
        sunetPrimaryAddress: '0x3333333333333333333333333333333333333333'
      });

      const result = getRuntimeFlags();

      expect(result.addresses.mainnet.primary).toBeTruthy();
      expect(result.addresses.sepolia.primary).toBeTruthy();
      expect(result.addresses.sunet.primary).toBeTruthy();
    });
  });

  describe('asset bases', () => {
    it('should use defaults when assetBases not provided', () => {
      mockWeb3Config({});

      const result = getRuntimeFlags();

      expect(result.assetBases.mainnet).toContain('/build');
      expect(result.assetBases.sepolia).toContain('/build-sepolia');
      expect(result.assetBases.sunet).toContain('/build-sunet');
    });

    it('should parse custom assetBases', () => {
      mockWeb3Config({ assetBases: { mainnet: '/custom' } });

      const result = getRuntimeFlags();

      expect(result.assetBases.mainnet).toBe('/custom');
    });

    it('should prepend SITE_BASEURL when present', () => {
      mockSiteBaseUrl('/base');
      mockWeb3Config({});

      const result = getRuntimeFlags();

      expect(result.assetBases.mainnet).toContain('/base');
    });

    it('should not double-prepend SITE_BASEURL', () => {
      mockSiteBaseUrl('/base');
      mockWeb3Config({ assetBases: { mainnet: '/base/build' } });

      const result = getRuntimeFlags();

      const matches = (result.assetBases.mainnet.match(/\/base/g) || []).length;
      expect(matches).toBe(1);
    });
  });

  describe('sunet overrides', () => {
    it('should parse sunetRpcUrl into array', () => {
      mockWeb3Config({ sunetRpcUrl: 'http://localhost:9999' });

      const result = getRuntimeFlags();

      expect(result.overrides.sunetRpcUrls).toEqual(['http://localhost:9999']);
    });

    it('should parse sunetBlockExplorerUrl', () => {
      mockWeb3Config({ sunetBlockExplorerUrl: 'http://custom:4000' });

      const result = getRuntimeFlags();

      expect(result.overrides.sunetExplorerBaseUrl).toBe('http://custom:4000');
    });

    it('should handle missing sunet overrides', () => {
      mockWeb3Config({});

      const result = getRuntimeFlags();

      expect(result.overrides).toBeDefined();
    });
  });

  describe('edge cases', () => {
    it('should handle window.SU_WEB3 instead of window.suWeb3', () => {
      (window as any).SU_WEB3 = { chain: 'sepolia' };

      const result = getRuntimeFlags();

      expect(result.chain).toBe('sepolia');

      delete (window as any).SU_WEB3;
    });

    it('should handle null window.suWeb3', () => {
      (window as any).suWeb3 = null;

      const result = getRuntimeFlags();

      expect(result.chain).toBe(DEFAULT_CHAIN);
    });

    it('should handle mixed camelCase and UPPERCASE in same config', () => {
      mockWeb3Config({
        chain: 'sepolia',
        DEBUG: 'true',
        mainnetPrimaryAddress: '0x1111111111111111111111111111111111111111'
      });

      const result = getRuntimeFlags();

      expect(result.chain).toBe('sepolia');
      expect(result.debug).toBe(true);
      expect(result.addresses.mainnet.primary).toBeTruthy();
    });

    it('should handle empty strings for addresses', () => {
      mockWeb3Config({
        mainnetPrimaryAddress: ''
      });

      const result = getRuntimeFlags();

      expect(result.addresses.mainnet).toBeDefined();
    });

    it('should handle NaN for numeric values', () => {
      mockWeb3Config({ sunetChainId: NaN });

      const result = getRuntimeFlags();

      expect(result.overrides.sunetChainId).toBeTruthy();
      expect(Number.isNaN(result.overrides.sunetChainId)).toBe(false);
    });
  });
});
