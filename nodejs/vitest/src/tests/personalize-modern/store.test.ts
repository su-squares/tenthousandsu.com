import {
  isValidSquareId,
  isRowEmpty,
  getTitleLength,
  getUriLength,
  createPersonalizeStore,
} from "@assets-js/personalize-modern/store.js";

describe("store validation functions", () => {
  describe("isValidSquareId", () => {
    it("returns true for valid square IDs (1-10000)", () => {
      expect(isValidSquareId(1)).toBe(true);
      expect(isValidSquareId(5000)).toBe(true);
      expect(isValidSquareId(10000)).toBe(true);
    });

    it("returns false for 0", () => {
      expect(isValidSquareId(0)).toBe(false);
    });

    it("returns false for negative numbers", () => {
      expect(isValidSquareId(-1)).toBe(false);
      expect(isValidSquareId(-100)).toBe(false);
    });

    it("returns false for numbers above 10000", () => {
      expect(isValidSquareId(10001)).toBe(false);
      expect(isValidSquareId(99999)).toBe(false);
    });

    it("returns false for non-integers", () => {
      expect(isValidSquareId(1.5)).toBe(false);
      expect(isValidSquareId(100.1)).toBe(false);
    });

    it("returns false for non-numbers", () => {
      expect(isValidSquareId(null)).toBe(false);
      expect(isValidSquareId(undefined)).toBe(false);
      expect(isValidSquareId("100")).toBe(false);
      expect(isValidSquareId(NaN)).toBe(false);
    });
  });

  describe("isRowEmpty", () => {
    it("returns true for completely empty row", () => {
      const row = {
        squareId: null,
        title: "",
        uri: "",
        imagePixelsHex: null,
      };
      expect(isRowEmpty(row)).toBe(true);
    });

    it("returns true when squareId is undefined", () => {
      const row = {
        squareId: undefined,
        title: "",
        uri: "",
        imagePixelsHex: null,
      };
      expect(isRowEmpty(row)).toBe(true);
    });

    it("returns true when squareId is empty string", () => {
      const row = {
        squareId: "",
        title: "",
        uri: "",
        imagePixelsHex: null,
      };
      expect(isRowEmpty(row)).toBe(true);
    });

    it("returns false when squareId is set", () => {
      const row = {
        squareId: 100,
        title: "",
        uri: "",
        imagePixelsHex: null,
      };
      expect(isRowEmpty(row)).toBe(false);
    });

    it("returns false when title is set", () => {
      const row = {
        squareId: null,
        title: "My Square",
        uri: "",
        imagePixelsHex: null,
      };
      expect(isRowEmpty(row)).toBe(false);
    });

    it("returns false when uri is set", () => {
      const row = {
        squareId: null,
        title: "",
        uri: "https://example.com",
        imagePixelsHex: null,
      };
      expect(isRowEmpty(row)).toBe(false);
    });

    it("returns false when imagePixelsHex is set", () => {
      const row = {
        squareId: null,
        title: "",
        uri: "",
        imagePixelsHex: "ff0000",
      };
      expect(isRowEmpty(row)).toBe(false);
    });
  });

  describe("getTitleLength", () => {
    it("returns 0 for empty title", () => {
      expect(getTitleLength({ title: "" })).toBe(0);
    });

    it("returns correct length for ASCII string", () => {
      expect(getTitleLength({ title: "Hello" })).toBe(5);
    });

    it("returns byte length for UTF-8 multibyte characters", () => {
      // emoji is 4 bytes in UTF-8
      expect(getTitleLength({ title: "😀" })).toBe(4);
      // Chinese character is 3 bytes
      expect(getTitleLength({ title: "中" })).toBe(3);
    });

    it("handles null/undefined title gracefully", () => {
      expect(getTitleLength({ title: null })).toBe(0);
      expect(getTitleLength({ title: undefined })).toBe(0);
    });
  });

  describe("getUriLength", () => {
    it("returns 0 for empty uri", () => {
      expect(getUriLength({ uri: "" })).toBe(0);
    });

    it("returns correct length for ASCII URL", () => {
      expect(getUriLength({ uri: "https://example.com" })).toBe(19);
    });

    it("handles null/undefined uri gracefully", () => {
      expect(getUriLength({ uri: null })).toBe(0);
      expect(getUriLength({ uri: undefined })).toBe(0);
    });
  });
});

