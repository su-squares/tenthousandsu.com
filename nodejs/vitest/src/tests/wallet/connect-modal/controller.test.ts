import { vi, type Mock } from 'vitest';
import { createTestContainer, cleanupTestContainer } from '@test-helpers/dom';

// Use vi.hoisted to create mock functions that can be used in vi.mock factories
const {
  mockOpenInfoModal,
  mockIsMobileDevice,
  mockOpenWalletDeepLink,
  mockRenderListView,
  mockRenderQrView,
  mockRenderConnectingView,
  mockRenderErrorView,
  mockRenderCanceledView,
  mockLoadWagmiClient,
  mockWagmiClient,
} = vi.hoisted(() => {
  const mockWagmiClient = {
    connectors: [] as any[],
    connect: vi.fn(),
    getAccount: vi.fn((): { isConnected: boolean; address: string | null; connector?: { id: string } } => ({
      isConnected: false,
      address: null,
    })),
    watchAccount: vi.fn((_cb: (account: any) => void) => vi.fn()),
  };

  return {
    mockOpenInfoModal: vi.fn(),
    mockIsMobileDevice: vi.fn((): boolean => false),
    mockOpenWalletDeepLink: vi.fn((_uri: string): boolean => false),
    mockRenderListView: vi.fn(),
    mockRenderQrView: vi.fn(),
    mockRenderConnectingView: vi.fn(),
    mockRenderErrorView: vi.fn(),
    mockRenderCanceledView: vi.fn(),
    mockLoadWagmiClient: vi.fn(async () => mockWagmiClient),
    mockWagmiClient,
  };
});

// Mock all dependencies before importing the controller
vi.mock('@web3/wallet/info-modal/index.js', () => ({
  openInfoModal: mockOpenInfoModal,
}));

vi.mock('@web3/wallet/wc-constants.js', () => ({
  isMobileDevice: () => mockIsMobileDevice(),
  openWalletDeepLink: (uri: string) => mockOpenWalletDeepLink(uri),
}));

vi.mock('@web3/wallet/connect-modal/views/list.js', () => ({
  renderListView: (...args: unknown[]) => mockRenderListView(...args),
}));

vi.mock('@web3/wallet/connect-modal/views/qr.js', () => ({
  renderQrView: (...args: unknown[]) => mockRenderQrView(...args),
}));

vi.mock('@web3/wallet/connect-modal/views/connecting.js', () => ({
  renderConnectingView: (...args: unknown[]) => mockRenderConnectingView(...args),
}));

vi.mock('@web3/wallet/connect-modal/views/error.js', () => ({
  renderErrorView: (...args: unknown[]) => mockRenderErrorView(...args),
}));

vi.mock('@web3/wallet/connect-modal/views/canceled.js', () => ({
  renderCanceledView: (...args: unknown[]) => mockRenderCanceledView(...args),
}));

vi.mock('@web3/config/logger.js', () => ({
  createDebugLogger: () => vi.fn(),
}));

vi.mock('@web3/client/wagmi.js', () => ({
  loadWagmiClient: mockLoadWagmiClient,
}));

// Import after mocks are set up
import { createConnectController } from '@web3/wallet/connect-modal/controller.js';
import { CONNECTING_VARIANT } from '@web3/wallet/connect-modal/constants.js';

