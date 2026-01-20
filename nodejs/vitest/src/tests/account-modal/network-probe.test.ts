import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mockWeb3Config, clearWeb3Config, resetConfigModule } from '@test-helpers/config';
import { MOCK_CONTRACT_ADDRESSES } from '@fixtures/contracts';

describe('account-modal/network-probe.js', () => {
  let shouldProbeNetworkAvailability: () => boolean;
  let probeNetworkAvailable: (wagmi: any) => Promise<{ available: boolean; error?: any }>;

  beforeEach(async () => {
    clearWeb3Config();
    await resetConfigModule();
  });

  afterEach(() => {
    clearWeb3Config();
    vi.restoreAllMocks();
  });

  async function loadModule() {
    const module = await import('@web3/wallet/account-modal/network-probe.js');
    shouldProbeNetworkAvailability = module.shouldProbeNetworkAvailability;
    probeNetworkAvailable = module.probeNetworkAvailable;
  }

  describe('shouldProbeNetworkAvailability()', () => {
    it('should return true when activeNetwork is sunet', async () => {
      mockWeb3Config({
        chain: 'sunet',
        sunetPrimaryAddress: MOCK_CONTRACT_ADDRESSES.sunet.primary,
        sunetUnderlayAddress: MOCK_CONTRACT_ADDRESSES.sunet.underlay,
      });
      await resetConfigModule();
      await loadModule();

      const result = shouldProbeNetworkAvailability();

      expect(result).toBe(true);
    });

    it('should return false when activeNetwork is mainnet', async () => {
      mockWeb3Config({ chain: 'mainnet' });
      await resetConfigModule();
      await loadModule();

      const result = shouldProbeNetworkAvailability();

      expect(result).toBe(false);
    });

    it('should return false when activeNetwork is sepolia', async () => {
      mockWeb3Config({
        chain: 'sepolia',
        sepoliaPrimaryAddress: MOCK_CONTRACT_ADDRESSES.sepolia.primary,
        sepoliaUnderlayAddress: MOCK_CONTRACT_ADDRESSES.sepolia.underlay,
      });
      await resetConfigModule();
      await loadModule();

      const result = shouldProbeNetworkAvailability();

      expect(result).toBe(false);
    });

    it('should return false when no chain specified (defaults to mainnet)', async () => {
      mockWeb3Config({});
      await resetConfigModule();
      await loadModule();

      const result = shouldProbeNetworkAvailability();

      expect(result).toBe(false);
    });
  });

  describe('probeNetworkAvailable()', () => {
    describe('when probing is not needed (non-sunet chain)', () => {
      it('should return available: true without probing', async () => {
        mockWeb3Config({ chain: 'mainnet' });
        await resetConfigModule();
        await loadModule();

        const mockWagmi = {
          getAccount: vi.fn(),
        };

        const result = await probeNetworkAvailable(mockWagmi);

        expect(result).toEqual({ available: true });
        expect(mockWagmi.getAccount).not.toHaveBeenCalled();
      });
    });

    describe('when sunet chain (probing required)', () => {
      beforeEach(async () => {
        mockWeb3Config({
          chain: 'sunet',
          sunetPrimaryAddress: MOCK_CONTRACT_ADDRESSES.sunet.primary,
          sunetUnderlayAddress: MOCK_CONTRACT_ADDRESSES.sunet.underlay,
        });
        await resetConfigModule();
        await loadModule();
      });

      describe('WalletConnect connector', () => {
        it('should return available: true when chain is in approved chains', async () => {
          const mockProvider = {
            session: {
              namespaces: {
                eip155: {
                  chains: ['eip155:1', 'eip155:99999991'],
                },
              },
            },
          };

          const mockWagmi = {
            getAccount: vi.fn().mockReturnValue({
              connector: {
                id: 'walletConnect',
                getProvider: vi.fn().mockResolvedValue(mockProvider),
              },
            }),
          };

          const result = await probeNetworkAvailable(mockWagmi);

          expect(result).toEqual({ available: true });
        });

        it('should return available: false when chain is NOT in approved chains', async () => {
          const mockProvider = {
            session: {
              namespaces: {
                eip155: {
                  chains: ['eip155:1', 'eip155:137'], // mainnet, polygon - not sunet
                },
              },
            },
          };

          const mockWagmi = {
            getAccount: vi.fn().mockReturnValue({
              connector: {
                id: 'walletConnect',
                getProvider: vi.fn().mockResolvedValue(mockProvider),
              },
            }),
          };

          const result = await probeNetworkAvailable(mockWagmi);

          expect(result).toEqual({ available: false });
        });

        it('should return available: false when session has empty approved chains', async () => {
          const mockProvider = {
            session: {
              namespaces: {
                eip155: {
                  chains: [],
                },
              },
            },
          };

          const mockWagmi = {
            getAccount: vi.fn().mockReturnValue({
              connector: {
                id: 'walletConnect',
                getProvider: vi.fn().mockResolvedValue(mockProvider),
              },
            }),
          };

          const result = await probeNetworkAvailable(mockWagmi);

          expect(result).toEqual({ available: false });
        });

        it('should return available: false when WC session check fails', async () => {
          const mockWagmi = {
            getAccount: vi.fn().mockReturnValue({
              connector: {
                id: 'walletConnect',
                getProvider: vi.fn().mockRejectedValue(new Error('Session unavailable')),
              },
            }),
          };

          const result = await probeNetworkAvailable(mockWagmi);

          expect(result).toEqual({ available: false });
        });

        it('should return available: false when session namespaces are missing', async () => {
          const mockProvider = {
            session: {},
          };

          const mockWagmi = {
            getAccount: vi.fn().mockReturnValue({
              connector: {
                id: 'walletConnect',
                getProvider: vi.fn().mockResolvedValue(mockProvider),
              },
            }),
          };

          const result = await probeNetworkAvailable(mockWagmi);

          expect(result).toEqual({ available: false });
        });
      });

      describe('Injected provider', () => {
        it('should return available: true when wallet_switchEthereumChain succeeds', async () => {
          const mockProvider = {
            request: vi.fn().mockResolvedValue(null),
          };

          const mockWagmi = {
            getAccount: vi.fn().mockReturnValue({
              connector: {
                id: 'injected',
                getProvider: vi.fn().mockResolvedValue(mockProvider),
              },
            }),
          };

          const result = await probeNetworkAvailable(mockWagmi);

          expect(result).toEqual({ available: true });
          expect(mockProvider.request).toHaveBeenCalledWith({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: '0x5f5e0f7' }], // 99999991 in hex
          });
        });

        it('should return available: false when error code is 4902 (chain not added)', async () => {
          const mockError = new Error('Chain not added') as Error & { code: number };
          mockError.code = 4902;

          const mockProvider = {
            request: vi.fn().mockRejectedValue(mockError),
          };

          const mockWagmi = {
            getAccount: vi.fn().mockReturnValue({
              connector: {
                id: 'injected',
                getProvider: vi.fn().mockResolvedValue(mockProvider),
              },
            }),
          };

          const result = await probeNetworkAvailable(mockWagmi);

          expect(result).toEqual({ available: false });
        });

        it('should return available: true when error code is 4001 (user rejected - but chain exists)', async () => {
          const mockError = new Error('User rejected') as Error & { code: number };
          mockError.code = 4001;

          const mockProvider = {
            request: vi.fn().mockRejectedValue(mockError),
          };

          const mockWagmi = {
            getAccount: vi.fn().mockReturnValue({
              connector: {
                id: 'injected',
                getProvider: vi.fn().mockResolvedValue(mockProvider),
              },
            }),
          };

          const result = await probeNetworkAvailable(mockWagmi);

          expect(result).toEqual({ available: true });
        });

        it('should return available: false when error message contains "unrecognized chain"', async () => {
          const mockError = new Error('Unrecognized chain ID');

          const mockProvider = {
            request: vi.fn().mockRejectedValue(mockError),
          };

          const mockWagmi = {
            getAccount: vi.fn().mockReturnValue({
              connector: {
                id: 'injected',
                getProvider: vi.fn().mockResolvedValue(mockProvider),
              },
            }),
          };

          const result = await probeNetworkAvailable(mockWagmi);

          expect(result).toEqual({ available: false });
        });

        it('should return available: false when error message contains "try adding"', async () => {
          const mockError = new Error('Try adding the chain first');

          const mockProvider = {
            request: vi.fn().mockRejectedValue(mockError),
          };

          const mockWagmi = {
            getAccount: vi.fn().mockReturnValue({
              connector: {
                id: 'injected',
                getProvider: vi.fn().mockResolvedValue(mockProvider),
              },
            }),
          };

          const result = await probeNetworkAvailable(mockWagmi);

          expect(result).toEqual({ available: false });
        });

        it('should return available: true when error message contains "user rejected"', async () => {
          const mockError = new Error('User rejected the request');

          const mockProvider = {
            request: vi.fn().mockRejectedValue(mockError),
          };

          const mockWagmi = {
            getAccount: vi.fn().mockReturnValue({
              connector: {
                id: 'injected',
                getProvider: vi.fn().mockResolvedValue(mockProvider),
              },
            }),
          };

          const result = await probeNetworkAvailable(mockWagmi);

          expect(result).toEqual({ available: true });
        });

        it('should return available: false with error for unknown errors', async () => {
          const mockError = new Error('Unknown wallet error');

          const mockProvider = {
            request: vi.fn().mockRejectedValue(mockError),
          };

          const mockWagmi = {
            getAccount: vi.fn().mockReturnValue({
              connector: {
                id: 'injected',
                getProvider: vi.fn().mockResolvedValue(mockProvider),
              },
            }),
          };

          const result = await probeNetworkAvailable(mockWagmi);

          expect(result.available).toBe(false);
          expect(result.error).toBe(mockError);
        });
      });

      describe('edge cases', () => {
        it('should return available: false when connector has no getProvider', async () => {
          const mockWagmi = {
            getAccount: vi.fn().mockReturnValue({
              connector: {
                id: 'injected',
                // no getProvider method
              },
            }),
          };

          const result = await probeNetworkAvailable(mockWagmi);

          expect(result).toEqual({ available: false });
        });

        it('should return available: false when provider has no request method', async () => {
          const mockWagmi = {
            getAccount: vi.fn().mockReturnValue({
              connector: {
                id: 'injected',
                getProvider: vi.fn().mockResolvedValue({}), // empty provider
              },
            }),
          };

          const result = await probeNetworkAvailable(mockWagmi);

          expect(result).toEqual({ available: false });
        });

        it('should return available: false when wagmi.getAccount throws', async () => {
          const mockWagmi = {
            getAccount: vi.fn().mockImplementation(() => {
              throw new Error('Not connected');
            }),
          };

          const result = await probeNetworkAvailable(mockWagmi);

          expect(result.available).toBe(false);
          expect(result.error).toBeDefined();
        });

        it('should handle undefined wagmi gracefully', async () => {
          const result = await probeNetworkAvailable(undefined as any);

          expect(result.available).toBe(false);
        });

        it('should handle null account connector', async () => {
          const mockWagmi = {
            getAccount: vi.fn().mockReturnValue({
              connector: null,
            }),
          };

          const result = await probeNetworkAvailable(mockWagmi);

          expect(result).toEqual({ available: false });
        });
      });
    });
  });
});
