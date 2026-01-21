import {
  createValidationController,
  clearOverLimitFlags,
  resetOverLimitFlags,
  setOverLimitFlag,
} from '@assets-js/personalize-modern/validation/index.js';

function createMockStore(initialRows: any[] = []) {
  let state = {
    rows: initialRows,
    ownershipStatus: 'idle',
    ownedSquares: null as Set<number> | null,
    highlightedRowId: null,
    locatorRowId: null,
  };

  const listeners: Array<(state: any, action: any) => void> = [];

  return {
    getState: () => state,
    setState: (newState: Partial<typeof state>) => {
      state = { ...state, ...newState };
    },
    setRowError: vi.fn((rowId: string, field: string, message: string) => {
      const row = state.rows.find((r) => r.id === rowId);
      if (row) row.errors[field] = message;
    }),
    setRowErrors: vi.fn((rowId: string, errors: Record<string, string>) => {
      const row = state.rows.find((r) => r.id === rowId);
      if (row) row.errors = { ...row.errors, ...errors };
    }),
    updateRow: vi.fn(),
    pruneEmptyRows: vi.fn(),
    batch: vi.fn((fn: () => void) => fn()),
    subscribe: vi.fn((fn: (state: any, action: any) => void) => {
      listeners.push(fn);
    }),
  };
}

function createRow(overrides: Partial<{
  id: string;
  squareId: number | null;
  title: string;
  uri: string;
  imagePixelsHex: string | null;
  imagePreviewUrl: string | null;
  errors: Record<string, string>;
}> = {}) {
  return {
    id: overrides.id ?? `row-${Math.random().toString(36).slice(2)}`,
    squareId: overrides.squareId ?? null,
    title: overrides.title ?? '',
    uri: overrides.uri ?? '',
    imagePixelsHex: overrides.imagePixelsHex ?? null,
    imagePreviewUrl: overrides.imagePreviewUrl ?? null,
    errors: overrides.errors ?? { square: '', title: '', uri: '', image: '' },
  };
}

