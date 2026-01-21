import {
  clampToByteLength,
  sanitizeSquareInput,
} from '@assets-js/personalize-modern/table/helpers.js';

describe('clampToByteLength', () => {
  it('returns value unchanged if within byte limit', () => {
    expect(clampToByteLength('hello', 10)).toBe('hello');
    expect(clampToByteLength('test', 4)).toBe('test');
  });

  it('returns empty string for empty input', () => {
    expect(clampToByteLength('', 10)).toBe('');
  });

  it('truncates ASCII strings at byte limit', () => {
    expect(clampToByteLength('hello world', 5)).toBe('hello');
    expect(clampToByteLength('abcdef', 3)).toBe('abc');
  });

  it('handles multi-byte UTF-8 characters correctly', () => {
    // emoji is 4 bytes, so limit of 3 should exclude it
    expect(clampToByteLength('a😀b', 3)).toBe('a');
    // emoji is 4 bytes, limit of 5 allows 'a' + emoji
    expect(clampToByteLength('a😀b', 5)).toBe('a😀');
    // limit of 6 allows 'a' + emoji + 'b'
    expect(clampToByteLength('a😀b', 6)).toBe('a😀b');
  });

  it('handles Japanese characters (3 bytes each)', () => {
    // あ is 3 bytes
    expect(clampToByteLength('あいう', 3)).toBe('あ');
    expect(clampToByteLength('あいう', 6)).toBe('あい');
    expect(clampToByteLength('あいう', 9)).toBe('あいう');
  });

  it('does not split multi-byte characters', () => {
    // 2-byte limit cannot fit a 3-byte character
    expect(clampToByteLength('あ', 2)).toBe('');
    // 3-byte limit cannot fit a 4-byte emoji
    expect(clampToByteLength('😀', 3)).toBe('');
  });

  it('handles mixed ASCII and multi-byte', () => {
    expect(clampToByteLength('hi あ', 4)).toBe('hi ');
    expect(clampToByteLength('hi あ', 6)).toBe('hi あ');
  });
});

describe('sanitizeSquareInput', () => {
  it('allows numeric input', () => {
    expect(sanitizeSquareInput('123')).toBe('123');
    expect(sanitizeSquareInput('99999')).toBe('99999');
  });

  it('removes non-digit characters', () => {
    expect(sanitizeSquareInput('12abc34')).toBe('1234');
    expect(sanitizeSquareInput('a1b2c3')).toBe('123');
    expect(sanitizeSquareInput('--123--')).toBe('123');
  });

  it('truncates to max digits (5)', () => {
    expect(sanitizeSquareInput('123456')).toBe('12345');
    expect(sanitizeSquareInput('9999999')).toBe('99999');
  });

  it('handles empty input', () => {
    expect(sanitizeSquareInput('')).toBe('');
  });

  it('handles input with no digits', () => {
    expect(sanitizeSquareInput('abc')).toBe('');
    expect(sanitizeSquareInput('---')).toBe('');
  });

  it('handles leading zeros', () => {
    expect(sanitizeSquareInput('00123')).toBe('00123');
  });
});
