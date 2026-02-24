import { vi } from 'vitest';
import {
  getEnsName,
  getCachedEnsName,
  clearAllEnsCache,
  ENS_CACHE_TTL_MS
} from '@web3/wallet/ens-store.js';

describe('wallet/ens-store.js', () => {
  afterEach(() => {
    clearAllEnsCache();
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('returns cached ENS names when fresh', async () => {
    const fetcher = vi.fn(async () => 'vitalik.eth');
    const address = '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045';
    const chainId = 1;

    const first = await getEnsName({ address, chainId, fetcher });
    const second = await getEnsName({ address, chainId, fetcher });

    expect(first.source).toBe('fresh');
    expect(second.source).toBe('cache');
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(getCachedEnsName(address, chainId)).toBe('vitalik.eth');
  });

  it('drops stale entries from localStorage', () => {
    const address = '0x1234567890123456789012345678901234567890';
    const chainId = 1;
    const key = `su-ens:${chainId}:${address.toLowerCase()}`;
    const staleEntry = {
      name: 'old.eth',
      fetchedAt: Date.now() - ENS_CACHE_TTL_MS - 1
    };

    localStorage.setItem(key, JSON.stringify(staleEntry));

    const name = getCachedEnsName(address, chainId);

    expect(name).toBeNull();
    expect(localStorage.getItem(key)).toBeNull();
  });

  it('dedupes in-flight ENS lookups', async () => {
    let resolveFetch!: (value: string | null) => void;
    const fetcher = vi.fn(() => new Promise<string | null>((resolve) => {
      resolveFetch = resolve;
    }));
    const address = '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd';
    const chainId = 1;

    const promiseOne = getEnsName({ address, chainId, fetcher });
    const promiseTwo = getEnsName({ address, chainId, fetcher });

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(promiseTwo).toBe(promiseOne);

    resolveFetch('ens-name.eth');

    const result = await promiseOne;
    expect(result.name).toBe('ens-name.eth');
  });
});