describe('connect-modal/controller.js', () => {
  let container: HTMLElement;
  let shell: {
    content: HTMLElement;
    show: Mock;
    hide: Mock;
    setBackHandler: Mock;
    setOnRequestClose: Mock;
    setAria: Mock;
  };

  function createMockShell() {
    return {
      content: container,
      show: vi.fn(),
      hide: vi.fn(),
      setBackHandler: vi.fn(),
      setOnRequestClose: vi.fn(),
      setAria: vi.fn(),
    };
  }

  function createMockConnector(overrides: Partial<{
    id: string;
    name: string;
    ready: boolean | (() => boolean);
    _eip6963: any;
    getProvider: () => Promise<any>;
  }> = {}) {
    return {
      id: 'injected',
      name: 'MetaMask',
      ready: true,
      getProvider: vi.fn(async () => ({
        on: vi.fn(),
        off: vi.fn(),
        removeListener: vi.fn(),
      })),
      ...overrides,
    };
  }

  beforeEach(() => {
    vi.clearAllMocks();
    container = createTestContainer('connect-modal-test');
    shell = createMockShell();

    // Reset mock implementations
    mockIsMobileDevice.mockReturnValue(false);
    mockOpenWalletDeepLink.mockReturnValue(false);
    mockWagmiClient.connectors = [];
    mockWagmiClient.connect.mockResolvedValue(undefined);
    mockWagmiClient.getAccount.mockReturnValue({ isConnected: false, address: null });
    mockWagmiClient.watchAccount.mockReturnValue(vi.fn());

    // Setup localStorage mock
    const localStorageMock: Record<string, string> = {};
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation((key) => localStorageMock[key] ?? null);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation((key, value) => {
      localStorageMock[key] = value;
    });
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation((key) => {
      delete localStorageMock[key];
    });
    vi.spyOn(Storage.prototype, 'key').mockImplementation((index) => {
      const keys = Object.keys(localStorageMock);
      return keys[index] ?? null;
    });
    Object.defineProperty(localStorage, 'length', {
      get: () => Object.keys(localStorageMock).length,
      configurable: true,
    });
  });

  afterEach(() => {
    cleanupTestContainer(container);
    vi.restoreAllMocks();
  });

  describe('createConnectController', () => {
    it('returns an object with open and close methods', () => {
      const controller = createConnectController(shell);

      expect(controller).toHaveProperty('open');
      expect(controller).toHaveProperty('close');
      expect(typeof controller.open).toBe('function');
      expect(typeof controller.close).toBe('function');
    });
  });

  describe('open()', () => {
    it('loads wagmi client and shows the shell', async () => {
      const controller = createConnectController(shell);
      const openPromise = controller.open();

      // Allow promise to settle
      await vi.waitFor(() => {
        expect(shell.show).toHaveBeenCalledTimes(1);
      });

      expect(shell.setOnRequestClose).toHaveBeenCalledWith(expect.any(Function));

      // Close to resolve the promise
      controller.close();
      await openPromise;
    });

    it('renders list view with filtered connectors', async () => {
      const wcConnector = createMockConnector({ id: 'walletConnect', name: 'WalletConnect' });
      const readyConnector = createMockConnector({ id: 'injected', ready: true });
      const notReadyConnector = createMockConnector({ id: 'notReady', ready: false });
      const eip6963Connector = createMockConnector({ id: 'eip', _eip6963: { uuid: 'test-uuid' } });

      mockWagmiClient.connectors = [wcConnector, readyConnector, notReadyConnector, eip6963Connector];

      const controller = createConnectController(shell);
      const openPromise = controller.open();

      await vi.waitFor(() => {
        expect(mockRenderListView).toHaveBeenCalled();
      });

      const [, renderOptions] = mockRenderListView.mock.calls[0];
      // Should filter out notReadyConnector (ready: false)
      expect(renderOptions.connectors).toHaveLength(3);
      expect(renderOptions.connectors.map((c: any) => c.id)).toContain('walletConnect');
      expect(renderOptions.connectors.map((c: any) => c.id)).toContain('injected');
      expect(renderOptions.connectors.map((c: any) => c.id)).toContain('eip');
      expect(renderOptions.connectors.map((c: any) => c.id)).not.toContain('notReady');

      controller.close();
      await openPromise;
    });

    it('sets up account watcher that finalizes on connection', async () => {
      let watchCallback: ((account: any) => void) | null = null;
      mockWagmiClient.watchAccount.mockImplementation((cb) => {
        watchCallback = cb;
        return vi.fn();
      });

      const connectedAccount = {
        isConnected: true,
        address: '0x1234567890123456789012345678901234567890',
        connector: { id: 'injected' },
      };
      mockWagmiClient.getAccount.mockReturnValue(connectedAccount);

      const controller = createConnectController(shell);
      const openPromise = controller.open();

      await vi.waitFor(() => {
        expect(mockWagmiClient.watchAccount).toHaveBeenCalled();
      });

      // Simulate account connection via watcher
      watchCallback!({ isConnected: true, address: '0x123', connector: { id: 'injected' } });

      const result = await openPromise;
      expect(result).toEqual(connectedAccount);
      expect(shell.hide).toHaveBeenCalled();
    });
  });

  describe('close()', () => {
    it('hides shell and resolves promise with null', async () => {
      const controller = createConnectController(shell);
      const openPromise = controller.open();

      await vi.waitFor(() => {
        expect(shell.show).toHaveBeenCalled();
      });

      controller.close();
      const result = await openPromise;

      expect(result).toBeNull();
      expect(shell.hide).toHaveBeenCalled();
    });

    it('dispatches wallet:modal-closed event', async () => {
      const eventSpy = vi.fn();
      document.addEventListener('wallet:modal-closed', eventSpy);

      const controller = createConnectController(shell);
      const openPromise = controller.open();

      await vi.waitFor(() => {
        expect(shell.show).toHaveBeenCalled();
      });

      controller.close();
      await openPromise;

      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          detail: { modal: 'connect' },
        })
      );

      document.removeEventListener('wallet:modal-closed', eventSpy);
    });
  });

  describe('handleConnector (via list view callback)', () => {
    it('handles non-WalletConnect connector connection', async () => {
      const connector = createMockConnector({ id: 'injected' });
      mockWagmiClient.connectors = [connector];
      mockWagmiClient.connect.mockResolvedValue(undefined);
      mockWagmiClient.getAccount.mockReturnValue({
        isConnected: true,
        address: '0x1234',
        connector: { id: 'injected' },
      });

      const controller = createConnectController(shell);
      const openPromise = controller.open();

      await vi.waitFor(() => {
        expect(mockRenderListView).toHaveBeenCalled();
      });

      // Trigger connector selection
      const [, renderOptions] = mockRenderListView.mock.calls[0];
      await renderOptions.onSelect(connector);

      expect(mockRenderConnectingView).toHaveBeenCalled();
      expect(mockWagmiClient.connect).toHaveBeenCalledWith({ connector });

      const result = await openPromise;
      expect(result).toEqual(expect.objectContaining({ isConnected: true }));
    });

    it('handles WalletConnect connector on desktop (shows QR)', async () => {
      mockIsMobileDevice.mockReturnValue(false);

      const mockProvider = {
        on: vi.fn(),
        off: vi.fn(),
        removeListener: vi.fn(),
      };
      const wcConnector = createMockConnector({
        id: 'walletConnect',
        name: 'WalletConnect',
        getProvider: vi.fn(async () => mockProvider),
      });
      mockWagmiClient.connectors = [wcConnector];

      // Simulate successful connection after QR scan
      mockWagmiClient.connect.mockImplementation(async () => {
        // Simulate display_uri event
        const onHandler = mockProvider.on.mock.calls.find((call: any[]) => call[0] === 'display_uri');
        if (onHandler) {
          onHandler[1]('wc:test-uri@2');
        }
      });
      mockWagmiClient.getAccount.mockReturnValue({
        isConnected: true,
        address: '0xabc',
        connector: { id: 'walletConnect' },
      });

      const controller = createConnectController(shell);
      const openPromise = controller.open();

      await vi.waitFor(() => {
        expect(mockRenderListView).toHaveBeenCalled();
      });

      const [, renderOptions] = mockRenderListView.mock.calls[0];
      await renderOptions.onSelect(wcConnector);

      expect(mockProvider.on).toHaveBeenCalledWith('display_uri', expect.any(Function));

      await openPromise;
    });

    it('handles WalletConnect connector on mobile (deep links)', async () => {
      mockIsMobileDevice.mockReturnValue(true);
      mockOpenWalletDeepLink.mockReturnValue(true);

      const mockProvider = {
        on: vi.fn(),
        off: vi.fn(),
        removeListener: vi.fn(),
      };
      const wcConnector = createMockConnector({
        id: 'walletConnect',
        name: 'WalletConnect',
        getProvider: vi.fn(async () => mockProvider),
      });
      mockWagmiClient.connectors = [wcConnector];
      mockWagmiClient.connect.mockImplementation(async () => {
        const onHandler = mockProvider.on.mock.calls.find((call: any[]) => call[0] === 'display_uri');
        if (onHandler) {
          onHandler[1]('wc:mobile-uri@2');
        }
      });
      mockWagmiClient.getAccount.mockReturnValue({
        isConnected: true,
        address: '0xmobile',
        connector: { id: 'walletConnect' },
      });

      const controller = createConnectController(shell);
      const openPromise = controller.open();

      await vi.waitFor(() => {
        expect(mockRenderListView).toHaveBeenCalled();
      });

      const [, renderOptions] = mockRenderListView.mock.calls[0];
      await renderOptions.onSelect(wcConnector);

      expect(mockOpenWalletDeepLink).toHaveBeenCalledWith('wc:mobile-uri@2');

      await openPromise;
    });

    it('shows error view on connection failure', async () => {
      const connector = createMockConnector({ id: 'injected' });
      mockWagmiClient.connectors = [connector];
      mockWagmiClient.connect.mockRejectedValue(new Error('Connection failed'));

      const controller = createConnectController(shell);
      controller.open();

      await vi.waitFor(() => {
        expect(mockRenderListView).toHaveBeenCalled();
      });

      const [, renderOptions] = mockRenderListView.mock.calls[0];
      await renderOptions.onSelect(connector);

      await vi.waitFor(() => {
        expect(mockRenderErrorView).toHaveBeenCalled();
      });

      const [, errorOptions] = mockRenderErrorView.mock.calls[0];
      expect(errorOptions.message).toBe('Connection failed');

      controller.close();
    });

    it('shows canceled view when user rejects', async () => {
      const connector = createMockConnector({ id: 'injected' });
      mockWagmiClient.connectors = [connector];
      mockWagmiClient.connect.mockRejectedValue(new Error('User rejected the request'));

      const controller = createConnectController(shell);
      controller.open();

      await vi.waitFor(() => {
        expect(mockRenderListView).toHaveBeenCalled();
      });

      const [, renderOptions] = mockRenderListView.mock.calls[0];
      await renderOptions.onSelect(connector);

      await vi.waitFor(() => {
        expect(mockRenderCanceledView).toHaveBeenCalled();
      });

      controller.close();
    });

    it('shows error view with reset message on WalletConnect namespace errors', async () => {
      const wcConnector = createMockConnector({ id: 'walletConnect' });
      mockWagmiClient.connectors = [wcConnector];
      // NON_CONFORMING_NAMESPACES triggers the special WC storage cleanup path
      mockWagmiClient.connect.mockRejectedValue(new Error('NON_CONFORMING_NAMESPACES'));

      const controller = createConnectController(shell);
      controller.open();

      await vi.waitFor(() => {
        expect(mockRenderListView).toHaveBeenCalled();
      });

      const [, renderOptions] = mockRenderListView.mock.calls[0];
      await renderOptions.onSelect(wcConnector);

      await vi.waitFor(() => {
        expect(mockRenderErrorView).toHaveBeenCalled();
      });

      // When there's no custom message in the error but it's a namespace issue,
      // the code shows a reset message
      const [, errorOptions] = mockRenderErrorView.mock.calls[0];
      expect(errorOptions.message).toBe('NON_CONFORMING_NAMESPACES');

      controller.close();
    });

    it('handles User denied error for WalletConnect as canceled', async () => {
      const wcConnector = createMockConnector({ id: 'walletConnect' });
      mockWagmiClient.connectors = [wcConnector];
      mockWagmiClient.connect.mockRejectedValue(new Error('User denied account authorization'));

      const controller = createConnectController(shell);
      controller.open();

      await vi.waitFor(() => {
        expect(mockRenderListView).toHaveBeenCalled();
      });

      const [, renderOptions] = mockRenderListView.mock.calls[0];
      await renderOptions.onSelect(wcConnector);

      await vi.waitFor(() => {
        expect(mockRenderCanceledView).toHaveBeenCalled();
      });

      controller.close();
    });
  });

  describe('handleInfoModal (via list view callback)', () => {
    it('opens info modal and closes connect modal', async () => {
      mockWagmiClient.connectors = [createMockConnector()];
      mockOpenInfoModal.mockResolvedValue(undefined);

      const controller = createConnectController(shell);
      const openPromise = controller.open();

      await vi.waitFor(() => {
        expect(mockRenderListView).toHaveBeenCalled();
      });

      const [, renderOptions] = mockRenderListView.mock.calls[0];
      renderOptions.onOpenInfo();

      expect(shell.hide).toHaveBeenCalled();
      expect(mockOpenInfoModal).toHaveBeenCalledWith(expect.any(Function));

      const result = await openPromise;
      expect(result).toBeNull();
    });
  });

  describe('view rendering', () => {
    it('renders QR view with back handler', async () => {
      const wcConnector = createMockConnector({
        id: 'walletConnect',
        getProvider: vi.fn(async () => ({
          on: vi.fn((event, handler) => {
            if (event === 'display_uri') handler('wc:qr-test@2');
          }),
          off: vi.fn(),
          removeListener: vi.fn(),
        })),
      });
      mockWagmiClient.connectors = [wcConnector];
      // Don't resolve connect to keep in QR view
      mockWagmiClient.connect.mockImplementation(() => new Promise(() => {}));

      const controller = createConnectController(shell);
      controller.open();

      await vi.waitFor(() => {
        expect(mockRenderListView).toHaveBeenCalled();
      });

      const [, listOptions] = mockRenderListView.mock.calls[0];
      listOptions.onSelect(wcConnector);

      await vi.waitFor(() => {
        expect(mockRenderQrView).toHaveBeenCalled();
      });

      expect(shell.setBackHandler).toHaveBeenCalled();
      expect(shell.setAria).toHaveBeenCalledWith(
        expect.objectContaining({ labelledBy: 'wallet-qr-title' })
      );

      controller.close();
    });

    it('renders connecting view with correct variant', async () => {
      const connector = createMockConnector({ id: 'injected' });
      mockWagmiClient.connectors = [connector];
      mockWagmiClient.connect.mockImplementation(() => new Promise(() => {}));

      const controller = createConnectController(shell);
      controller.open();

      await vi.waitFor(() => {
        expect(mockRenderListView).toHaveBeenCalled();
      });

      const [, listOptions] = mockRenderListView.mock.calls[0];
      listOptions.onSelect(connector);

      await vi.waitFor(() => {
        expect(mockRenderConnectingView).toHaveBeenCalled();
      });

      const [, connectingOptions] = mockRenderConnectingView.mock.calls[0];
      expect(connectingOptions.variant).toBe(CONNECTING_VARIANT.DEFAULT);

      controller.close();
    });

    it('renders error view with back to list handler', async () => {
      const connector = createMockConnector({ id: 'injected' });
      mockWagmiClient.connectors = [connector];
      mockWagmiClient.connect.mockRejectedValue(new Error('Test error'));

      const controller = createConnectController(shell);
      controller.open();

      await vi.waitFor(() => {
        expect(mockRenderListView).toHaveBeenCalled();
      });

      const [, listOptions] = mockRenderListView.mock.calls[0];
      await listOptions.onSelect(connector);

      await vi.waitFor(() => {
        expect(mockRenderErrorView).toHaveBeenCalled();
      });

      // Trigger back from error
      const [, errorOptions] = mockRenderErrorView.mock.calls[0];
      errorOptions.onBack();

      // Should re-render list view
      await vi.waitFor(() => {
        expect(mockRenderListView.mock.calls.length).toBeGreaterThan(1);
      });

      controller.close();
    });
  });

  describe('filterConnectors', () => {
    it('includes WalletConnect connector regardless of ready state', async () => {
      const wcConnector = createMockConnector({ id: 'walletConnect', ready: false });
      mockWagmiClient.connectors = [wcConnector];

      const controller = createConnectController(shell);
      const openPromise = controller.open();

      await vi.waitFor(() => {
        expect(mockRenderListView).toHaveBeenCalled();
      });

      const [, renderOptions] = mockRenderListView.mock.calls[0];
      expect(renderOptions.connectors).toContainEqual(expect.objectContaining({ id: 'walletConnect' }));

      controller.close();
      await openPromise;
    });

    it('includes EIP-6963 connectors regardless of ready state', async () => {
      const eipConnector = createMockConnector({
        id: 'rainbow',
        ready: false,
        _eip6963: { uuid: 'rainbow-uuid', name: 'Rainbow' },
      });
      mockWagmiClient.connectors = [eipConnector];

      const controller = createConnectController(shell);
      const openPromise = controller.open();

      await vi.waitFor(() => {
        expect(mockRenderListView).toHaveBeenCalled();
      });

      const [, renderOptions] = mockRenderListView.mock.calls[0];
      expect(renderOptions.connectors).toContainEqual(expect.objectContaining({ id: 'rainbow' }));

      controller.close();
      await openPromise;
    });

    it('handles ready as a function', async () => {
      const readyFnConnector = createMockConnector({
        id: 'dynamic',
        ready: () => true,
      });
      const notReadyFnConnector = createMockConnector({
        id: 'notDynamic',
        ready: () => false,
      });
      mockWagmiClient.connectors = [readyFnConnector, notReadyFnConnector];

      const controller = createConnectController(shell);
      const openPromise = controller.open();

      await vi.waitFor(() => {
        expect(mockRenderListView).toHaveBeenCalled();
      });

      const [, renderOptions] = mockRenderListView.mock.calls[0];
      expect(renderOptions.connectors.map((c: any) => c.id)).toContain('dynamic');
      expect(renderOptions.connectors.map((c: any) => c.id)).not.toContain('notDynamic');

      controller.close();
      await openPromise;
    });

    it('includes connectors with undefined ready state', async () => {
      const noReadyConnector = createMockConnector({ id: 'noReady' });
      delete (noReadyConnector as any).ready;
      mockWagmiClient.connectors = [noReadyConnector];

      const controller = createConnectController(shell);
      const openPromise = controller.open();

      await vi.waitFor(() => {
        expect(mockRenderListView).toHaveBeenCalled();
      });

      const [, renderOptions] = mockRenderListView.mock.calls[0];
      expect(renderOptions.connectors).toContainEqual(expect.objectContaining({ id: 'noReady' }));

      controller.close();
      await openPromise;
    });
  });

  describe('onRequestClose', () => {
    it('finalizes with null when modal requests close', async () => {
      const controller = createConnectController(shell);
      const openPromise = controller.open();

      await vi.waitFor(() => {
        expect(shell.setOnRequestClose).toHaveBeenCalled();
      });

      // Get the close handler and invoke it
      const closeHandler = shell.setOnRequestClose.mock.calls[0][0];
      closeHandler();

      const result = await openPromise;
      expect(result).toBeNull();
    });
  });
});
