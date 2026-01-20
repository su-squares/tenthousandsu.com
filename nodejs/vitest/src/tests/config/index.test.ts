import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mockWeb3Config, clearWeb3Config, resetConfigModule } from '@test-helpers/config';

describe('config/index.js - getWeb3Config()', () => {
  let getWeb3Config: any;
  let ChainKey: any;
  let DEFAULT_CHAIN: any;

  beforeEach(async () => {
    clearWeb3Config();
    await resetConfigModule();

    const module = await import('@web3/config/index.js');
    getWeb3Config = module.getWeb3Config;
    ChainKey = module.ChainKey;
    DEFAULT_CHAIN = module.DEFAULT_CHAIN;
  });

  afterEach(() => {
    clearWeb3Config();
  });

  describe('basic functionality', () => {
    it('should return complete config object', () => {
      const config = getWeb3Config();

      expect(config).toHaveProperty('chain');
      expect(config).toHaveProperty('debug');
      expect(config).toHaveProperty('walletConnectProjectId');
      expect(config).toHaveProperty('networks');
      expect(config).toHaveProperty('activeNetwork');
      expect(config).toHaveProperty('contracts');
      expect(config).toHaveProperty('pricing');
      expect(config).toHaveProperty('assetBases');
    });

    it('should have networks object with all chain keys', () => {
      const config = getWeb3Config();

      expect(config.networks).toHaveProperty('mainnet');
      expect(config.networks).toHaveProperty('sepolia');
      expect(config.networks).toHaveProperty('sunet');
    });

    it('should set activeNetwork based on chain', async () => {
      mockWeb3Config({
        chain: 'sepolia',
        sepoliaPrimaryAddress: '0x3333333333333333333333333333333333333333',
        sepoliaUnderlayAddress: '0x4444444444444444444444444444444444444444'
      });
      await resetConfigModule();
      const module = await import('@web3/config/index.js');

      const config = module.getWeb3Config();

      expect(config.activeNetwork.key).toBe('sepolia');
      expect(config.activeNetwork).toBe(config.networks.sepolia);
    });

    it('should resolve contracts for active network', () => {
      const config = getWeb3Config();

      expect(config.contracts).toHaveProperty('primary');
      expect(config.contracts).toHaveProperty('underlay');
      expect(config.contracts.primary).toMatch(/^0x[a-fA-F0-9]{40}$/);
      expect(config.contracts.underlay).toMatch(/^0x[a-fA-F0-9]{40}$/);
    });

    it('should fallback to DEFAULT_CHAIN when invalid chain', async () => {
      mockWeb3Config({ chain: 'invalid' });
      await resetConfigModule();
      const module = await import('@web3/config/index.js');

      const config = module.getWeb3Config();

      expect(config.chain).toBe(DEFAULT_CHAIN);
    });
  });

  describe('caching behavior', () => {
    it('should return cached config on second call', () => {
      const config1 = getWeb3Config();
      const config2 = getWeb3Config();

      expect(config1).toBe(config2);
    });

    it('should invalidate cache when flags change', async () => {
      mockWeb3Config({ debug: false });
      await resetConfigModule();
      let module = await import('@web3/config/index.js');

      const config1 = module.getWeb3Config();
      expect(config1.debug).toBe(false);

      clearWeb3Config();
      mockWeb3Config({ debug: true });
      await resetConfigModule();
      module = await import('@web3/config/index.js');

      const config2 = module.getWeb3Config();
      expect(config2.debug).toBe(true);
    });

    it('should cache based on configuration signature', () => {
      mockWeb3Config({ chain: 'mainnet', debug: false });

      const config1 = getWeb3Config();
      const config2 = getWeb3Config();
      const config3 = getWeb3Config();

      expect(config1).toBe(config2);
      expect(config2).toBe(config3);
    });
  });

  describe('network building', () => {
    it('should apply sunet overrides correctly', async () => {
      mockWeb3Config({
        sunetChainId: 88888888,
        sunetRpcUrl: 'http://custom:8545',
        sunetBlockExplorerUrl: 'http://custom:4001'
      });
      await resetConfigModule();
      const module = await import('@web3/config/index.js');

      const config = module.getWeb3Config();

      expect(config.networks.sunet.chainId).toBe(88888888);
      expect(config.networks.sunet.rpcUrls).toContain('http://custom:8545');
      expect(config.networks.sunet.explorerBaseUrl).toBe('http://custom:4001');
    });

    it('should not modify mainnet from defaults', () => {
      const config = getWeb3Config();

      expect(config.networks.mainnet.chainId).toBe(1);
      expect(config.networks.mainnet.key).toBe('mainnet');
    });

    it('should not modify sepolia from defaults', () => {
      const config = getWeb3Config();

      expect(config.networks.sepolia.chainId).toBe(11155111);
      expect(config.networks.sepolia.key).toBe('sepolia');
    });

    it('should include rpcUrls in network objects', () => {
      const config = getWeb3Config();

      expect(config.networks.mainnet.rpcUrls).toBeDefined();
      expect(Array.isArray(config.networks.mainnet.rpcUrls)).toBe(true);
      expect(config.networks.sepolia.rpcUrls).toBeDefined();
      expect(Array.isArray(config.networks.sepolia.rpcUrls)).toBe(true);
    });
  });

  describe('re-exports', () => {
    it('should re-export ChainKey from networks', () => {
      expect(ChainKey).toBeDefined();
      expect(ChainKey.MAINNET).toBe('mainnet');
      expect(ChainKey.SEPOLIA).toBe('sepolia');
      expect(ChainKey.SUNET).toBe('sunet');
    });

    it('should re-export DEFAULT_CHAIN from networks', () => {
      expect(DEFAULT_CHAIN).toBeDefined();
      expect(DEFAULT_CHAIN).toBe('mainnet');
    });

    it('should re-export NETWORK_PRESETS from networks', async () => {
      const module = await import('@web3/config/index.js');

      expect(module.NETWORK_PRESETS).toBeDefined();
      expect(module.NETWORK_PRESETS.mainnet).toBeDefined();
      expect(module.NETWORK_PRESETS.sepolia).toBeDefined();
      expect(module.NETWORK_PRESETS.sunet).toBeDefined();
    });
  });

  describe('pricing configuration', () => {
    it('should include pricing in config', () => {
      const config = getWeb3Config();

      expect(config.pricing).toHaveProperty('mintPriceEth');
      expect(config.pricing).toHaveProperty('personalizePriceEth');
    });

    it('should use custom pricing when provided', async () => {
      mockWeb3Config({
        pricing: {
          mintPriceEth: 0.75,
          personalizePriceEth: 0.002
        }
      });
      await resetConfigModule();
      const module = await import('@web3/config/index.js');

      const config = module.getWeb3Config();

      expect(config.pricing.mintPriceEth).toBe(0.75);
      expect(config.pricing.personalizePriceEth).toBe(0.002);
    });
  });

  describe('asset bases configuration', () => {
    it('should include assetBases in config', () => {
      const config = getWeb3Config();

      expect(config.assetBases).toHaveProperty('mainnet');
      expect(config.assetBases).toHaveProperty('sepolia');
      expect(config.assetBases).toHaveProperty('sunet');
    });

    it('should use custom asset bases when provided', async () => {
      mockWeb3Config({
        assetBases: {
          mainnet: '/custom-mainnet',
          sepolia: '/custom-sepolia'
        }
      });
      await resetConfigModule();
      const module = await import('@web3/config/index.js');

      const config = module.getWeb3Config();

      expect(config.assetBases.mainnet).toBe('/custom-mainnet');
      expect(config.assetBases.sepolia).toBe('/custom-sepolia');
    });
  });

  describe('edge cases', () => {
    it('should handle empty window.suWeb3', async () => {
      mockWeb3Config({});
      await resetConfigModule();
      const module = await import('@web3/config/index.js');

      const config = module.getWeb3Config();

      expect(config).toBeDefined();
      expect(config.chain).toBe(DEFAULT_CHAIN);
    });

    it('should provide contract addresses for mainnet by default', () => {
      const config = getWeb3Config();

      expect(config.chain).toBe('mainnet');
      expect(config.contracts.primary).toBeTruthy();
      expect(config.contracts.underlay).toBeTruthy();
    });
  });
});
