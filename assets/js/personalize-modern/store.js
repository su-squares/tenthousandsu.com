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
  let pendingFullSync = false;
  let pendingMeta = false;
  const pendingRowIds = new Set();
  const state = {
    rows: Array.from({ length: Math.max(1, initialRows) }, () => createRow()),
    ownedSquares: null,
    ownershipStatus: "idle",
    ownershipError: "",
    ownershipProgress: 0,
    ownershipTotal: null,
    ownershipRequestContext: null,
    txOwnershipStatus: "idle",
    txOwnershipProgress: 0,
    txOwnershipTotal: null,
    highlightedRowId: null,
    locatorRowId: null,
  };

  const emit = (action) => {
    listeners.forEach((listener) => listener(state, action));
  };

  const queueAction = (action) => {
    if (!action || action.type === "full") {
      pendingFullSync = true;
      return;
    }
    if (action.type === "rows" && Array.isArray(action.rowIds)) {
      action.rowIds.forEach((rowId) => {
        if (rowId) pendingRowIds.add(rowId);
      });
      return;
    }
    if (action.type === "meta") {
      pendingMeta = true;
    }
  };

  const flushPending = () => {
    if (!pendingNotify) return;
    pendingNotify = false;
    let action = { type: "full" };
    if (pendingFullSync) {
      action = { type: "full" };
    } else if (pendingRowIds.size > 0) {
      action = { type: "rows", rowIds: Array.from(pendingRowIds) };
    } else if (pendingMeta) {
      action = { type: "meta" };
    }
    pendingFullSync = false;
    pendingMeta = false;
    pendingRowIds.clear();
    emit(action);
  };

  const notify = (action) => {
    const normalizedAction = action || { type: "full" };
    if (batchDepth > 0) {
      pendingNotify = true;
      queueAction(normalizedAction);
      return;
    }
    emit(normalizedAction);
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
        flushPending();
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
      notify({ type: "full" });
      return row;
    },
    removeRow(rowId) {
      state.rows = state.rows.filter((row) => row.id !== rowId);
      if (state.locatorRowId === rowId) {
        state.locatorRowId = null;
      }
      ensureAtLeastOneRow();
      notify({ type: "full" });
    },
    resetRowsKeepFirst() {
      state.rows = [createRow()];
      state.highlightedRowId = null;
      state.locatorRowId = null;
      notify({ type: "full" });
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
      notify({ type: "rows", rowIds: [rowId] });
    },
    setRowError(rowId, field, message) {
      const row = getRow(rowId);
      if (!row) return;
      const nextMessage = message || "";
      if (row.errors[field] === nextMessage) return;
      row.errors[field] = nextMessage;
      notify({ type: "rows", rowIds: [rowId] });
    },
    setRowErrors(rowId, errors) {
      const row = getRow(rowId);
      if (!row) return;
      if (!errors || typeof errors !== "object") return;
      let changed = false;
      Object.keys(errors).forEach((key) => {
        const nextValue = errors[key] || "";
        if (row.errors[key] !== nextValue) {
          row.errors[key] = nextValue;
          changed = true;
        }
      });
      if (!changed) return;
      notify({ type: "rows", rowIds: [rowId] });
    },
    clearRowErrors(rowId) {
      const row = getRow(rowId);
      if (!row) return;
      const unchanged =
        row.errors.square === "" &&
        row.errors.title === "" &&
        row.errors.uri === "" &&
        row.errors.image === "";
      if (unchanged) return;
      row.errors = { square: "", title: "", uri: "", image: "" };
      notify({ type: "rows", rowIds: [rowId] });
    },
    setOwnedSquares(ownedSquares) {
      state.ownedSquares = ownedSquares;
      notify({ type: "meta" });
    },
    setOwnershipStatus(status, errorMessage = "") {
      state.ownershipStatus = status;
      state.ownershipError = errorMessage;
      notify({ type: "meta" });
    },
    setOwnershipProgress(progress, total = null) {
      if (typeof progress === "number") {
        state.ownershipProgress = progress;
      }
      if (typeof total === "number") {
        state.ownershipTotal = total;
      } else if (total === null) {
        state.ownershipTotal = null;
      }
      notify({ type: "meta" });
    },
    setOwnershipRequestContext(context) {
      const next = context || null;
      if (state.ownershipRequestContext === next) return;
      state.ownershipRequestContext = next;
      notify({ type: "meta" });
    },
    setTxOwnershipStatus(status) {
      state.txOwnershipStatus = status;
      notify({ type: "meta" });
    },
    setTxOwnershipProgress(progress, total = null) {
      if (typeof progress === "number") {
        state.txOwnershipProgress = progress;
      }
      if (typeof total === "number") {
        state.txOwnershipTotal = total;
      } else if (total === null) {
        state.txOwnershipTotal = null;
      }
      notify({ type: "meta" });
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
      notify({ type: "full" });
    },
    pruneEmptyRows() {
      state.rows = state.rows.filter((row) => !isRowEmpty(row));
      ensureAtLeastOneRow();
      notify({ type: "full" });
    },
    ensureRowForSquare(squareId) {
      const existing = state.rows.find((row) => row.squareId === squareId);
      if (existing) return existing;
      const row = createRow({ squareId });
      state.rows.push(row);
      notify({ type: "full" });
      return row;
    },
    highlightRow(rowId) {
      const previousId = state.highlightedRowId;
      state.highlightedRowId = rowId;
      const rowIds = [previousId, rowId].filter(Boolean);
      notify(rowIds.length > 0 ? { type: "rows", rowIds } : { type: "meta" });
    },
    setLocatorRow(rowId) {
      const nextId = rowId || null;
      if (state.locatorRowId === nextId) return;
      const previousId = state.locatorRowId;
      state.locatorRowId = nextId;
      const rowIds = [previousId, nextId].filter(Boolean);
      notify(rowIds.length > 0 ? { type: "rows", rowIds } : { type: "meta" });
    },
  };
}
