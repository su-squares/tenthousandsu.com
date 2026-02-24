import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SquareBlocklist } from '@billboard/blocklist/blocklist-squares.js';

const originalFetch = globalThis.fetch;

function setFetchResponse(text: string, ok = true) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok,
    text: () => Promise.resolve(text)
  });
  (globalThis as any).fetch = fetchMock;
  return fetchMock;
}

describe('blocklist-squares extra', () => {
  beforeEach(() => {
    SquareBlocklist.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (originalFetch) {
      globalThis.fetch = originalFetch;
    } else {
      delete (globalThis as any).fetch;
    }
  });

  it('clears lists when blocklist file is empty', async () => {
    SquareBlocklist.addSquare(1);
    SquareBlocklist.addTextSilencedSquare(2);

    setFetchResponse('   ');
    await SquareBlocklist.load();

    expect(SquareBlocklist.count()).toBe(0);
    expect(SquareBlocklist.isSquareTextSilenced(2)).toBe(false);
  });

  it('loads legacy range string when JSON parsing fails', async () => {
    setFetchResponse('1-2, 4');
    await SquareBlocklist.load();

    expect(SquareBlocklist.count()).toBe(3);
    expect(SquareBlocklist.isSquareBlocked(1)).toBe(true);
    expect(SquareBlocklist.isSquareBlocked(2)).toBe(true);
    expect(SquareBlocklist.isSquareBlocked(4)).toBe(true);
  });

  it('memoizes loadOnce to avoid multiple fetch calls', async () => {
    const fetchMock = setFetchResponse('[1,2,3]');

    await Promise.all([SquareBlocklist.loadOnce(), SquareBlocklist.loadOnce()]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(SquareBlocklist.count()).toBe(3);
  });
});
