import { getTitleLength, getUriLength, isValidSquareId } from "./store.js";

const encoder = new TextEncoder();
const TITLE_MAX_BYTES = 64;
const URI_MAX_BYTES = 96;
const SQUARE_MAX_DIGITS = 5;
const VIRTUALIZE_ROW_THRESHOLD = 200;
const VIRTUALIZE_OVERSCAN = 6;
const ROW_HEIGHT_FALLBACK = 180;

function autoResizeTextarea(textarea) {
  textarea.style.height = "auto";
  textarea.style.height = `${textarea.scrollHeight}px`;
}

function clampToByteLength(value, maxBytes) {
  if (encoder.encode(value).length <= maxBytes) return value;
  let result = "";
  let currentBytes = 0;
  for (const char of value) {
    const nextBytes = encoder.encode(char).length;
    if (currentBytes + nextBytes > maxBytes) break;
    result += char;
    currentBytes += nextBytes;
  }
  return result;
}

function sanitizeSquareInput(value) {
  const digits = value.replace(/\D/g, "");
  return digits.slice(0, SQUARE_MAX_DIGITS);
}

async function loadImageFromFile(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.addEventListener("load", () => {
      URL.revokeObjectURL(url);
      resolve(image);
    });
    image.addEventListener("error", () => {
      URL.revokeObjectURL(url);
      reject(new Error("Unable to read file"));
    });
    image.src = url;
  });
}

