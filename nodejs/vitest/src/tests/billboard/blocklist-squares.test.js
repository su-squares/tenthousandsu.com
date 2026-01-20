
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { SquareBlocklist } from '@billboard/blocklist/blocklist-squares.js';

describe('blocklist-squares', () => {
  beforeEach(() => {
    SquareBlocklist.clear();
    // Mock global fetch
    global.fetch = vi.fn();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should start empty', () => {
    expect(SquareBlocklist.count()).toBe(0);
    expect(SquareBlocklist.isSquareBlocked(1)).toBe(false);
  });

  it('should add single square', () => {
    SquareBlocklist.addSquare(10);
    expect(SquareBlocklist.isSquareBlocked(10)).toBe(true);
    expect(SquareBlocklist.isSquareBlocked(11)).toBe(false);
    expect(SquareBlocklist.count()).toBe(1);
  });

  it('should add multiple squares', () => {
    SquareBlocklist.addSquares([1, 2, 3]);
    expect(SquareBlocklist.count()).toBe(3);
    expect(SquareBlocklist.isSquareBlocked(2)).toBe(true);
  });

  it('should add range string', () => {
    SquareBlocklist.addRange('1-3, 5');
    expect(SquareBlocklist.count()).toBe(4); // 1, 2, 3, 5
    expect(SquareBlocklist.isSquareBlocked(2)).toBe(true);
    expect(SquareBlocklist.isSquareBlocked(4)).toBe(false);
    expect(SquareBlocklist.isSquareBlocked(5)).toBe(true);
  });

  it('should remove square', () => {
    SquareBlocklist.addSquare(1);
    SquareBlocklist.removeSquare(1);
    expect(SquareBlocklist.isSquareBlocked(1)).toBe(false);
    expect(SquareBlocklist.count()).toBe(0);
  });

  it('should handle text silenced squares', () => {
    SquareBlocklist.addTextSilencedSquare(42);
    expect(SquareBlocklist.isSquareTextSilenced(42)).toBe(true);
    expect(SquareBlocklist.isSquareBlocked(42)).toBe(false); // Should not be blocked
  });

  describe('load', () => {
    it('should load simple array JSON', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve('[1, 2, 3]')
      });

      await SquareBlocklist.load();
      
      expect(SquareBlocklist.count()).toBe(3);
      expect(SquareBlocklist.isSquareBlocked(1)).toBe(true);
    });

    it('should load object JSON with blocked and silenced', async () => {
      const data = {
        blocked: "1-2",
        textSilenced: [10]
      };
      
      global.fetch.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(data))
      });

      await SquareBlocklist.load();
      
      expect(SquareBlocklist.isSquareBlocked(1)).toBe(true);
      expect(SquareBlocklist.isSquareBlocked(2)).toBe(true);
      expect(SquareBlocklist.isSquareBlocked(10)).toBe(false);
      expect(SquareBlocklist.isSquareTextSilenced(10)).toBe(true);
    });

    it('should handle fetch error gracefully', async () => {
      global.fetch.mockResolvedValue({
        ok: false,
        status: 404
      });

      await SquareBlocklist.load();
      // Should not crash, just remain empty
      expect(SquareBlocklist.count()).toBe(0);
    });
  });
});
