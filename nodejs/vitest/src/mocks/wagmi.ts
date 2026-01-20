import { vi } from 'vitest';

export interface MockWagmiClient {
  config: any;
  chains: any[];
  connectors: any[];
  watchAccount: ReturnType<typeof vi.fn>;
  watchNetwork: ReturnType<typeof vi.fn>;
  connect: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
  fetchBalance: ReturnType<typeof vi.fn>;
  fetchEnsName: ReturnType<typeof vi.fn>;
  fetchEnsAvatar: ReturnType<typeof vi.fn>;
  switchNetwork: ReturnType<typeof vi.fn>;
  writeContract: ReturnType<typeof vi.fn>;
  waitForTransaction: ReturnType<typeof vi.fn>;
  getNetwork: ReturnType<typeof vi.fn>;
  getAccount: ReturnType<typeof vi.fn>;
  WalletConnectConnector: any;
}

let mockWagmiClient: MockWagmiClient | null = null;

export function createMockWagmiClient(): MockWagmiClient {
  return {
    config: { chains: [] },
    chains: [],
    connectors: [],
    watchAccount: vi.fn((callback) => {
      return vi.fn();
    }),
    watchNetwork: vi.fn((callback) => {
      return vi.fn();
    }),
    connect: vi.fn(),
    disconnect: vi.fn(),
    fetchBalance: vi.fn(async ({ address, chainId }) => ({
      decimals: 18,
      formatted: '1.234567',
      symbol: 'ETH',
      value: BigInt('1234567000000000000')
    })),
    fetchEnsName: vi.fn(),
    fetchEnsAvatar: vi.fn(),
    switchNetwork: vi.fn(),
    writeContract: vi.fn(),
    waitForTransaction: vi.fn(),
    getNetwork: vi.fn(() => ({ chain: { id: 1 } })),
    getAccount: vi.fn(() => ({
      address: '0x1234567890123456789012345678901234567890',
      isConnected: false
    })),
    WalletConnectConnector: vi.fn()
  };
}

export function getMockWagmiClient(): MockWagmiClient {
  if (!mockWagmiClient) {
    mockWagmiClient = createMockWagmiClient();
  }
  return mockWagmiClient;
}

export function resetAllMocks() {
  mockWagmiClient = null;
}

export function mockWagmiClientLoader() {
  vi.mock('@web3/client/wagmi.js', () => ({
    loadWagmiClient: vi.fn(async () => getMockWagmiClient()),
    truncateAddress: vi.fn((address: string) => {
      if (!address) return '';
      return `${address.slice(0, 6)}…${address.slice(-4)}`;
    }),
    MAINNET_CHAIN_ID: 1,
    SEPOLIA_CHAIN_ID: 11155111
  }));
}
