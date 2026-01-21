import { parseCsvBatchText } from '@assets-js/personalize-modern/batch/csv.js';

const MAX_SQUARE_ID = 10000;

function isValidSquareId(value: unknown): boolean {
  return Number.isInteger(value) && (value as number) >= 1 && (value as number) <= MAX_SQUARE_ID;
}

function makeOptions(overrides: Record<string, unknown> = {}) {
  return {
    isValidSquareId,
    ownershipReady: false,
    ownedSquares: null,
    titleMax: 64,
    uriMax: 96,
    ...overrides,
  };
}

describe('parseCsvBatchText', () => {
  describe('empty input', () => {
    it('returns empty=true for empty string', () => {
      const result = parseCsvBatchText('', makeOptions());

      expect(result.empty).toBe(true);
      expect(result.hasErrors).toBe(true);
      expect(result.batchMap.size).toBe(0);
    });

    it('returns empty=true for whitespace-only input', () => {
      const result = parseCsvBatchText('   \n  \n  ', makeOptions());

      expect(result.empty).toBe(true);
    });
  });

  describe('header detection', () => {
    it('skips header row with square/title columns', () => {
      const csv = 'square_id,title,uri\n1,Hello,https://example.com';
      const result = parseCsvBatchText(csv, makeOptions());

      expect(result.batchMap.size).toBe(1);
      expect(result.batchMap.get(1)).toEqual({
        title: 'Hello',
        uri: 'https://example.com',
      });
    });

    it('skips header with id/url columns', () => {
      const csv = 'id,title,url\n42,Test,https://test.com';
      const result = parseCsvBatchText(csv, makeOptions());

      expect(result.batchMap.size).toBe(1);
      expect(result.batchMap.get(42)).toBeDefined();
    });

    it('does not skip row if no header pattern detected', () => {
      const csv = '1,Title One,https://one.com\n2,Title Two,https://two.com';
      const result = parseCsvBatchText(csv, makeOptions());

      expect(result.batchMap.size).toBe(2);
    });
  });

  describe('delimiter detection', () => {
    it('parses comma-separated values', () => {
      const csv = '1,Title,https://example.com';
      const result = parseCsvBatchText(csv, makeOptions());

      expect(result.batchMap.get(1)).toEqual({
        title: 'Title',
        uri: 'https://example.com',
      });
    });

    it('parses tab-separated values', () => {
      const tsv = '1\tTitle\thttps://example.com';
      const result = parseCsvBatchText(tsv, makeOptions());

      expect(result.batchMap.get(1)).toEqual({
        title: 'Title',
        uri: 'https://example.com',
      });
    });
  });

  describe('square ID normalization', () => {
    it('normalizes leading zeros', () => {
      const csv = '00001,Title,https://example.com';
      const result = parseCsvBatchText(csv, makeOptions());

      expect(result.batchMap.has(1)).toBe(true);
      expect(result.batchMap.has(1)).toBe(true);
    });

    it('handles maximum square ID', () => {
      const csv = '10000,Title,https://example.com';
      const result = parseCsvBatchText(csv, makeOptions());

      expect(result.batchMap.has(10000)).toBe(true);
    });
  });

  describe('validation errors', () => {
    it('reports missing columns', () => {
      const csv = 'square_id,title,uri\n1,Only Title';
      const result = parseCsvBatchText(csv, makeOptions());

      expect(result.errors.missingColumns).toContain('Row 2');
      expect(result.hasErrors).toBe(true);
    });

    it('reports missing square with data', () => {
      const csv = ',Some Title,https://example.com';
      const result = parseCsvBatchText(csv, makeOptions());

      expect(result.errors.missingSquare).toContain('Row 1');
    });

    it('reports non-numeric square as missing (not invalid)', () => {
      // 'abc' normalizes to null, so with title/uri it's "missing square"
      const csv = 'abc,Title,https://example.com';
      const result = parseCsvBatchText(csv, makeOptions());

      expect(result.errors.missingSquare).toContain('Row 1');
    });

    it('reports invalid square when only square text present', () => {
      // Non-numeric with no title/uri goes to invalidSquare
      const csv = 'abc,,';
      const result = parseCsvBatchText(csv, makeOptions());

      expect(result.errors.invalidSquare).toContain('Row 1');
    });

    it('reports square ID out of range', () => {
      const csv = '10001,Title,https://example.com';
      const result = parseCsvBatchText(csv, makeOptions());

      expect(result.errors.invalidSquare).toContain('Row 1');
    });

    it('reports duplicate squares', () => {
      const csv = '1,First,https://first.com\n1,Second,https://second.com';
      const result = parseCsvBatchText(csv, makeOptions());

      expect(result.errors.duplicateSquares).toContain('#1');
      expect(result.hasErrors).toBe(true);
    });

    it('reports title too long', () => {
      const longTitle = 'a'.repeat(65);
      const csv = `1,${longTitle},https://example.com`;
      const result = parseCsvBatchText(csv, makeOptions({ titleMax: 64 }));

      expect(result.errors.titleTooLong).toContain('#1');
    });

    it('reports URI too long', () => {
      const longUri = 'https://example.com/' + 'a'.repeat(100);
      const csv = `1,Title,${longUri}`;
      const result = parseCsvBatchText(csv, makeOptions({ uriMax: 96 }));

      expect(result.errors.uriTooLong).toContain('#1');
    });

    it('reports not owned squares when ownership ready', () => {
      const csv = '1,Title,https://example.com\n2,Other,https://other.com';
      const ownedSquares = new Set([1]);
      const result = parseCsvBatchText(
        csv,
        makeOptions({ ownershipReady: true, ownedSquares })
      );

      expect(result.errors.notOwned).toContain('#2');
      expect(result.errors.notOwned).not.toContain('#1');
    });
  });

  describe('batch map output', () => {
    it('creates patch with title and uri', () => {
      const csv = '1,My Title,https://mysite.com';
      const result = parseCsvBatchText(csv, makeOptions());

      expect(result.batchMap.get(1)).toEqual({
        title: 'My Title',
        uri: 'https://mysite.com',
      });
    });

    it('creates patch with only title when uri empty', () => {
      const csv = '1,My Title,';
      const result = parseCsvBatchText(csv, makeOptions());

      expect(result.batchMap.get(1)).toEqual({ title: 'My Title' });
    });

    it('creates patch with only uri when title empty', () => {
      const csv = '1,,https://mysite.com';
      const result = parseCsvBatchText(csv, makeOptions());

      expect(result.batchMap.get(1)).toEqual({ uri: 'https://mysite.com' });
    });

    it('overwrites duplicate square entries with last value', () => {
      const csv = '1,First,https://first.com\n1,Second,https://second.com';
      const result = parseCsvBatchText(csv, makeOptions());

      expect(result.batchMap.get(1)).toEqual({
        title: 'Second',
        uri: 'https://second.com',
      });
    });

    it('parses multiple valid rows', () => {
      const csv = '1,One,https://one.com\n2,Two,https://two.com\n3,Three,https://three.com';
      const result = parseCsvBatchText(csv, makeOptions());

      expect(result.batchMap.size).toBe(3);
      expect(result.hasErrors).toBe(false);
      expect(result.empty).toBe(false);
    });
  });

  describe('quoted values', () => {
    it('handles quoted fields with commas', () => {
      const csv = '1,"Hello, World",https://example.com';
      const result = parseCsvBatchText(csv, makeOptions());

      expect(result.batchMap.get(1)?.title).toBe('Hello, World');
    });

    it('handles escaped quotes in fields', () => {
      const csv = '1,"Say ""Hello""",https://example.com';
      const result = parseCsvBatchText(csv, makeOptions());

      expect(result.batchMap.get(1)?.title).toBe('Say "Hello"');
    });

    it('handles newlines in quoted fields', () => {
      const csv = '1,"Line1\nLine2",https://example.com';
      const result = parseCsvBatchText(csv, makeOptions());

      expect(result.batchMap.get(1)?.title).toBe('Line1\nLine2');
    });
  });

  describe('line endings', () => {
    it('handles Unix line endings (LF)', () => {
      const csv = '1,One,https://one.com\n2,Two,https://two.com';
      const result = parseCsvBatchText(csv, makeOptions());

      expect(result.batchMap.size).toBe(2);
    });

    it('handles Windows line endings (CRLF)', () => {
      const csv = '1,One,https://one.com\r\n2,Two,https://two.com';
      const result = parseCsvBatchText(csv, makeOptions());

      expect(result.batchMap.size).toBe(2);
    });

    it('handles old Mac line endings (CR)', () => {
      const csv = '1,One,https://one.com\r2,Two,https://two.com';
      const result = parseCsvBatchText(csv, makeOptions());

      expect(result.batchMap.size).toBe(2);
    });
  });

  describe('byte length validation', () => {
    it('counts multi-byte unicode characters correctly', () => {
      // Each emoji is 4 bytes in UTF-8
      const emojiTitle = '\u{1F600}'.repeat(17); // 17 emojis = 68 bytes
      const csv = `1,${emojiTitle},https://example.com`;
      const result = parseCsvBatchText(csv, makeOptions({ titleMax: 64 }));

      expect(result.errors.titleTooLong).toContain('#1');
    });

    it('allows title at exact byte limit', () => {
      const title = 'a'.repeat(64);
      const csv = `1,${title},https://example.com`;
      const result = parseCsvBatchText(csv, makeOptions({ titleMax: 64 }));

      expect(result.errors.titleTooLong).toHaveLength(0);
    });
  });
});
