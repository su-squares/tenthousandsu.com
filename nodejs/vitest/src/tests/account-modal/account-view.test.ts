/**
 * Tests for account-modal/account-view.js
 *
 * Tests the renderAccountView function and chain icon selection logic.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { clearWeb3Config, resetConfigModule, mockSiteBaseUrl, clearSiteBaseUrl } from '@test-helpers/config';

describe('account-modal/account-view.js', () => {
  let renderAccountView: any;

  beforeEach(async () => {
    clearWeb3Config();
    clearSiteBaseUrl();
    mockSiteBaseUrl('');

    // Mock window.location.origin
    Object.defineProperty(window, 'location', {
      value: { origin: 'https://example.com' },
      writable: true,
    });

    await resetConfigModule();

    const module = await import('@web3/wallet/account-modal/account-view.js');
    renderAccountView = module.renderAccountView;
  });

  afterEach(() => {
    clearWeb3Config();
    clearSiteBaseUrl();
    vi.restoreAllMocks();
  });

  function createMockTarget(): HTMLElement {
    const div = document.createElement('div');
    return div;
  }

  function createMockData(overrides: Partial<{
    account: any;
    ensName: string | null;
    balance: any;
  }> = {}) {
    return {
      account: {
        address: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045',
        connector: { id: 'injected' },
        ...overrides.account,
      },
      ensName: overrides.ensName ?? null,
      balance: overrides.balance ?? { formatted: '1.5', symbol: 'ETH' },
    };
  }

  function createMockOptions(overrides: Partial<{
    activeNetwork: any;
    presets: { mainnet: number; sepolia: number };
    wagmiClient: any;
    onDisconnect: () => void;
    onRefresh: () => void;
    loadingEns: boolean;
    loadingBalance: boolean;
  }> = {}) {
    return {
      activeNetwork: overrides.activeNetwork ?? { chainId: 1, label: 'Ethereum Mainnet' },
      presets: overrides.presets ?? { mainnet: 1, sepolia: 11155111 },
      wagmiClient: overrides.wagmiClient ?? { disconnect: vi.fn() },
      onDisconnect: overrides.onDisconnect ?? vi.fn(),
      onRefresh: overrides.onRefresh,
      loadingEns: overrides.loadingEns ?? false,
      loadingBalance: overrides.loadingBalance ?? false,
    };
  }

  describe('chain icon selection', () => {
    it('should show Ethereum logo for mainnet', () => {
      const target = createMockTarget();
      const data = createMockData();
      const options = createMockOptions({
        activeNetwork: { chainId: 1, label: 'Ethereum Mainnet' },
      });

      renderAccountView(target, data, options);

      const img = target.querySelector('img');
      expect(img?.getAttribute('src')).toContain('ethereum_logo.png');
      expect(img?.getAttribute('alt')).toBe('Ethereum logo');
    });

    it('should show Sepolia logo for sepolia testnet', () => {
      const target = createMockTarget();
      const data = createMockData();
      const options = createMockOptions({
        activeNetwork: { chainId: 11155111, label: 'Sepolia' },
      });

      renderAccountView(target, data, options);

      const img = target.querySelector('img');
      expect(img?.getAttribute('src')).toContain('sepolia-logo.png');
      expect(img?.getAttribute('alt')).toBe('Sepolia logo');
    });

    it('should show SU logo for custom/unknown chains', () => {
      const target = createMockTarget();
      const data = createMockData();
      const options = createMockOptions({
        activeNetwork: { chainId: 99999991, label: 'Sunet' },
      });

      renderAccountView(target, data, options);

      const img = target.querySelector('img');
      expect(img?.getAttribute('src')).toContain('logomark-su-squares.png');
      expect(img?.getAttribute('alt')).toBe('Sunet logo');
    });
  });

  describe('address display', () => {
    it('should display ENS name when available', () => {
      const target = createMockTarget();
      const data = createMockData({ ensName: 'vitalik.eth' });
      const options = createMockOptions();

      renderAccountView(target, data, options);

      expect(target.innerHTML).toContain('vitalik.eth');
    });

    it('should display truncated address when ENS not available', () => {
      const target = createMockTarget();
      const data = createMockData({ ensName: null });
      const options = createMockOptions();

      renderAccountView(target, data, options);

      // Should contain truncated address (first and last chars)
      const html = target.innerHTML;
      expect(html).toContain('0xd8dA');
      expect(html).toContain('96045');
    });

    it('should display "Fetching ENS..." when loading', () => {
      const target = createMockTarget();
      const data = createMockData({ ensName: null });
      const options = createMockOptions({ loadingEns: true });

      renderAccountView(target, data, options);

      expect(target.innerHTML).toContain('Fetching ENS...');
    });

    it('should display "Not connected" when no address', () => {
      const target = createMockTarget();
      const data = createMockData({ account: { address: null, connector: null } });
      const options = createMockOptions();

      renderAccountView(target, data, options);

      expect(target.innerHTML).toContain('Not connected');
    });
  });

  describe('balance display', () => {
    it('should display formatted balance', () => {
      const target = createMockTarget();
      const data = createMockData({ balance: { formatted: '2.5', symbol: 'ETH' } });
      const options = createMockOptions();

      renderAccountView(target, data, options);

      // Balance should be displayed (formatBalanceForDisplay formats it)
      expect(target.querySelector('.wallet-balance')).toBeTruthy();
    });

    it('should display "Fetching balance..." when loading', () => {
      const target = createMockTarget();
      // Pass data directly to ensure balance is null (createMockData uses ?? which treats null as nullish)
      const data = {
        account: {
          address: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045',
          connector: { id: 'injected' },
        },
        ensName: null,
        balance: null,
      };
      const options = createMockOptions({ loadingBalance: true });

      renderAccountView(target, data, options);

      expect(target.innerHTML).toContain('Fetching balance...');
    });
  });

  describe('network info', () => {
    it('should display network label', () => {
      const target = createMockTarget();
      const data = createMockData();
      const options = createMockOptions({
        activeNetwork: { chainId: 1, label: 'Ethereum Mainnet' },
      });

      renderAccountView(target, data, options);

      expect(target.innerHTML).toContain('Ethereum Mainnet');
    });

    it('should display chain ID', () => {
      const target = createMockTarget();
      const data = createMockData();
      const options = createMockOptions({
        activeNetwork: { chainId: 137, label: 'Polygon' },
      });

      renderAccountView(target, data, options);

      expect(target.innerHTML).toContain('Chain ID: 137');
    });
  });

  describe('buttons and actions', () => {
    it('should render disconnect button', () => {
      const target = createMockTarget();
      const data = createMockData();
      const options = createMockOptions();

      renderAccountView(target, data, options);

      const disconnectBtn = target.querySelector('[data-disconnect]');
      expect(disconnectBtn).toBeTruthy();
      expect(disconnectBtn?.textContent).toContain('Disconnect Wallet');
    });

    it('should render copy button', () => {
      const target = createMockTarget();
      const data = createMockData();
      const options = createMockOptions();

      renderAccountView(target, data, options);

      const copyBtn = target.querySelector('[data-copy]');
      expect(copyBtn).toBeTruthy();
      expect(copyBtn?.textContent).toContain('Copy');
    });

    it('should render refresh button when onRefresh provided', () => {
      const target = createMockTarget();
      const data = createMockData();
      const options = createMockOptions({ onRefresh: vi.fn() });

      renderAccountView(target, data, options);

      const refreshBtn = target.querySelector('[data-balance-refresh]');
      expect(refreshBtn).toBeTruthy();
    });

    it('should not render refresh button when onRefresh not provided', () => {
      const target = createMockTarget();
      const data = createMockData();
      const options = createMockOptions({ onRefresh: undefined });

      renderAccountView(target, data, options);

      const refreshBtn = target.querySelector('[data-balance-refresh]');
      expect(refreshBtn).toBeFalsy();
    });
  });

  describe('WalletConnect mobile button', () => {
    it('should not show "Open mobile wallet" button on desktop', () => {
      // Default: isMobileDevice() returns false
      const target = createMockTarget();
      const data = createMockData({
        account: {
          address: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045',
          connector: { id: 'walletConnect' },
        },
      });
      const options = createMockOptions();

      renderAccountView(target, data, options);

      const openWalletBtn = target.querySelector('[data-open-wallet]');
      expect(openWalletBtn).toBeFalsy();
    });

    it('should not show "Open mobile wallet" button for injected provider', () => {
      const target = createMockTarget();
      const data = createMockData({
        account: {
          address: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045',
          connector: { id: 'injected' },
        },
      });
      const options = createMockOptions();

      renderAccountView(target, data, options);

      const openWalletBtn = target.querySelector('[data-open-wallet]');
      expect(openWalletBtn).toBeFalsy();
    });
  });

  describe('edge cases', () => {
    it('should handle null target gracefully', () => {
      const data = createMockData();
      const options = createMockOptions();

      // Should not throw
      expect(() => renderAccountView(null, data, options)).not.toThrow();
    });

    it('should handle undefined account address', () => {
      const target = createMockTarget();
      const data = createMockData({ account: { address: undefined, connector: null } });
      const options = createMockOptions();

      renderAccountView(target, data, options);

      expect(target.innerHTML).toContain('Not connected');
    });
  });
});