function buildImagePixelsHex(image) {
  const canvas = document.createElement("canvas");
  canvas.width = 10;
  canvas.height = 10;
  const context = canvas.getContext("2d");
  context.drawImage(image, 0, 0);
  const { data } = context.getImageData(0, 0, 10, 10);
  let alphaWarning = false;
  let hex = "0x";
  for (let i = 0; i < data.length; i += 4) {
    const red = data[i];
    const green = data[i + 1];
    const blue = data[i + 2];
    const alpha = data[i + 3];
    const mixedRed = Math.floor((red * alpha + 255 * (255 - alpha)) / 255);
    const mixedGreen = Math.floor((green * alpha + 255 * (255 - alpha)) / 255);
    const mixedBlue = Math.floor((blue * alpha + 255 * (255 - alpha)) / 255);
    if (alpha !== 255) alphaWarning = true;
    hex += mixedRed.toString(16).padStart(2, "0");
    hex += mixedGreen.toString(16).padStart(2, "0");
    hex += mixedBlue.toString(16).padStart(2, "0");
  }
  return { hex, previewUrl: canvas.toDataURL("image/png"), alphaWarning };
}

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

  function updateRowState(row, elements, state, options = {}) {
    const { autoResize = true, gutterHeight = null } = options;
    const active = document.activeElement;

    if (active !== elements.squareInput) {
      elements.squareInput.value = row.squareId ? String(row.squareId) : "";
    }
    if (active !== elements.titleInput) {
      elements.titleInput.value = row.title || "";
      if (autoResize) {
        autoResizeTextarea(elements.titleInput);
      }
    }
    if (active !== elements.uriInput) {
      elements.uriInput.value = row.uri || "";
      if (autoResize) {
        autoResizeTextarea(elements.uriInput);
      }
    }

    elements.titleCounter.textContent = `${getTitleLength(row)}/64`;
    elements.uriCounter.textContent = `${getUriLength(row)}/96`;

    elements.squareError.textContent = row.errors.square || "";
    elements.titleError.textContent = row.errors.title || "";
    elements.uriError.textContent = row.errors.uri || "";
    elements.imageError.textContent = row.errors.image || "";
    elements.squareError.hidden = !row.errors.square;
    elements.titleError.hidden = !row.errors.title;
    elements.uriError.hidden = !row.errors.uri;
    elements.imageError.hidden = !row.errors.image;

    const hasErrors = Object.values(row.errors).some(Boolean);
    elements.row.classList.toggle("personalize-table__row--error", hasErrors);
    elements.row.classList.toggle(
      "personalize-table__row--highlighted",
      state.highlightedRowId === row.id
    );
    elements.locateButton.classList.toggle(
      "is-active",
      state.locatorRowId === row.id
    );
    const canLocate = isValidSquareId(row.squareId);
    elements.locateButton.disabled = !canLocate;
    elements.locateButton.setAttribute(
      "aria-disabled",
      canLocate ? "false" : "true"
    );
    elements.locateButton.setAttribute(
      "aria-pressed",
      state.locatorRowId === row.id ? "true" : "false"
    );

    if (row.imagePreviewUrl && row.imagePixelsHex) {
      elements.imagePreview.src = row.imagePreviewUrl;
      elements.imagePreview.hidden = false;
      elements.uploadButton.hidden = true;
    } else {
      elements.imagePreview.hidden = true;
      elements.uploadButton.hidden = false;
    }

    if (gutterHeight !== null) {
      elements.gutterRow.style.height = `${gutterHeight}px`;
    }
  }

  async function handleImageUpload(rowId, fileInput, elements) {
    const file = fileInput.files?.[0];
    if (!file) {
      alert("Unable to read file");
      return;
    }

    try {
      const image = await loadImageFromFile(file);
      if (image.width !== 10 || image.height !== 10) {
        fileInput.value = "";
        return alert("IMAGE ERROR: Image must be 10x10 pixels. Please try again.");
      }
      if (image.naturalWidth !== image.width || image.naturalHeight !== image.height) {
        fileInput.value = "";
        return alert("IMAGE ERROR: Image must not be animated. Please try again.");
      }

      const { hex, previewUrl, alphaWarning } = buildImagePixelsHex(image);
      store.updateRow(rowId, {
        imagePixelsHex: hex,
        imagePreviewUrl: previewUrl,
      });
      store.setRowError(rowId, "image", "");
      fileInput.value = "";
      if (alphaWarning) {
        alert("WARNING: Your image included transparency. We mixed it on white.");
      }
    } catch (error) {
      fileInput.value = "";
      alert(error?.message || "Unable to read file");
    }
  }

  function buildRowElements(row) {
    const tr = document.createElement("tr");
    tr.className = "personalize-table__row";
    tr.dataset.rowId = row.id;
    tr.id = `personalize-row-${row.id}`;

    const squareCell = document.createElement("td");
    const squareInner = document.createElement("div");
    squareInner.className = "personalize-table__cell-inner";

    const squareField = document.createElement("div");
    squareField.className = "personalize-table__field";

    const squareInput = document.createElement("input");
    squareInput.type = "number";
    squareInput.inputMode = "numeric";
    squareInput.min = "1";
    squareInput.max = "10000";
    squareInput.step = "1";
    squareInput.placeholder = " ";
    squareInput.className = "personalize-table__input";
    squareInput.addEventListener("input", (event) => {
      const nextValue = sanitizeSquareInput(event.target.value);
      if (nextValue !== event.target.value) {
        event.target.value = nextValue;
      }
      onFieldInput(row.id, "square", nextValue, { event });
      scheduleLayoutSync();
    });
    squareInput.addEventListener("blur", (event) => {
      onFieldBlur(row.id, "square", event.target.value, { event });
    });

    const squareError = document.createElement("div");
    squareError.className = "personalize-table__error";

    squareField.appendChild(squareInput);
    squareField.appendChild(squareError);
    squareInner.appendChild(squareField);
    squareCell.appendChild(squareInner);

    const titleCell = document.createElement("td");
    const titleInner = document.createElement("div");
    titleInner.className = "personalize-table__cell-inner";
    const titleField = document.createElement("div");
    titleField.className = "personalize-table__field";
    const titleInput = document.createElement("textarea");
    titleInput.placeholder = " ";
    titleInput.maxLength = TITLE_MAX_BYTES;
    titleInput.className = "personalize-table__textarea";
    titleInput.addEventListener("input", (event) => {
      const trimmed = clampToByteLength(event.target.value, TITLE_MAX_BYTES);
      if (trimmed !== event.target.value) {
        event.target.value = trimmed;
      }
      if (!shouldDeferInput()) {
        autoResizeTextarea(titleInput);
      }
      onFieldInput(row.id, "title", event.target.value, { event });
      scheduleLayoutSync();
    });
    titleInput.addEventListener("blur", (event) => {
      onFieldBlur(row.id, "title", event.target.value, { event });
    });
    const titleError = document.createElement("div");
    titleError.className = "personalize-table__error";
    const titleCounter = document.createElement("div");
    titleCounter.className = "personalize-table__counter";
    titleField.appendChild(titleInput);
    titleField.appendChild(titleError);
    titleInner.appendChild(titleField);
    titleInner.appendChild(titleCounter);
    titleCell.appendChild(titleInner);

    const uriCell = document.createElement("td");
    const uriInner = document.createElement("div");
    uriInner.className = "personalize-table__cell-inner";
    const uriField = document.createElement("div");
    uriField.className = "personalize-table__field";
    const uriInput = document.createElement("textarea");
    uriInput.placeholder = " ";
    uriInput.maxLength = URI_MAX_BYTES;
    uriInput.className = "personalize-table__textarea";
    uriInput.addEventListener("input", (event) => {
      const trimmed = clampToByteLength(event.target.value, URI_MAX_BYTES);
      if (trimmed !== event.target.value) {
        event.target.value = trimmed;
      }
      if (!shouldDeferInput()) {
        autoResizeTextarea(uriInput);
      }
      onFieldInput(row.id, "uri", event.target.value, { event });
      scheduleLayoutSync();
    });
    uriInput.addEventListener("blur", (event) => {
      onFieldBlur(row.id, "uri", event.target.value, { event });
    });
    const uriError = document.createElement("div");
    uriError.className = "personalize-table__error";
    const uriCounter = document.createElement("div");
    uriCounter.className = "personalize-table__counter";
    uriField.appendChild(uriInput);
    uriField.appendChild(uriError);
    uriInner.appendChild(uriField);
    uriInner.appendChild(uriCounter);
    uriCell.appendChild(uriInner);

    const imageCell = document.createElement("td");
    imageCell.className = "personalize-table__image-cell";
    const imageInner = document.createElement("div");
    imageInner.className = "personalize-table__image-slot";

    const uploadButton = document.createElement("button");
    uploadButton.type = "button";
    uploadButton.className = "personalize-table__upload-btn";
    uploadButton.innerHTML = "Upload<br>Image";

    const imagePreview = document.createElement("img");
    imagePreview.className = "personalize-table__image-preview";
    imagePreview.alt = "Square image preview";
    imagePreview.hidden = true;

    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = "image/png, image/jpeg, image/gif";
    fileInput.className = "personalize-table__file-input";

    uploadButton.addEventListener("click", () => fileInput.click());
    imagePreview.addEventListener("click", () => fileInput.click());
    fileInput.addEventListener("change", () =>
      handleImageUpload(row.id, fileInput, {
        imagePreview,
        uploadButton,
        fileInput,
      })
    );

    const imageError = document.createElement("div");
    imageError.className = "personalize-table__error";

    imageInner.appendChild(uploadButton);
    imageInner.appendChild(imagePreview);
    imageInner.appendChild(fileInput);
    imageInner.appendChild(imageError);
    imageCell.appendChild(imageInner);

    tr.appendChild(squareCell);
    tr.appendChild(titleCell);
    tr.appendChild(uriCell);
    tr.appendChild(imageCell);

    const gutterRow = document.createElement("div");
    gutterRow.className = "personalize-table__gutter-row";
    gutterRow.dataset.rowId = row.id;
    const locateButton = document.createElement("button");
    locateButton.type = "button";
    locateButton.className = "personalize-row-locate";
    locateButton.setAttribute("aria-label", "Locate square on billboard");
    locateButton.setAttribute("aria-pressed", "false");
    const locateIcon = document.createElement("img");
    locateIcon.alt = "";
    locateIcon.setAttribute("aria-hidden", "true");
    locateIcon.src = `${window.SITE_BASEURL || ""}/assets/images/dr.png`;
    locateButton.appendChild(locateIcon);
    locateButton.addEventListener("click", () => onRowLocate(row.id));
    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "personalize-row-delete";
    deleteButton.textContent = "x";
    deleteButton.setAttribute("aria-label", "Delete row");
    deleteButton.addEventListener("click", () => onRowDelete(row.id));
    gutterRow.appendChild(locateButton);
    gutterRow.appendChild(deleteButton);

    return {
      row: tr,
      gutterRow,
      imageInner,
      squareInput,
      titleInput,
      uriInput,
      uploadButton,
      imagePreview,
      fileInput,
      squareError,
      titleError,
      uriError,
      imageError,
      titleCounter,
      uriCounter,
      locateButton,
    };
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
        elements = buildRowElements(row);
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
    setTableSpacerHeight(tableSpacerBottom, Math.max(0, (total - end) * estimatedHeight));
    setGutterSpacerHeight(gutterSpacerTop, start * estimatedHeight);
    setGutterSpacerHeight(gutterSpacerBottom, Math.max(0, (total - end) * estimatedHeight));

    const fragment = document.createDocumentFragment();
    const gutterFragment = document.createDocumentFragment();
    fragment.appendChild(tableSpacerTop.row);
    gutterFragment.appendChild(gutterSpacerTop);

    for (let index = start; index < end; index += 1) {
      const row = rows[index];
      let elements = rowElements.get(row.id);
      if (!elements) {
        elements = buildRowElements(row);
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
      const row = rowLookup ? rowLookup.get(rowId) : state.rows.find((item) => item.id === rowId);
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