describe('createValidationController', () => {
  const isValidSquareId = (id: any) =>
    typeof id === 'number' && id >= 1 && id <= 10000;
  const isRowEmpty = (row: any) =>
    !row.squareId && !row.title && !row.uri && !row.imagePixelsHex;
  const getTitleLength = (row: any) => new TextEncoder().encode(row.title || '').length;
  const getUriLength = (row: any) => new TextEncoder().encode(row.uri || '').length;

  describe('validateSquareErrors', () => {
    it('sets error for invalid square IDs', () => {
      const row = createRow({ id: 'r1', squareId: 99999 });
      const store = createMockStore([row]);
      const controller = createValidationController({
        store,
        isValidSquareId,
        isRowEmpty,
        getTitleLength,
        getUriLength,
        titleMax: 64,
        uriMax: 96,
      });

      controller.validateSquareErrors();

      expect(store.setRowError).toHaveBeenCalledWith(
        'r1',
        'square',
        'Square # must be between 1 and 10000.'
      );
    });

    it('sets error for duplicate square IDs', () => {
      const row1 = createRow({ id: 'r1', squareId: 100 });
      const row2 = createRow({ id: 'r2', squareId: 100 });
      const store = createMockStore([row1, row2]);
      const controller = createValidationController({
        store,
        isValidSquareId,
        isRowEmpty,
        getTitleLength,
        getUriLength,
        titleMax: 64,
        uriMax: 96,
      });

      controller.validateSquareErrors();

      expect(store.setRowError).toHaveBeenCalledWith(
        'r1',
        'square',
        'You already added this Square.'
      );
      expect(store.setRowError).toHaveBeenCalledWith(
        'r2',
        'square',
        'You already added this Square.'
      );
    });

    it('sets ownership error when square not owned', () => {
      const row = createRow({ id: 'r1', squareId: 100 });
      const store = createMockStore([row]);
      store.setState({
        ownershipStatus: 'ready',
        ownedSquares: new Set([200, 300]),
      });
      const controller = createValidationController({
        store,
        isValidSquareId,
        isRowEmpty,
        getTitleLength,
        getUriLength,
        titleMax: 64,
        uriMax: 96,
      });

      controller.validateSquareErrors();

      expect(store.setRowError).toHaveBeenCalledWith(
        'r1',
        'square',
        "You don't own this Square."
      );
    });

    it('clears error for valid owned squares', () => {
      const row = createRow({ id: 'r1', squareId: 100 });
      const store = createMockStore([row]);
      store.setState({
        ownershipStatus: 'ready',
        ownedSquares: new Set([100]),
      });
      const controller = createValidationController({
        store,
        isValidSquareId,
        isRowEmpty,
        getTitleLength,
        getUriLength,
        titleMax: 64,
        uriMax: 96,
      });

      controller.validateSquareErrors();

      expect(store.setRowError).toHaveBeenCalledWith('r1', 'square', '');
    });

    it('requires square when requireFilled is true and row has data', () => {
      const row = createRow({ id: 'r1', squareId: null, title: 'Some title' });
      const store = createMockStore([row]);
      const controller = createValidationController({
        store,
        isValidSquareId,
        isRowEmpty,
        getTitleLength,
        getUriLength,
        titleMax: 64,
        uriMax: 96,
      });

      controller.validateSquareErrors(true);

      expect(store.setRowError).toHaveBeenCalledWith(
        'r1',
        'square',
        'Square # is required.'
      );
    });
  });

  describe('validateForSubmit', () => {
    let alertFn: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      alertFn = vi.fn();
    });

    it('returns false and alerts when no rows have data', () => {
      const row = createRow({ id: 'r1' });
      const store = createMockStore([row]);
      const controller = createValidationController({
        store,
        isValidSquareId,
        isRowEmpty,
        getTitleLength,
        getUriLength,
        titleMax: 64,
        uriMax: 96,
        alertFn,
      });

      const result = controller.validateForSubmit();

      expect(result).toBe(false);
      expect(alertFn).toHaveBeenCalledWith(
        'Please add at least one Square to personalize.'
      );
    });

    it('returns false when row is incomplete (missing title)', () => {
      const row = createRow({
        id: 'r1',
        squareId: 100,
        title: '',
        uri: 'https://example.com',
        imagePixelsHex: 'abc123',
      });
      const store = createMockStore([row]);
      const controller = createValidationController({
        store,
        isValidSquareId,
        isRowEmpty,
        getTitleLength,
        getUriLength,
        titleMax: 64,
        uriMax: 96,
        alertFn,
      });

      const result = controller.validateForSubmit();

      expect(result).toBe(false);
      expect(alertFn).toHaveBeenCalled();
      expect(store.setRowErrors).toHaveBeenCalledWith('r1', expect.objectContaining({
        title: 'Title is required.',
      }));
    });

    it('returns false when row is incomplete (missing uri)', () => {
      const row = createRow({
        id: 'r1',
        squareId: 100,
        title: 'Test',
        uri: '',
        imagePixelsHex: 'abc123',
      });
      const store = createMockStore([row]);
      const controller = createValidationController({
        store,
        isValidSquareId,
        isRowEmpty,
        getTitleLength,
        getUriLength,
        titleMax: 64,
        uriMax: 96,
        alertFn,
      });

      const result = controller.validateForSubmit();

      expect(result).toBe(false);
      expect(store.setRowErrors).toHaveBeenCalledWith('r1', expect.objectContaining({
        uri: 'URI is required.',
      }));
    });

    it('returns false when row is incomplete (missing image)', () => {
      const row = createRow({
        id: 'r1',
        squareId: 100,
        title: 'Test',
        uri: 'https://example.com',
        imagePixelsHex: null,
      });
      const store = createMockStore([row]);
      const controller = createValidationController({
        store,
        isValidSquareId,
        isRowEmpty,
        getTitleLength,
        getUriLength,
        titleMax: 64,
        uriMax: 96,
        alertFn,
      });

      const result = controller.validateForSubmit();

      expect(result).toBe(false);
      expect(store.setRowErrors).toHaveBeenCalledWith('r1', expect.objectContaining({
        image: 'Upload an image.',
      }));
    });

    it('returns false when title exceeds max bytes', () => {
      const row = createRow({
        id: 'r1',
        squareId: 100,
        title: 'a'.repeat(100), // exceeds 64 bytes
        uri: 'https://example.com',
        imagePixelsHex: 'abc123',
      });
      const store = createMockStore([row]);
      const controller = createValidationController({
        store,
        isValidSquareId,
        isRowEmpty,
        getTitleLength,
        getUriLength,
        titleMax: 64,
        uriMax: 96,
        alertFn,
      });

      const result = controller.validateForSubmit();

      expect(result).toBe(false);
      expect(store.setRowErrors).toHaveBeenCalledWith('r1', expect.objectContaining({
        title: 'Title is too long.',
      }));
    });

    it('returns false when uri exceeds max bytes', () => {
      const row = createRow({
        id: 'r1',
        squareId: 100,
        title: 'Test',
        uri: 'https://example.com/' + 'a'.repeat(100), // exceeds 96 bytes
        imagePixelsHex: 'abc123',
      });
      const store = createMockStore([row]);
      const controller = createValidationController({
        store,
        isValidSquareId,
        isRowEmpty,
        getTitleLength,
        getUriLength,
        titleMax: 64,
        uriMax: 96,
        alertFn,
      });

      const result = controller.validateForSubmit();

      expect(result).toBe(false);
      expect(store.setRowErrors).toHaveBeenCalledWith('r1', expect.objectContaining({
        uri: 'URI is too long.',
      }));
    });

    it('returns true for valid complete row', () => {
      const row = createRow({
        id: 'r1',
        squareId: 100,
        title: 'Test Title',
        uri: 'https://example.com',
        imagePixelsHex: 'abc123',
      });
      const store = createMockStore([row]);
      store.setState({
        ownershipStatus: 'ready',
        ownedSquares: new Set([100]),
      });
      const controller = createValidationController({
        store,
        isValidSquareId,
        isRowEmpty,
        getTitleLength,
        getUriLength,
        titleMax: 64,
        uriMax: 96,
        alertFn,
      });

      const result = controller.validateForSubmit();

      expect(result).toBe(true);
      expect(alertFn).not.toHaveBeenCalled();
    });

    it('calls pruneEmptyRows before validation', () => {
      const row = createRow({
        id: 'r1',
        squareId: 100,
        title: 'Test',
        uri: 'https://example.com',
        imagePixelsHex: 'abc123',
      });
      const store = createMockStore([row]);
      store.setState({
        ownershipStatus: 'ready',
        ownedSquares: new Set([100]),
      });
      const controller = createValidationController({
        store,
        isValidSquareId,
        isRowEmpty,
        getTitleLength,
        getUriLength,
        titleMax: 64,
        uriMax: 96,
        alertFn,
      });

      controller.validateForSubmit();

      expect(store.pruneEmptyRows).toHaveBeenCalled();
    });
  });

  describe('markOwnershipErrorsFromTx', () => {
    it('marks errors for square numbers found in message', () => {
      const row1 = createRow({ id: 'r1', squareId: 123 });
      const row2 = createRow({ id: 'r2', squareId: 456 });
      const store = createMockStore([row1, row2]);
      const controller = createValidationController({
        store,
        isValidSquareId,
        isRowEmpty,
        getTitleLength,
        getUriLength,
        titleMax: 64,
        uriMax: 96,
      });

      controller.markOwnershipErrorsFromTx('You do not own squares #123 and #456');

      expect(store.setRowError).toHaveBeenCalledWith(
        'r1',
        'square',
        "You don't own this Square."
      );
      expect(store.setRowError).toHaveBeenCalledWith(
        'r2',
        'square',
        "You don't own this Square."
      );
    });

    it('handles square numbers without hash prefix', () => {
      const row = createRow({ id: 'r1', squareId: 789 });
      const store = createMockStore([row]);
      const controller = createValidationController({
        store,
        isValidSquareId,
        isRowEmpty,
        getTitleLength,
        getUriLength,
        titleMax: 64,
        uriMax: 96,
      });

      controller.markOwnershipErrorsFromTx('Error: squares 789 not owned');

      expect(store.setRowError).toHaveBeenCalledWith(
        'r1',
        'square',
        "You don't own this Square."
      );
    });

    it('falls back to ownership check when message contains "own" but no numbers', () => {
      const row1 = createRow({ id: 'r1', squareId: 100 });
      const row2 = createRow({ id: 'r2', squareId: 200 });
      const store = createMockStore([row1, row2]);
      store.setState({
        ownershipStatus: 'ready',
        ownedSquares: new Set([100]), // only owns 100
      });
      const controller = createValidationController({
        store,
        isValidSquareId,
        isRowEmpty,
        getTitleLength,
        getUriLength,
        titleMax: 64,
        uriMax: 96,
      });

      controller.markOwnershipErrorsFromTx('Ownership verification failed');

      // Only row2 should be marked since row1 is owned
      expect(store.setRowError).toHaveBeenCalledWith(
        'r2',
        'square',
        "You don't own this Square."
      );
    });

    it('does nothing for null/undefined message', () => {
      const store = createMockStore([]);
      const controller = createValidationController({
        store,
        isValidSquareId,
        isRowEmpty,
        getTitleLength,
        getUriLength,
        titleMax: 64,
        uriMax: 96,
      });

      controller.markOwnershipErrorsFromTx(null as any);
      controller.markOwnershipErrorsFromTx(undefined as any);

      expect(store.setRowError).not.toHaveBeenCalled();
    });
  });
});

