import { vi } from 'vitest';

vi.mock('@assets-js/personalize-modern/store.js', () => ({
  isValidSquareId: (id: unknown) =>
    Number.isInteger(id) && (id as number) >= 1 && (id as number) <= 10000,
}));

import {
  buildPreviewRows,
  buildErrorMap,
  getSelectedSquares,
} from '@assets-js/personalize-modern/billboard/preview.js';

interface RowErrors {
  title?: string;
  uri?: string;
  image?: string;
}

interface TestRow {
  squareId: number;
  title?: string;
  uri?: string;
  imagePreviewUrl?: string;
  imagePixelsHex?: string;
  errors?: RowErrors;
}

function makeRow(overrides: Partial<TestRow> = {}): TestRow {
  return {
    squareId: 1,
    title: '',
    uri: '',
    ...overrides,
  };
}

describe('getSelectedSquares', () => {
  it('returns empty set for empty rows', () => {
    const result = getSelectedSquares([]);
    expect(result.size).toBe(0);
  });

  it('extracts unique square IDs', () => {
    const rows = [makeRow({ squareId: 1 }), makeRow({ squareId: 2 }), makeRow({ squareId: 1 })];
    const result = getSelectedSquares(rows);

    expect(result.size).toBe(2);
    expect(result.has(1)).toBe(true);
    expect(result.has(2)).toBe(true);
  });

  it('filters out invalid square IDs', () => {
    const rows = [
      makeRow({ squareId: 1 }),
      makeRow({ squareId: 0 }),
      makeRow({ squareId: -1 }),
      makeRow({ squareId: 10001 }),
    ];
    const result = getSelectedSquares(rows);

    expect(result.size).toBe(1);
    expect(result.has(1)).toBe(true);
  });
});

describe('buildPreviewRows', () => {
  it('returns empty map for empty rows', () => {
    const result = buildPreviewRows([]);
    expect(result.size).toBe(0);
  });

  it('builds preview data for single row', () => {
    const rows = [
      makeRow({
        squareId: 42,
        title: 'Test Title',
        uri: 'https://example.com',
      }),
    ];
    const result = buildPreviewRows(rows);

    expect(result.size).toBe(1);
    expect(result.get(42)).toEqual({
      title: 'Test Title',
      uri: 'https://example.com',
      imagePreviewUrl: undefined,
      imagePixelsHex: undefined,
      hasErrors: false,
      errorText: '',
    });
  });

  it('includes image data when present', () => {
    const rows = [
      makeRow({
        squareId: 1,
        imagePreviewUrl: 'data:image/png;base64,abc',
        imagePixelsHex: '0xffffff',
      }),
    ];
    const result = buildPreviewRows(rows);

    expect(result.get(1)?.imagePreviewUrl).toBe('data:image/png;base64,abc');
    expect(result.get(1)?.imagePixelsHex).toBe('0xffffff');
  });

  it('detects errors in row', () => {
    const rows = [
      makeRow({
        squareId: 1,
        errors: { title: 'Title too long' },
      }),
    ];
    const result = buildPreviewRows(rows);

    expect(result.get(1)?.hasErrors).toBe(true);
    expect(result.get(1)?.errorText).toBe('Title too long');
  });

  it('filters out invalid square IDs', () => {
    const rows = [makeRow({ squareId: 0 }), makeRow({ squareId: 10001 })];
    const result = buildPreviewRows(rows);

    expect(result.size).toBe(0);
  });

  describe('chooseBestRow priority', () => {
    it('prefers row with no errors AND image over others', () => {
      const rows = [
        makeRow({ squareId: 1, title: 'Has Error', errors: { title: 'Error' } }),
        makeRow({ squareId: 1, title: 'No Error No Image' }),
        makeRow({
          squareId: 1,
          title: 'No Error With Image',
          imagePreviewUrl: 'url',
          imagePixelsHex: '0x000',
        }),
      ];
      const result = buildPreviewRows(rows);

      expect(result.get(1)?.title).toBe('No Error With Image');
    });

    it('prefers row with no errors over row with image but errors', () => {
      const rows = [
        makeRow({
          squareId: 1,
          title: 'Has Image Has Error',
          imagePreviewUrl: 'url',
          imagePixelsHex: '0x000',
          errors: { title: 'Error' },
        }),
        makeRow({ squareId: 1, title: 'No Error No Image' }),
      ];
      const result = buildPreviewRows(rows);

      expect(result.get(1)?.title).toBe('No Error No Image');
    });

    it('prefers row with image over row with errors and no image', () => {
      const rows = [
        makeRow({ squareId: 1, title: 'Has Error', errors: { title: 'Error' } }),
        makeRow({
          squareId: 1,
          title: 'Has Image Has Error',
          imagePreviewUrl: 'url',
          imagePixelsHex: '0x000',
          errors: { uri: 'URI Error' },
        }),
      ];
      const result = buildPreviewRows(rows);

      // When all have errors, prefer one with image
      expect(result.get(1)?.title).toBe('Has Image Has Error');
    });

    it('falls back to first row when all have errors and no images', () => {
      const rows = [
        makeRow({ squareId: 1, title: 'First', errors: { title: 'Error 1' } }),
        makeRow({ squareId: 1, title: 'Second', errors: { title: 'Error 2' } }),
      ];
      const result = buildPreviewRows(rows);

      expect(result.get(1)?.title).toBe('First');
    });
  });
});

describe('buildErrorMap', () => {
  it('returns empty map for empty rows', () => {
    const result = buildErrorMap([]);
    expect(result.size).toBe(0);
  });

  it('returns empty map when no rows have errors', () => {
    const rows = [makeRow({ squareId: 1 }), makeRow({ squareId: 2 })];
    const result = buildErrorMap(rows);

    expect(result.size).toBe(0);
  });

  it('aggregates errors for a single square', () => {
    const rows = [
      makeRow({ squareId: 1, errors: { title: 'Title error' } }),
      makeRow({ squareId: 1, errors: { uri: 'URI error' } }),
    ];
    const result = buildErrorMap(rows);

    expect(result.size).toBe(1);
    expect(result.get(1)).toContain('Title error');
    expect(result.get(1)).toContain('URI error');
  });

  it('deduplicates identical error messages', () => {
    const rows = [
      makeRow({ squareId: 1, errors: { title: 'Same error' } }),
      makeRow({ squareId: 1, errors: { uri: 'Same error' } }),
    ];
    const result = buildErrorMap(rows);

    expect(result.get(1)).toBe('Same error');
  });

  it('builds separate entries for different squares', () => {
    const rows = [
      makeRow({ squareId: 1, errors: { title: 'Error 1' } }),
      makeRow({ squareId: 2, errors: { title: 'Error 2' } }),
    ];
    const result = buildErrorMap(rows);

    expect(result.size).toBe(2);
    expect(result.get(1)).toBe('Error 1');
    expect(result.get(2)).toBe('Error 2');
  });

  it('filters out invalid square IDs', () => {
    const rows = [makeRow({ squareId: 0, errors: { title: 'Error' } })];
    const result = buildErrorMap(rows);

    expect(result.size).toBe(0);
  });

  it('handles rows with null/undefined errors', () => {
    const rows = [
      { squareId: 1, errors: null } as unknown as TestRow,
      { squareId: 2 } as TestRow,
    ];
    const result = buildErrorMap(rows);

    expect(result.size).toBe(0);
  });
});
