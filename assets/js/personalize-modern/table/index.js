import {
  ROW_HEIGHT_FALLBACK,
  VIRTUALIZE_OVERSCAN,
  VIRTUALIZE_ROW_THRESHOLD,
} from "./constants.js";
import { buildRowElements, updateRowState } from "./row-elements.js";

export function createPersonalizeTable({
  store,
  tableBody,
  gutterBody,
  wrapper,
  onFieldInput = () => {},
  onFieldBlur = () => {},
  onRowDelete = () => {},
  onRowLocate = () => {},
}) {
  const rowElements = new Map();
  let pendingGutterSync = false;
  let pendingSync = false;
  let virtualized = false;
  let rowHeight = ROW_HEIGHT_FALLBACK;
  let tableSpacerTop = null;
  let tableSpacerBottom = null;
  let gutterSpacerTop = null;
  let gutterSpacerBottom = null;

  const tableElement = tableBody?.closest("table") || null;
  const gutterHeader =
    wrapper?.querySelector(".personalize-table__gutter-header") || null;

  function shouldDeferInput() {
    return store.getState().rows.length >= VIRTUALIZE_ROW_THRESHOLD;
  }

  function scheduleGutterSync() {
    if (pendingGutterSync) return;
    pendingGutterSync = true;
    requestAnimationFrame(syncGutterHeights);
  }

  function scheduleSync() {
    if (pendingSync) return;
    pendingSync = true;
    requestAnimationFrame(() => {
      pendingSync = false;
      syncRows();
    });
  }

  function scheduleLayoutSync() {
    if (!virtualized) {
      scheduleGutterSync();
    }
  }

  function syncHeaderHeight() {
    if (!wrapper || !tableElement) return;
    const header = tableElement.querySelector("thead");
    const height = header?.offsetHeight || 0;
    wrapper.style.setProperty("--personalize-table-header-height", `${height}px`);
    if (gutterHeader) {
      gutterHeader.style.height = `${height}px`;
    }
  }

  function syncGutterHeights() {
    pendingGutterSync = false;
    const state = store.getState();
    state.rows.forEach((row) => {
      const elements = rowElements.get(row.id);
      if (!elements) return;
      const height = elements.row.offsetHeight;
      elements.gutterRow.style.height = `${height}px`;
    });
    syncHeaderHeight();
  }

  function createTableSpacer() {
    const tr = document.createElement("tr");
    tr.className = "personalize-table__spacer";
    const td = document.createElement("td");
    td.colSpan = tableElement?.querySelectorAll("thead th").length || 4;
    td.style.height = "0px";
    tr.appendChild(td);
    return { row: tr, cell: td };
  }

  function createGutterSpacer() {
    const spacer = document.createElement("div");
    spacer.className = "personalize-table__gutter-spacer";
    spacer.style.height = "0px";
    return spacer;
  }

  function ensureSpacers() {
    if (!tableSpacerTop) {
      tableSpacerTop = createTableSpacer();
    }
    if (!tableSpacerBottom) {
      tableSpacerBottom = createTableSpacer();
    }
    if (!gutterSpacerTop) {
      gutterSpacerTop = createGutterSpacer();
    }
    if (!gutterSpacerBottom) {
      gutterSpacerBottom = createGutterSpacer();
    }
  }

  function setTableSpacerHeight(spacer, height) {
    if (!spacer || !spacer.cell) return;
    spacer.cell.style.height = `${Math.max(0, height)}px`;
  }

  function setGutterSpacerHeight(spacer, height) {
    if (!spacer) return;
    spacer.style.height = `${Math.max(0, height)}px`;
  }

  function getActiveRowId() {
    const active = document.activeElement;
    if (!active || !tableBody || !tableBody.contains(active)) return null;
    const row = active.closest("tr");
    return row?.dataset?.rowId || null;
  }

  function pruneRowElements(rows) {
    const activeIds = new Set(rows.map((row) => row.id));
    Array.from(rowElements.keys()).forEach((rowId) => {
      if (activeIds.has(rowId)) return;
      const elements = rowElements.get(rowId);
      if (elements) {
        elements.row.remove();
        elements.gutterRow.remove();
      }
      rowElements.delete(rowId);
    });
  }

  function syncRowsFull(state) {
    if (!tableBody || !gutterBody) return;
    const fragment = document.createDocumentFragment();
    const gutterFragment = document.createDocumentFragment();

    state.rows.forEach((row) => {
      let elements = rowElements.get(row.id);
      if (!elements) {
        elements = buildRowElements({
          row,
          store,
          onFieldInput,
          onFieldBlur,
          onRowDelete,
          onRowLocate,
          shouldDeferInput,
          scheduleLayoutSync,
        });
        rowElements.set(row.id, elements);
      }
      fragment.appendChild(elements.row);
      gutterFragment.appendChild(elements.gutterRow);
      updateRowState(row, elements, state);
    });

    tableBody.replaceChildren(fragment);
    gutterBody.replaceChildren(gutterFragment);
    scheduleGutterSync();
  }

  function syncRowsVirtual(state) {
    if (!tableBody || !gutterBody || !wrapper) return;
    ensureSpacers();
    const rows = state.rows;
    const total = rows.length;
    const viewportHeight = wrapper.clientHeight || 0;
    const scrollTop = wrapper.scrollTop || 0;
    const headerHeight = tableElement?.querySelector("thead")?.offsetHeight || 0;
    const scrollOffset = Math.max(0, scrollTop - headerHeight);
    const viewHeight = Math.max(0, viewportHeight - headerHeight);
    const estimatedHeight = rowHeight || ROW_HEIGHT_FALLBACK;

    let start = Math.max(
      0,
      Math.floor(scrollOffset / estimatedHeight) - VIRTUALIZE_OVERSCAN
    );
    let end = Math.min(
      total,
      Math.ceil((scrollOffset + viewHeight) / estimatedHeight) + VIRTUALIZE_OVERSCAN
    );

    const activeRowId = getActiveRowId();
    if (activeRowId) {
      const activeIndex = rows.findIndex((row) => row.id === activeRowId);
      if (activeIndex !== -1) {
        start = Math.min(start, activeIndex);
        end = Math.max(end, activeIndex + 1);
      }
    }

    setTableSpacerHeight(tableSpacerTop, start * estimatedHeight);
    setTableSpacerHeight(
      tableSpacerBottom,
      Math.max(0, (total - end) * estimatedHeight)
    );
    setGutterSpacerHeight(gutterSpacerTop, start * estimatedHeight);
    setGutterSpacerHeight(
      gutterSpacerBottom,
      Math.max(0, (total - end) * estimatedHeight)
    );

    const fragment = document.createDocumentFragment();
    const gutterFragment = document.createDocumentFragment();
    fragment.appendChild(tableSpacerTop.row);
    gutterFragment.appendChild(gutterSpacerTop);

    for (let index = start; index < end; index += 1) {
      const row = rows[index];
      let elements = rowElements.get(row.id);
      if (!elements) {
        elements = buildRowElements({
          row,
          store,
          onFieldInput,
          onFieldBlur,
          onRowDelete,
          onRowLocate,
          shouldDeferInput,
          scheduleLayoutSync,
        });
        rowElements.set(row.id, elements);
      }
      updateRowState(row, elements, state, { gutterHeight: estimatedHeight });
      fragment.appendChild(elements.row);
      gutterFragment.appendChild(elements.gutterRow);
    }

    fragment.appendChild(tableSpacerBottom.row);
    gutterFragment.appendChild(gutterSpacerBottom);

    tableBody.replaceChildren(fragment);
    gutterBody.replaceChildren(gutterFragment);
    syncHeaderHeight();

    if (start < end) {
      const sampleRow = rows[start];
      const elements = sampleRow ? rowElements.get(sampleRow.id) : null;
      if (elements) {
        const measured = elements.row.offsetHeight;
        if (measured && Math.abs(measured - rowHeight) > 1) {
          rowHeight = measured;
          scheduleSync();
        }
      }
    }
  }

  function syncRows() {
    const activeElement = document.activeElement;
    const preserveFocus =
      activeElement &&
      tableBody.contains(activeElement) &&
      (activeElement.tagName === "INPUT" || activeElement.tagName === "TEXTAREA");
    const selection =
      preserveFocus && typeof activeElement.selectionStart === "number"
        ? {
            element: activeElement,
            start: activeElement.selectionStart,
            end: activeElement.selectionEnd,
          }
        : preserveFocus
          ? { element: activeElement }
          : null;
    const state = store.getState();
    const shouldVirtualize = state.rows.length >= VIRTUALIZE_ROW_THRESHOLD;
    if (virtualized !== shouldVirtualize) {
      virtualized = shouldVirtualize;
      if (wrapper) {
        wrapper.classList.toggle("is-virtualized", virtualized);
      }
    }

    pruneRowElements(state.rows);

    if (virtualized) {
      syncRowsVirtual(state);
    } else {
      syncRowsFull(state);
    }

    if (
      selection?.element &&
      selection.element.isConnected &&
      tableBody.contains(selection.element) &&
      document.activeElement !== selection.element
    ) {
      selection.element.focus();
      if (
        typeof selection.start === "number" &&
        typeof selection.end === "number" &&
        typeof selection.element.setSelectionRange === "function"
      ) {
        selection.element.setSelectionRange(selection.start, selection.end);
      }
    }
  }

  function syncDirtyRows(state, rowIds) {
    if (!rowIds || rowIds.length === 0) return;
    const activeRowId = getActiveRowId();
    let updated = false;
    const ids = Array.from(new Set(rowIds.filter(Boolean)));
    const idSet = new Set(ids);
    const rowLookup =
      ids.length > 20
        ? new Map(state.rows.map((row) => [row.id, row]))
        : null;

    const updateRow = (rowId, elements) => {
      const row = rowLookup
        ? rowLookup.get(rowId)
        : state.rows.find((item) => item.id === rowId);
      if (!row) return;
      const shouldResize = !virtualized || rowId === activeRowId || ids.length <= 5;
      updateRowState(row, elements, state, { autoResize: shouldResize });
      if (virtualized) {
        elements.gutterRow.style.height = `${elements.row.offsetHeight}px`;
      }
      updated = true;
    };

    if (virtualized && ids.length > 200) {
      rowElements.forEach((elements, rowId) => {
        if (!idSet.has(rowId)) return;
        if (!elements?.row?.isConnected) return;
        updateRow(rowId, elements);
      });
    } else {
      ids.forEach((rowId) => {
        const elements = rowElements.get(rowId);
        if (!elements) return;
        updateRow(rowId, elements);
      });
    }

    if (!virtualized && updated) {
      scheduleGutterSync();
    }
  }

  store.subscribe((state, action) => {
    if (!action || action.type === "full") {
      scheduleSync();
      return;
    }
    if (action.type === "rows") {
      syncDirtyRows(state, action.rowIds || []);
    }
  });
  syncRows();
  if (wrapper) {
    wrapper.addEventListener("scroll", scheduleSync);
  }
  window.addEventListener("resize", scheduleSync);

  return {
    scrollToRow(rowId) {
      if (virtualized && wrapper) {
        const state = store.getState();
        const index = state.rows.findIndex((row) => row.id === rowId);
        if (index === -1) return;
        const targetTop = Math.max(
          0,
          index * rowHeight - (wrapper.clientHeight - rowHeight) / 2
        );
        wrapper.scrollTo({ top: targetTop, behavior: "smooth" });
        scheduleSync();
        return;
      }
      const elements = rowElements.get(rowId);
      if (!elements) return;
      elements.row.scrollIntoView({ behavior: "smooth", block: "center" });
    },
  };
}