describe('overLimitFlags', () => {
  beforeEach(() => {
    resetOverLimitFlags();
  });

  describe('setOverLimitFlag', () => {
    it('returns true when setting flag for first time', () => {
      const result = setOverLimitFlag('row1', 'title', true);
      expect(result).toBe(true);
    });

    it('returns false when flag already set', () => {
      setOverLimitFlag('row1', 'title', true);
      const result = setOverLimitFlag('row1', 'title', true);
      expect(result).toBe(false);
    });

    it('returns false when clearing flag', () => {
      setOverLimitFlag('row1', 'title', true);
      const result = setOverLimitFlag('row1', 'title', false);
      expect(result).toBe(false);
    });

    it('tracks different fields independently', () => {
      expect(setOverLimitFlag('row1', 'title', true)).toBe(true);
      expect(setOverLimitFlag('row1', 'uri', true)).toBe(true);
      expect(setOverLimitFlag('row1', 'title', true)).toBe(false);
    });

    it('tracks different rows independently', () => {
      expect(setOverLimitFlag('row1', 'title', true)).toBe(true);
      expect(setOverLimitFlag('row2', 'title', true)).toBe(true);
    });
  });

  describe('clearOverLimitFlags', () => {
    it('clears all flags for a specific row', () => {
      setOverLimitFlag('row1', 'title', true);
      setOverLimitFlag('row1', 'uri', true);
      setOverLimitFlag('row2', 'title', true);

      clearOverLimitFlags('row1');

      // row1 flags should be cleared, so setting again returns true
      expect(setOverLimitFlag('row1', 'title', true)).toBe(true);
      expect(setOverLimitFlag('row1', 'uri', true)).toBe(true);
      // row2 flag should still be set
      expect(setOverLimitFlag('row2', 'title', true)).toBe(false);
    });
  });

  describe('resetOverLimitFlags', () => {
    it('clears all flags', () => {
      setOverLimitFlag('row1', 'title', true);
      setOverLimitFlag('row2', 'uri', true);

      resetOverLimitFlags();

      expect(setOverLimitFlag('row1', 'title', true)).toBe(true);
      expect(setOverLimitFlag('row2', 'uri', true)).toBe(true);
    });
  });
});
