import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createMockEIP6963Provider } from '@fixtures/eip6963';
import {
  startEIP6963Discovery,
  getDiscoveredProviders,
  onProvidersChanged,
  waitForProviders
} from '@web3/wallet/eip6963.js';

describe('wallet/eip6963.js', () => {
  beforeEach(() => {
    getDiscoveredProviders().clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('captures announced providers', () => {
    startEIP6963Discovery();

    const provider = createMockEIP6963Provider();
    window.dispatchEvent(new CustomEvent('eip6963:announceProvider', { detail: provider }));

    const providers = getDiscoveredProviders();
    expect(providers.size).toBe(1);
    expect(providers.get(provider.info.uuid)?.info.name).toBe(provider.info.name);
  });

  it('invokes onProvidersChanged immediately when providers exist', () => {
    startEIP6963Discovery();

    const provider = createMockEIP6963Provider();
    window.dispatchEvent(new CustomEvent('eip6963:announceProvider', { detail: provider }));

    const callback = vi.fn();
    const unsubscribe = onProvidersChanged(callback);

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback.mock.calls[0][0].size).toBe(1);

    unsubscribe();
  });

  it('waitForProviders resolves after timeout when empty', async () => {
    vi.useFakeTimers();

    const promise = waitForProviders(200);
    await vi.advanceTimersByTimeAsync(200);
    const result = await promise;

    expect(result.size).toBe(0);
  });
});