describe("createPersonalizeStore", () => {
  describe("initialization", () => {
    it("creates store with one row by default", () => {
      const store = createPersonalizeStore();
      const state = store.getState();
      expect(state.rows).toHaveLength(1);
    });

    it("creates store with specified initial rows", () => {
      const store = createPersonalizeStore({ initialRows: 5 });
      const state = store.getState();
      expect(state.rows).toHaveLength(5);
    });

    it("ensures at least one row even if initialRows is 0", () => {
      const store = createPersonalizeStore({ initialRows: 0 });
      const state = store.getState();
      expect(state.rows).toHaveLength(1);
    });

    it("initializes with correct default state", () => {
      const store = createPersonalizeStore();
      const state = store.getState();
      expect(state.ownedSquares).toBeNull();
      expect(state.ownershipStatus).toBe("idle");
      expect(state.ownershipError).toBe("");
      expect(state.ownershipProgress).toBe(0);
    });
  });

  describe("row operations", () => {
    it("addRow adds a new row", () => {
      const store = createPersonalizeStore();
      const initialCount = store.getState().rows.length;
      store.addRow();
      expect(store.getState().rows).toHaveLength(initialCount + 1);
    });

    it("addRow returns the new row", () => {
      const store = createPersonalizeStore();
      const row = store.addRow({ squareId: 42 });
      expect(row.squareId).toBe(42);
      expect(row.id).toBeDefined();
    });

    it("removeRow removes a row by id", () => {
      const store = createPersonalizeStore({ initialRows: 3 });
      const rows = store.getState().rows;
      const rowToRemove = rows[1];
      store.removeRow(rowToRemove.id);
      const newRows = store.getState().rows;
      expect(newRows).toHaveLength(2);
      expect(newRows.find((r) => r.id === rowToRemove.id)).toBeUndefined();
    });

    it("removeRow ensures at least one row remains", () => {
      const store = createPersonalizeStore({ initialRows: 1 });
      const rowId = store.getState().rows[0].id;
      store.removeRow(rowId);
      expect(store.getState().rows).toHaveLength(1);
    });

    it("updateRow updates row with patch object", () => {
      const store = createPersonalizeStore();
      const rowId = store.getState().rows[0].id;
      store.updateRow(rowId, { title: "New Title", uri: "https://test.com" });
      const updatedRow = store.getState().rows[0];
      expect(updatedRow.title).toBe("New Title");
      expect(updatedRow.uri).toBe("https://test.com");
    });

    it("updateRow accepts a function patch", () => {
      const store = createPersonalizeStore();
      const rowId = store.getState().rows[0].id;
      store.updateRow(rowId, (row: { squareId: number | null | undefined | "" }) => {
        row.squareId = 123;
      });
      expect(store.getState().rows[0].squareId).toBe(123);
    });

    it("updateRow does nothing for invalid rowId", () => {
      const store = createPersonalizeStore();
      const stateBefore = JSON.stringify(store.getState());
      store.updateRow("invalid-id", { title: "Should not apply" });
      const stateAfter = JSON.stringify(store.getState());
      expect(stateBefore).toBe(stateAfter);
    });
  });

  describe("subscriber notifications", () => {
    it("notifies subscribers on addRow", () => {
      const store = createPersonalizeStore();
      const listener = vi.fn();
      store.subscribe(listener);
      store.addRow();
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it("notifies subscribers on removeRow", () => {
      const store = createPersonalizeStore({ initialRows: 2 });
      const listener = vi.fn();
      store.subscribe(listener);
      store.removeRow(store.getState().rows[0].id);
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it("notifies subscribers on updateRow", () => {
      const store = createPersonalizeStore();
      const listener = vi.fn();
      store.subscribe(listener);
      store.updateRow(store.getState().rows[0].id, { title: "test" });
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it("unsubscribe stops notifications", () => {
      const store = createPersonalizeStore();
      const listener = vi.fn();
      const unsubscribe = store.subscribe(listener);
      unsubscribe();
      store.addRow();
      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe("batch operations", () => {
    it("batch() consolidates multiple notifications into one", () => {
      const store = createPersonalizeStore();
      const listener = vi.fn();
      store.subscribe(listener);

      store.batch(() => {
        store.addRow();
        store.addRow();
        store.addRow();
      });

      expect(listener).toHaveBeenCalledTimes(1);
    });

    it("beginBatch/endBatch consolidates notifications", () => {
      const store = createPersonalizeStore();
      const listener = vi.fn();
      store.subscribe(listener);

      store.beginBatch();
      store.addRow();
      store.addRow();
      expect(listener).not.toHaveBeenCalled();

      store.endBatch();
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it("nested batches work correctly", () => {
      const store = createPersonalizeStore();
      const listener = vi.fn();
      store.subscribe(listener);

      store.beginBatch();
      store.addRow();
      store.beginBatch();
      store.addRow();
      store.endBatch();
      expect(listener).not.toHaveBeenCalled();
      store.endBatch();
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it("endBatch without beginBatch does nothing", () => {
      const store = createPersonalizeStore();
      const listener = vi.fn();
      store.subscribe(listener);
      store.endBatch(); // should not throw
      store.addRow();
      expect(listener).toHaveBeenCalledTimes(1);
    });
  });

  describe("error management", () => {
    it("setRowError sets error for a field", () => {
      const store = createPersonalizeStore();
      const rowId = store.getState().rows[0].id;
      store.setRowError(rowId, "square", "Invalid square");
      expect(store.getState().rows[0].errors.square).toBe("Invalid square");
    });

    it("setRowError normalizes empty message", () => {
      const store = createPersonalizeStore();
      const rowId = store.getState().rows[0].id;
      store.setRowError(rowId, "square", "Error");
      store.setRowError(rowId, "square", null);
      expect(store.getState().rows[0].errors.square).toBe("");
    });

    it("setRowError does not notify if value unchanged", () => {
      const store = createPersonalizeStore();
      const rowId = store.getState().rows[0].id;
      store.setRowError(rowId, "square", "Error");
      const listener = vi.fn();
      store.subscribe(listener);
      store.setRowError(rowId, "square", "Error");
      expect(listener).not.toHaveBeenCalled();
    });

    it("setRowErrors sets multiple errors at once", () => {
      const store = createPersonalizeStore();
      const rowId = store.getState().rows[0].id;
      store.setRowErrors(rowId, {
        square: "Bad square",
        title: "Bad title",
      });
      const errors = store.getState().rows[0].errors;
      expect(errors.square).toBe("Bad square");
      expect(errors.title).toBe("Bad title");
    });

    it("clearRowErrors clears all errors", () => {
      const store = createPersonalizeStore();
      const rowId = store.getState().rows[0].id;
      store.setRowErrors(rowId, {
        square: "Error 1",
        title: "Error 2",
      });
      store.clearRowErrors(rowId);
      const errors = store.getState().rows[0].errors;
      expect(errors.square).toBe("");
      expect(errors.title).toBe("");
      expect(errors.uri).toBe("");
      expect(errors.image).toBe("");
    });

    it("clearRowErrors does not notify if already clear", () => {
      const store = createPersonalizeStore();
      const rowId = store.getState().rows[0].id;
      const listener = vi.fn();
      store.subscribe(listener);
      store.clearRowErrors(rowId);
      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe("sortRows", () => {
    it("sorts rows by squareId ascending", () => {
      const store = createPersonalizeStore();
      // Update the default row and add more
      store.updateRow(store.getState().rows[0].id, { squareId: 300 });
      store.addRow({ squareId: 100 });
      store.addRow({ squareId: 200 });
      store.sortRows();
      const ids = store.getState().rows.map((r) => r.squareId);
      expect(ids).toEqual([100, 200, 300]);
    });

    it("puts rows without valid squareId at the end", () => {
      const store = createPersonalizeStore({ initialRows: 0 });
      store.addRow({ squareId: null });
      store.addRow({ squareId: 50 });
      store.addRow({ squareId: undefined });
      store.sortRows();
      const ids = store.getState().rows.map((r) => r.squareId);
      expect(ids[0]).toBe(50);
      expect(ids[1]).toBeNull();
    });

    it("preserves original order for equal squareIds", () => {
      const store = createPersonalizeStore({ initialRows: 0 });
      store.addRow({ squareId: 100, title: "first" });
      store.addRow({ squareId: 100, title: "second" });
      store.sortRows();
      const rows = store.getState().rows;
      expect(rows[0].title).toBe("first");
      expect(rows[1].title).toBe("second");
    });
  });

  describe("pruneEmptyRows", () => {
    it("removes empty rows", () => {
      const store = createPersonalizeStore({ initialRows: 0 });
      store.addRow({ squareId: 100 });
      store.addRow({}); // empty
      store.addRow({ title: "Has title" });
      store.pruneEmptyRows();
      expect(store.getState().rows).toHaveLength(2);
    });

    it("ensures at least one row after pruning", () => {
      const store = createPersonalizeStore({ initialRows: 3 });
      // all rows are empty by default
      store.pruneEmptyRows();
      expect(store.getState().rows).toHaveLength(1);
    });
  });

  describe("ensureRowForSquare", () => {
    it("returns existing row if squareId already exists", () => {
      const store = createPersonalizeStore();
      const rowId = store.getState().rows[0].id;
      store.updateRow(rowId, { squareId: 42 });
      const initialCount = store.getState().rows.length;
      const result = store.ensureRowForSquare(42);
      expect(result.squareId).toBe(42);
      expect(store.getState().rows).toHaveLength(initialCount);
    });

    it("creates new row if squareId does not exist", () => {
      const store = createPersonalizeStore();
      const initialCount = store.getState().rows.length;
      const result = store.ensureRowForSquare(999);
      expect(result.squareId).toBe(999);
      expect(store.getState().rows).toHaveLength(initialCount + 1);
    });
  });

  describe("resetRowsKeepFirst", () => {
    it("resets to a single fresh row", () => {
      const store = createPersonalizeStore({ initialRows: 5 });
      store.updateRow(store.getState().rows[0].id, { title: "Modified" });
      store.resetRowsKeepFirst();
      const rows = store.getState().rows;
      expect(rows).toHaveLength(1);
      expect(rows[0].title).toBe("");
    });
  });

  describe("ownership state", () => {
    it("setOwnedSquares updates ownedSquares", () => {
      const store = createPersonalizeStore();
      const squares = new Set([1, 2, 3]);
      store.setOwnedSquares(squares);
      expect(store.getState().ownedSquares).toBe(squares);
    });

    it("setOwnershipStatus updates status and error", () => {
      const store = createPersonalizeStore();
      store.setOwnershipStatus("error", "Connection failed");
      expect(store.getState().ownershipStatus).toBe("error");
      expect(store.getState().ownershipError).toBe("Connection failed");
    });

    it("setOwnershipProgress updates progress and total", () => {
      const store = createPersonalizeStore();
      (store as unknown as { setOwnershipProgress: (progress: number, total?: number | null) => void }).setOwnershipProgress(50, 100);
      expect(store.getState().ownershipProgress).toBe(50);
      expect(store.getState().ownershipTotal).toBe(100);
    });
  });
});
