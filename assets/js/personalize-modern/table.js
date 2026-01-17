import { getTitleLength, getUriLength } from "./store.js";

const encoder = new TextEncoder();
const TITLE_MAX_BYTES = 64;
const URI_MAX_BYTES = 96;
const SQUARE_MAX_DIGITS = 5;

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
}) {
  const rowElements = new Map();
  let pendingGutterSync = false;

  const tableElement = tableBody?.closest("table") || null;
  const gutterHeader =
    wrapper?.querySelector(".personalize-table__gutter-header") || null;

  function scheduleGutterSync() {
    if (pendingGutterSync) return;
    pendingGutterSync = true;
    requestAnimationFrame(syncGutterHeights);
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

  function updateRowState(row, elements, state) {
    const active = document.activeElement;

    if (active !== elements.squareInput) {
      elements.squareInput.value = row.squareId ? String(row.squareId) : "";
    }
    if (active !== elements.titleInput) {
      elements.titleInput.value = row.title || "";
      autoResizeTextarea(elements.titleInput);
    }
    if (active !== elements.uriInput) {
      elements.uriInput.value = row.uri || "";
      autoResizeTextarea(elements.uriInput);
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

    if (row.imagePreviewUrl && row.imagePixelsHex) {
      elements.imagePreview.src = row.imagePreviewUrl;
      elements.imagePreview.hidden = false;
      elements.uploadButton.hidden = true;
    } else {
      elements.imagePreview.hidden = true;
      elements.uploadButton.hidden = false;
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
      scheduleGutterSync();
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
      autoResizeTextarea(titleInput);
      onFieldInput(row.id, "title", event.target.value, { event });
      scheduleGutterSync();
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
      autoResizeTextarea(uriInput);
      onFieldInput(row.id, "uri", event.target.value, { event });
      scheduleGutterSync();
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
    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "personalize-row-delete";
    deleteButton.textContent = "x";
    deleteButton.setAttribute("aria-label", "Delete row");
    deleteButton.addEventListener("click", () => onRowDelete(row.id));
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
    };
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
    const existingIds = new Set(rowElements.keys());

    state.rows.forEach((row) => {
      if (!rowElements.has(row.id)) {
        const elements = buildRowElements(row);
        rowElements.set(row.id, elements);
        tableBody.appendChild(elements.row);
        gutterBody.appendChild(elements.gutterRow);
      }
      existingIds.delete(row.id);
    });

    existingIds.forEach((rowId) => {
      const elements = rowElements.get(rowId);
      if (elements) {
        elements.row.remove();
        elements.gutterRow.remove();
        rowElements.delete(rowId);
      }
    });

    const desiredIds = state.rows.map((row) => row.id);
    const tableOrderMatches = Array.from(tableBody.children).every((child, index) => {
      return child?.dataset?.rowId === desiredIds[index];
    }) && tableBody.children.length === desiredIds.length;

    const gutterOrderMatches = Array.from(gutterBody.children).every((child, index) => {
      return child?.dataset?.rowId === desiredIds[index];
    }) && gutterBody.children.length === desiredIds.length;

    if (!tableOrderMatches) {
      const fragment = document.createDocumentFragment();
      desiredIds.forEach((rowId) => {
        const elements = rowElements.get(rowId);
        if (elements) {
          fragment.appendChild(elements.row);
        }
      });
      tableBody.appendChild(fragment);
    }

    if (!gutterOrderMatches) {
      const fragment = document.createDocumentFragment();
      desiredIds.forEach((rowId) => {
        const elements = rowElements.get(rowId);
        if (elements) {
          fragment.appendChild(elements.gutterRow);
        }
      });
      gutterBody.appendChild(fragment);
    }

    state.rows.forEach((row) => {
      const elements = rowElements.get(row.id);
      if (!elements) return;
      updateRowState(row, elements, state);
    });

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

    scheduleGutterSync();
  }

  store.subscribe(syncRows);
  syncRows();
  window.addEventListener("resize", scheduleGutterSync);

  return {
    scrollToRow(rowId) {
      const elements = rowElements.get(rowId);
      if (!elements) return;
      elements.row.scrollIntoView({ behavior: "smooth", block: "center" });
    },
  };
}
