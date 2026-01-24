import { vi } from 'vitest';

const mockGetWeb3Config = vi.fn();

vi.mock('@web3/config/index.js', () => ({
  getWeb3Config: mockGetWeb3Config,
}));

describe('services/explorer-links.js', () => {
  let buildTxUrl: any;
  let buildBlockUrl: any;
  let buildTokenUrl: any;
  let getExplorerName: any;
  let getExplorerBaseUrl: any;

  beforeEach(async () => {
    vi.resetModules();
    mockGetWeb3Config.mockReturnValue({
      activeNetwork: {
        explorerBaseUrl: 'https://etherscan.io',
        explorerTxPath: '/tx/',
        explorerName: 'Etherscan',
        explorerType: 'etherscan',
      },
    });

    const module = await import('@web3/services/explorer-links.js');
    buildTxUrl = module.buildTxUrl;
    buildBlockUrl = module.buildBlockUrl;
    buildTokenUrl = module.buildTokenUrl;
    getExplorerName = module.getExplorerName;
    getExplorerBaseUrl = module.getExplorerBaseUrl;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('buildTxUrl', () => {
    it('should build correct transaction URL', () => {
      const hash = '0xabc123';
      expect(buildTxUrl(hash)).toBe('https://etherscan.io/tx/0xabc123');
    });

    it('should return null for empty hash', () => {
      expect(buildTxUrl('')).toBeNull();
      expect(buildTxUrl(null)).toBeNull();
      expect(buildTxUrl(undefined)).toBeNull();
    });

    it('should return null if no explorer base URL configured', () => {
      mockGetWeb3Config.mockReturnValue({
        activeNetwork: { explorerBaseUrl: null },
      });
      expect(buildTxUrl('0xabc')).toBeNull();
    });

    it('should handle trailing slash in base URL', () => {
      mockGetWeb3Config.mockReturnValue({
        activeNetwork: {
          explorerBaseUrl: 'https://etherscan.io/',
          explorerTxPath: '/tx/',
        },
      });
      expect(buildTxUrl('0xabc')).toBe('https://etherscan.io/tx/0xabc');
    });

    it('should handle missing explorerTxPath', () => {
      mockGetWeb3Config.mockReturnValue({
        activeNetwork: {
          explorerBaseUrl: 'https://etherscan.io',
        },
      });
      expect(buildTxUrl('0xabc')).toBe('https://etherscan.io/tx/0xabc');
    });

    it('should normalize path without leading slash', () => {
      mockGetWeb3Config.mockReturnValue({
        activeNetwork: {
          explorerBaseUrl: 'https://etherscan.io',
          explorerTxPath: 'tx/',
        },
      });
      expect(buildTxUrl('0xabc')).toBe('https://etherscan.io/tx/0xabc');
    });
  });

  describe('buildBlockUrl', () => {
    it('should build correct block URL', () => {
      expect(buildBlockUrl(12345)).toBe('https://etherscan.io/block/12345');
    });

    it('should handle string block numbers', () => {
      expect(buildBlockUrl('99999')).toBe('https://etherscan.io/block/99999');
    });

    it('should return null for empty block number', () => {
      expect(buildBlockUrl('')).toBeNull();
      expect(buildBlockUrl(null)).toBeNull();
      expect(buildBlockUrl(undefined)).toBeNull();
      expect(buildBlockUrl(0)).toBeNull();
    });

    it('should return null if no explorer configured', () => {
      mockGetWeb3Config.mockReturnValue({
        activeNetwork: { explorerBaseUrl: null },
      });
      expect(buildBlockUrl(123)).toBeNull();
    });
  });

  describe('buildTokenUrl', () => {
    it('should build token URL without tokenId', () => {
      expect(buildTokenUrl('0xcontract')).toBe('https://etherscan.io/token/0xcontract');
    });

    it('should build NFT URL with tokenId for Etherscan', () => {
      expect(buildTokenUrl('0xcontract', 42)).toBe(
        'https://etherscan.io/nft/0xcontract/42'
      );
    });

    it('should build instance URL with tokenId for Blockscout', () => {
      mockGetWeb3Config.mockReturnValue({
        activeNetwork: {
          explorerBaseUrl: 'http://localhost:4001',
          explorerName: 'Blockscout',
          explorerType: 'blockscout',
        },
      });
      expect(buildTokenUrl('0xcontract', 42)).toBe(
        'http://localhost:4001/token/0xcontract/instance/42'
      );
    });

    it('should return null for empty contract address', () => {
      expect(buildTokenUrl('')).toBeNull();
      expect(buildTokenUrl(null as any)).toBeNull();
    });

    it('should return null if no explorer configured', () => {
      mockGetWeb3Config.mockReturnValue({
        activeNetwork: { explorerBaseUrl: null },
      });
      expect(buildTokenUrl('0xcontract')).toBeNull();
    });
  });

  describe('getExplorerName', () => {
    it('should return configured explorer name', () => {
      expect(getExplorerName()).toBe('Etherscan');
    });

    it('should return default if not configured', () => {
      mockGetWeb3Config.mockReturnValue({
        activeNetwork: {},
      });
      expect(getExplorerName()).toBe('Block Explorer');
    });
  });

  describe('getExplorerBaseUrl', () => {
    it('should return configured base URL', () => {
      expect(getExplorerBaseUrl()).toBe('https://etherscan.io');
    });

    it('should return null if not configured', () => {
      mockGetWeb3Config.mockReturnValue({
        activeNetwork: {},
      });
      expect(getExplorerBaseUrl()).toBeNull();
    });
  });
});
