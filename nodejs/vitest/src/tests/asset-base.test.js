import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getAssetBase, hasRuntimeConfig, assetPath } from '../../../../assets/js/asset-base.js';

// Mock the runtime.js module
vi.mock('../../../../assets/web3/config/runtime.js', () => ({
  getRuntimeFlags: vi.fn()
}));

import { getRuntimeFlags } from '../../../../assets/web3/config/runtime.js';

describe('asset-base', () => {
  beforeEach(() => {
    // Clear window globals
    window.SITE_BASEURL = '';
    window.suWeb3 = undefined;
    window.SU_WEB3 = undefined;

    // Reset mock
    vi.clearAllMocks();
  });

  describe('hasRuntimeConfig', () => {
    it('should return false when no config exists', () => {
      expect(hasRuntimeConfig()).toBe(false);
    });

    it('should return false when window.suWeb3 is null', () => {
      window.suWeb3 = null;
      expect(hasRuntimeConfig()).toBe(false);
    });

    it('should return false when window.suWeb3 is empty object', () => {
      window.suWeb3 = {};
      expect(hasRuntimeConfig()).toBe(false);
    });

    it('should return true when window.suWeb3 has properties', () => {
      window.suWeb3 = { chain: 'mainnet' };
      expect(hasRuntimeConfig()).toBe(true);
    });

    it('should return true when window.SU_WEB3 has properties', () => {
      window.SU_WEB3 = { chain: 'sepolia' };
      expect(hasRuntimeConfig()).toBe(true);
    });

    it('should prefer window.suWeb3 over SU_WEB3', () => {
      window.suWeb3 = { chain: 'mainnet' };
      window.SU_WEB3 = {};
      expect(hasRuntimeConfig()).toBe(true);
    });

    it('should return false for non-object config', () => {
      window.suWeb3 = 'not-an-object';
      expect(hasRuntimeConfig()).toBe(false);
    });
  });

  describe('getAssetBase', () => {
    it('should return default /build when no config', () => {
      getRuntimeFlags.mockReturnValue({
        chain: 'mainnet',
        assetBases: {}
      });

      expect(getAssetBase()).toBe('/build');
    });

    it('should return chain-specific base from assetBases', () => {
      getRuntimeFlags.mockReturnValue({
        chain: 'sepolia',
        assetBases: {
          mainnet: '/build',
          sepolia: '/build-sepolia'
        }
      });

      expect(getAssetBase()).toBe('/build-sepolia');
    });

    it('should use SITE_BASEURL when present', () => {
      window.SITE_BASEURL = '/mysite';
      getRuntimeFlags.mockReturnValue({
        chain: 'mainnet',
        assetBases: {}
      });

      expect(getAssetBase()).toBe('/mysite/build');
    });

    it('should normalize base by adding leading slash', () => {
      getRuntimeFlags.mockReturnValue({
        chain: 'mainnet',
        assetBases: {
          mainnet: 'build-no-slash'
        }
      });

      expect(getAssetBase()).toBe('/build-no-slash');
    });

    it('should normalize base by removing trailing slash', () => {
      getRuntimeFlags.mockReturnValue({
        chain: 'mainnet',
        assetBases: {
          mainnet: '/build/'
        }
      });

      expect(getAssetBase()).toBe('/build');
    });

    it('should normalize base with multiple trailing slashes', () => {
      getRuntimeFlags.mockReturnValue({
        chain: 'mainnet',
        assetBases: {
          mainnet: '/build///'
        }
      });

      expect(getAssetBase()).toBe('/build');
    });

    it('should handle SITE_BASEURL with trailing slash', () => {
      window.SITE_BASEURL = '/mysite/';
      getRuntimeFlags.mockReturnValue({
        chain: 'mainnet',
        assetBases: {}
      });

      // Note: SITE_BASEURL trailing slash results in double slash
      // This is current behavior - normalizeBase doesn't strip trailing slash from baseurl
      expect(getAssetBase()).toBe('/mysite//build');
    });

    it('should handle sunet chain', () => {
      getRuntimeFlags.mockReturnValue({
        chain: 'sunet',
        assetBases: {
          mainnet: '/build',
          sepolia: '/build-sepolia',
          sunet: '/build-sunet'
        }
      });

      expect(getAssetBase()).toBe('/build-sunet');
    });

    it('should handle empty base string', () => {
      getRuntimeFlags.mockReturnValue({
        chain: 'mainnet',
        assetBases: {
          mainnet: ''
        }
      });

      expect(getAssetBase()).toBe('/build');
    });

    it('should handle whitespace in base', () => {
      getRuntimeFlags.mockReturnValue({
        chain: 'mainnet',
        assetBases: {
          mainnet: '  /build  '
        }
      });

      expect(getAssetBase()).toBe('/build');
    });
  });

  describe('assetPath', () => {
    beforeEach(() => {
      getRuntimeFlags.mockReturnValue({
        chain: 'mainnet',
        assetBases: {
          mainnet: '/build'
        }
      });
    });

    it('should join base with relative path starting with slash', () => {
      expect(assetPath('/assets/main.js')).toBe('/build/assets/main.js');
    });

    it('should join base with relative path without leading slash', () => {
      expect(assetPath('assets/main.js')).toBe('/build/assets/main.js');
    });

    it('should handle empty path', () => {
      expect(assetPath('')).toBe('/build/');
    });

    it('should work with different asset base', () => {
      getRuntimeFlags.mockReturnValue({
        chain: 'sepolia',
        assetBases: {
          sepolia: '/build-sepolia'
        }
      });

      expect(assetPath('assets/test.js')).toBe('/build-sepolia/assets/test.js');
    });

    it('should work with SITE_BASEURL', () => {
      window.SITE_BASEURL = '/mysite';
      getRuntimeFlags.mockReturnValue({
        chain: 'mainnet',
        assetBases: {}
      });

      expect(assetPath('assets/main.js')).toBe('/mysite/build/assets/main.js');
    });

    it('should handle nested paths', () => {
      expect(assetPath('deep/nested/path/file.js')).toBe('/build/deep/nested/path/file.js');
    });

    it('should handle paths with query strings', () => {
      expect(assetPath('asset.js?v=123')).toBe('/build/asset.js?v=123');
    });

    it('should not double-slash when path has leading slash', () => {
      expect(assetPath('/assets/main.js')).toBe('/build/assets/main.js');
      expect(assetPath('assets/main.js')).toBe('/build/assets/main.js');
    });
  });

  describe('integration scenarios', () => {
    it('should handle full mainnet production scenario', () => {
      window.SITE_BASEURL = '';
      getRuntimeFlags.mockReturnValue({
        chain: 'mainnet',
        assetBases: {
          mainnet: '/build',
          sepolia: '/build-sepolia',
          sunet: '/build-sunet'
        }
      });

      expect(getAssetBase()).toBe('/build');
      expect(assetPath('contracts/TenThousandSu.json')).toBe('/build/contracts/TenThousandSu.json');
    });

    it('should handle sepolia testnet scenario', () => {
      window.SITE_BASEURL = '';
      getRuntimeFlags.mockReturnValue({
        chain: 'sepolia',
        assetBases: {
          mainnet: '/build',
          sepolia: '/build-sepolia'
        }
      });

      expect(getAssetBase()).toBe('/build-sepolia');
      expect(assetPath('contracts/TenThousandSu.json')).toBe('/build-sepolia/contracts/TenThousandSu.json');
    });

    it('should handle custom site with baseurl', () => {
      window.SITE_BASEURL = '/tenthousandsu';
      getRuntimeFlags.mockReturnValue({
        chain: 'mainnet',
        assetBases: {}
      });

      expect(getAssetBase()).toBe('/tenthousandsu/build');
      expect(assetPath('assets/main.js')).toBe('/tenthousandsu/build/assets/main.js');
    });
  });
});
