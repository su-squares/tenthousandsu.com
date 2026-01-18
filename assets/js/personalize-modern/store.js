const encoder = new TextEncoder();

function byteLength(value) {
  return encoder.encode(value || "").length;
}

let rowCounter = 0;

function createRow(overrides = {}) {
  rowCounter += 1;
  return {
    id: `row-${rowCounter}`,
    squareId: null,
    title: "",
    uri: "",
    imagePixelsHex: null,
    imagePreviewUrl: null,
    errors: {
      square: "",
      title: "",
      uri: "",
      image: "",
    },
    ...overrides,
  };
}

export function isValidSquareId(value) {
  return Number.isInteger(value) && value >= 1 && value <= 10000;
}

export function isRowEmpty(row) {
  const hasSquare =
    row.squareId !== null &&
    row.squareId !== undefined &&
    row.squareId !== "";
  return (
    !hasSquare &&
    !row.title &&
    !row.uri &&
    !row.imagePixelsHex
  );
}

export function getTitleLength(row) {
  return byteLength(row.title);
}

export function getUriLength(row) {
  return byteLength(row.uri);
}

export function createPersonalizeStore({ initialRows = 1 } = {}) {
  const listeners = new Set();
  let batchDepth = 0;
  let pendingNotify = false;
  const state = {
    rows: Array.from({ length: Math.max(1, initialRows) }, () => createRow()),
    ownedSquares: null,
    ownershipStatus: "idle",
    ownershipError: "",
    highlightedRowId: null,
    locatorRowId: null,
  };

  const emit = () => {
    listeners.forEach((listener) => listener(state));
  };

  const notify = () => {
    if (batchDepth > 0) {
      pendingNotify = true;
      return;
    }
    emit();
  };

  const getRow = (rowId) => state.rows.find((row) => row.id === rowId) || null;

  const ensureAtLeastOneRow = () => {
    if (state.rows.length === 0) {
      state.rows.push(createRow());
    }
  };

  return {
    getState() {
      return state;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    beginBatch() {
      batchDepth += 1;
    },
    endBatch() {
      if (batchDepth === 0) return;
      batchDepth = Math.max(0, batchDepth - 1);
      if (batchDepth === 0 && pendingNotify) {
        pendingNotify = false;
        emit();
      }
    },
    batch(callback) {
      this.beginBatch();
      try {
        callback();
      } finally {
        this.endBatch();
      }
    },
    addRow(overrides = {}) {
      const row = createRow(overrides);
      state.rows.push(row);
      notify();
      return row;
    },
    removeRow(rowId) {
      state.rows = state.rows.filter((row) => row.id !== rowId);
      if (state.locatorRowId === rowId) {
        state.locatorRowId = null;
      }
      ensureAtLeastOneRow();
      notify();
    },
    resetRowsKeepFirst() {
      state.rows = [createRow()];
      state.highlightedRowId = null;
      state.locatorRowId = null;
      notify();
    },
    updateRow(rowId, patch) {
      const row = getRow(rowId);
      if (!row) return;
      const prevSquareId = row.squareId;
      if (typeof patch === "function") {
        patch(row);
      } else if (patch && typeof patch === "object") {
        Object.assign(row, patch);
      }
      if (state.locatorRowId === rowId && row.squareId !== prevSquareId) {
        state.locatorRowId = null;
      }
      notify();
    },
    setRowError(rowId, field, message) {
      const row = getRow(rowId);
      if (!row) return;
      row.errors[field] = message || "";
      notify();
    },
    setRowErrors(rowId, errors) {
      const row = getRow(rowId);
      if (!row) return;
      row.errors = { ...row.errors, ...errors };
      notify();
    },
    clearRowErrors(rowId) {
      const row = getRow(rowId);
      if (!row) return;
      row.errors = { square: "", title: "", uri: "", image: "" };
      notify();
    },
    setOwnedSquares(ownedSquares) {
      state.ownedSquares = ownedSquares;
      notify();
    },
    setOwnershipStatus(status, errorMessage = "") {
      state.ownershipStatus = status;
      state.ownershipError = errorMessage;
      notify();
    },
    sortRows() {
      const indexed = state.rows.map((row, index) => ({
        row,
        index,
        key: isValidSquareId(row.squareId) ? row.squareId : Number.POSITIVE_INFINITY,
      }));
      indexed.sort((a, b) => {
        if (a.key === b.key) return a.index - b.index;
        return a.key - b.key;
      });
      state.rows = indexed.map((item) => item.row);
      notify();
    },
    pruneEmptyRows() {
      state.rows = state.rows.filter((row) => !isRowEmpty(row));
      ensureAtLeastOneRow();
      notify();
    },
    ensureRowForSquare(squareId) {
      const existing = state.rows.find((row) => row.squareId === squareId);
      if (existing) return existing;
      const row = createRow({ squareId });
      state.rows.push(row);
      notify();
      return row;
    },
    highlightRow(rowId) {
      state.highlightedRowId = rowId;
      notify();
    },
    setLocatorRow(rowId) {
      const nextId = rowId || null;
      if (state.locatorRowId === nextId) return;
      state.locatorRowId = nextId;
      notify();
    },
  };
}
