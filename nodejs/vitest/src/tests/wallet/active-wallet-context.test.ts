import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { foundationMocks, resetFoundationMocks } from '@mocks/foundation';
import { spyOnEvent } from '@mocks/events';

const configState = {
  activeNetwork: { chainId: 1, label: 'Ethereum' }
};

vi.mock('@web3/config/index.js', () => ({
  getWeb3Config: () => configState
}));

import {
  initActiveWalletContext,
  activateWalletContext,
  getActiveWalletContext,
  hasActiveWallet,
  getActiveWalletBalance,
  destroyActiveWalletContext,
  WALLET_CONTEXT_CHANGE_EVENT
} from '@web3/wallet/active-wallet-context.js';

describe('wallet/active-wallet-context.js', () => {
  beforeEach(() => {
    resetFoundationMocks();
    destroyActiveWalletContext();
  });

  afterEach(() => {
    destroyActiveWalletContext();
    vi.clearAllMocks();
  });

  it('skips wagmi load when no persisted connection', async () => {
    foundationMocks.shouldEagerLoadWeb3.mockReturnValue(false);
    foundationMocks.loadWeb3.mockResolvedValue({});

    const result = await initActiveWalletContext();

    expect(foundationMocks.loadWeb3).not.toHaveBeenCalled();
    expect(result.address).toBeNull();
    expect(result.isConnected).toBe(false);
  });

  it('emits context changes when account updates', async () => {
    let accountState = {
      address: '0x1234567890123456789012345678901234567890',
      isConnected: true
    };
    let accountCallback: (() => void) | undefined;

    const wagmi = {
      getAccount: () => accountState,
      watchAccount: vi.fn((callback: () => void) => {
        accountCallback = callback;
        return vi.fn();
      }),
      watchNetwork: vi.fn(() => vi.fn())
    };

    foundationMocks.shouldEagerLoadWeb3.mockReturnValue(true);
    foundationMocks.loadWeb3.mockResolvedValue(wagmi);

    const events = spyOnEvent(WALLET_CONTEXT_CHANGE_EVENT);

    await initActiveWalletContext();

    expect(events.events.length).toBe(1);
    expect(getActiveWalletContext().address).toBe(accountState.address);

    accountState = {
      address: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
      isConnected: true
    };
    if (accountCallback) {
      accountCallback();
    }

    expect(events.events.length).toBe(2);
    expect(getActiveWalletContext().address).toBe(accountState.address);

    events.cleanup();
  });

  it('activateWalletContext sets the current wallet state', () => {
    const wagmi = {
      getAccount: () => ({
        address: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        isConnected: true
      }),
      watchAccount: vi.fn(() => vi.fn()),
      watchNetwork: vi.fn(() => vi.fn())
    };

    activateWalletContext(wagmi);

    expect(getActiveWalletContext().address).toBe('0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
    expect(hasActiveWallet()).toBe(true);
  });

  it('returns null balance when no wallet is active', async () => {
    destroyActiveWalletContext();

    const result = await getActiveWalletBalance();

    expect(result).toEqual({ balance: null, source: 'cache' });
  });
});
