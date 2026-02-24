import { getAssetBase, hasRuntimeConfig, assetPath } from '../../../../assets/js/asset-base.js';

vi.mock('../../../../assets/web3/config/runtime.js', () => ({
  getRuntimeFlags: vi.fn()
}));

import { getRuntimeFlags } from '../../../../assets/web3/config/runtime.js';

const getRuntimeFlagsMock = vi.mocked(getRuntimeFlags);
type RuntimeFlags = ReturnType<typeof getRuntimeFlags>;

const makeRuntimeFlags = (overrides: Partial<RuntimeFlags> = {}): RuntimeFlags => ({
  chain: 'mainnet',
  debug: false,
  walletConnectProjectId: 'test-project-id',
  addresses: {},
  assetBases: {},
  overrides: {},
  pricing: { mintPriceEth: 0.5, personalizePriceEth: 0.001 },
  ...overrides
});

describe('asset-base', () => {
  beforeEach(() => {
    (window as any).SITE_BASEURL = '';
    (window as any).suWeb3 = undefined;
    (window as any).SU_WEB3 = undefined;

    vi.clearAllMocks();
  });

  describe('hasRuntimeConfig', () => {
    it('should return false when no config exists', () => {
      expect(hasRuntimeConfig()).toBe(false);
    });

    it('should return false when window.suWeb3 is null', () => {
      (window as any).suWeb3 = null;
      expect(hasRuntimeConfig()).toBe(false);
    });

    it('should return false when window.suWeb3 is empty object', () => {
      (window as any).suWeb3 = {};
      expect(hasRuntimeConfig()).toBe(false);
    });

    it('should return true when window.suWeb3 has properties', () => {
      (window as any).suWeb3 = { chain: 'mainnet' };
      expect(hasRuntimeConfig()).toBe(true);
    });

    it('should return true when window.SU_WEB3 has properties', () => {
      (window as any).SU_WEB3 = { chain: 'sepolia' };
      expect(hasRuntimeConfig()).toBe(true);
    });

    it('should prefer window.suWeb3 over SU_WEB3', () => {
      (window as any).suWeb3 = { chain: 'mainnet' };
      (window as any).SU_WEB3 = {};
      expect(hasRuntimeConfig()).toBe(true);
    });

    it('should return false for non-object config', () => {
      (window as any).suWeb3 = 'not-an-object';
      expect(hasRuntimeConfig()).toBe(false);
    });
  });

  describe('getAssetBase', () => {
    it('should return default /build when no config', () => {
      getRuntimeFlagsMock.mockReturnValue(makeRuntimeFlags({
        chain: 'mainnet',
        assetBases: {}
      }));

      expect(getAssetBase()).toBe('/build');
    });

    it('should return chain-specific base from assetBases', () => {
      getRuntimeFlagsMock.mockReturnValue(makeRuntimeFlags({
        chain: 'sepolia',
        assetBases: {
          mainnet: '/build',
          sepolia: '/build-sepolia'
        }
      }));

      expect(getAssetBase()).toBe('/build-sepolia');
    });

    it('should use SITE_BASEURL when present', () => {
      (window as any).SITE_BASEURL = '/mysite';
      getRuntimeFlagsMock.mockReturnValue(makeRuntimeFlags({
        chain: 'mainnet',
        assetBases: {}
      }));

      expect(getAssetBase()).toBe('/mysite/build');
    });

    it('should normalize base by adding leading slash', () => {
      getRuntimeFlagsMock.mockReturnValue(makeRuntimeFlags({
        chain: 'mainnet',
        assetBases: {
          mainnet: 'build-no-slash'
        }
      }));

      expect(getAssetBase()).toBe('/build-no-slash');
    });

    it('should normalize base by removing trailing slash', () => {
      getRuntimeFlagsMock.mockReturnValue(makeRuntimeFlags({
        chain: 'mainnet',
        assetBases: {
          mainnet: '/build/'
        }
      }));

      expect(getAssetBase()).toBe('/build');
    });

    it('should normalize base with multiple trailing slashes', () => {
      getRuntimeFlagsMock.mockReturnValue(makeRuntimeFlags({
        chain: 'mainnet',
        assetBases: {
          mainnet: '/build///'
        }
      }));

      expect(getAssetBase()).toBe('/build');
    });

    it('should handle SITE_BASEURL with trailing slash', () => {
      (window as any).SITE_BASEURL = '/mysite/';
      getRuntimeFlagsMock.mockReturnValue(makeRuntimeFlags({
        chain: 'mainnet',
        assetBases: {}
      }));

      expect(getAssetBase()).toBe('/mysite/build');
    });

    it('should handle sunet chain', () => {
      getRuntimeFlagsMock.mockReturnValue(makeRuntimeFlags({
        chain: 'sunet',
        assetBases: {
          mainnet: '/build',
          sepolia: '/build-sepolia',
          sunet: '/build-sunet'
        }
      }));

      expect(getAssetBase()).toBe('/build-sunet');
    });

    it('should handle empty base string', () => {
      getRuntimeFlagsMock.mockReturnValue(makeRuntimeFlags({
        chain: 'mainnet',
        assetBases: {
          mainnet: ''
        }
      }));

      expect(getAssetBase()).toBe('/build');
    });

    it('should handle whitespace in base', () => {
      getRuntimeFlagsMock.mockReturnValue(makeRuntimeFlags({
        chain: 'mainnet',
        assetBases: {
          mainnet: '  /build  '
        }
      }));

      expect(getAssetBase()).toBe('/build');
    });

    it('should fall back when assetBases are missing', () => {
      getRuntimeFlagsMock.mockReturnValue({
        chain: 'mainnet'
      } as any);

      expect(getAssetBase()).toBe('/build');
    });

    it('should fall back when chain is missing', () => {
      getRuntimeFlagsMock.mockReturnValue({
        assetBases: {
          mainnet: '/build'
        }
      } as any);

      expect(getAssetBase()).toBe('/build');
    });
  });

  describe('assetPath', () => {
    beforeEach(() => {
      getRuntimeFlagsMock.mockReturnValue(makeRuntimeFlags({
        chain: 'mainnet',
        assetBases: {
          mainnet: '/build'
        }
      }));
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
      getRuntimeFlagsMock.mockReturnValue(makeRuntimeFlags({
        chain: 'sepolia',
        assetBases: {
          sepolia: '/build-sepolia'
        }
      }));

      expect(assetPath('assets/test.js')).toBe('/build-sepolia/assets/test.js');
    });

    it('should work with SITE_BASEURL', () => {
      (window as any).SITE_BASEURL = '/mysite';
      getRuntimeFlagsMock.mockReturnValue(makeRuntimeFlags({
        chain: 'mainnet',
        assetBases: {}
      }));

      expect(assetPath('assets/main.js')).toBe('/mysite/build/assets/main.js');
    });

    it('should handle trailing slash in SITE_BASEURL', () => {
      (window as any).SITE_BASEURL = '/mysite/';
      getRuntimeFlagsMock.mockReturnValue(makeRuntimeFlags({
        chain: 'mainnet',
        assetBases: {}
      }));

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
      (window as any).SITE_BASEURL = '';
      getRuntimeFlagsMock.mockReturnValue(makeRuntimeFlags({
        chain: 'mainnet',
        assetBases: {
          mainnet: '/build',
          sepolia: '/build-sepolia',
          sunet: '/build-sunet'
        }
      }));

      expect(getAssetBase()).toBe('/build');
      expect(assetPath('contracts/TenThousandSu.json')).toBe('/build/contracts/TenThousandSu.json');
    });

    it('should handle sepolia testnet scenario', () => {
      (window as any).SITE_BASEURL = '';
      getRuntimeFlagsMock.mockReturnValue(makeRuntimeFlags({
        chain: 'sepolia',
        assetBases: {
          mainnet: '/build',
          sepolia: '/build-sepolia'
        }
      }));

      expect(getAssetBase()).toBe('/build-sepolia');
      expect(assetPath('contracts/TenThousandSu.json')).toBe('/build-sepolia/contracts/TenThousandSu.json');
    });

    it('should handle custom site with baseurl', () => {
      (window as any).SITE_BASEURL = '/tenthousandsu';
      getRuntimeFlagsMock.mockReturnValue(makeRuntimeFlags({
        chain: 'mainnet',
        assetBases: {}
      }));

      expect(getAssetBase()).toBe('/tenthousandsu/build');
      expect(assetPath('assets/main.js')).toBe('/tenthousandsu/build/assets/main.js');
    });
  });
});
