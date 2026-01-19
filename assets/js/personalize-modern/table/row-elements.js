import { getTitleLength, getUriLength, isValidSquareId } from "../store.js";
import { buildImagePixelsHex, loadImageFromFile } from "../utils.js";
import { TITLE_MAX_BYTES, URI_MAX_BYTES } from "./constants.js";
import {
  autoResizeTextarea,
  clampToByteLength,
  sanitizeSquareInput,
} from "./helpers.js";

async function handleImageUpload(rowId, fileInput, store) {
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

export function updateRowState(row, elements, state, options = {}) {
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

export function buildRowElements({
  row,
  store,
  onFieldInput = () => {},
  onFieldBlur = () => {},
  onRowDelete = () => {},
  onRowLocate = () => {},
  shouldDeferInput = () => false,
  scheduleLayoutSync = () => {},
}) {
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
  fileInput.addEventListener("change", () => handleImageUpload(row.id, fileInput, store));

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
