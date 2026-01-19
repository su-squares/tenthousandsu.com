export function createValidationController(options) {
  const {
    store,
    isValidSquareId,
    isRowEmpty,
    getTitleLength,
    getUriLength,
    titleMax,
    uriMax,
    alertFn = window.alert.bind(window),
  } = options;

  const collectDuplicateCounts = (rows) => {
    const counts = new Map();
    rows.forEach((row) => {
      if (isValidSquareId(row.squareId)) {
        counts.set(row.squareId, (counts.get(row.squareId) || 0) + 1);
      }
    });
    return counts;
  };

  const summarizeErrors = (counts) => {
    const messages = [];
    if (counts.incomplete > 0) messages.push(`${counts.incomplete} row(s) are incomplete.`);
    if (counts.invalidSquare > 0) messages.push(`${counts.invalidSquare} invalid Square number(s).`);
    if (counts.duplicate > 0) messages.push(`${counts.duplicate} duplicate Square number(s).`);
    if (counts.ownership > 0) messages.push(`${counts.ownership} Square(s) not owned.`);
    if (counts.overLimit > 0) messages.push(`${counts.overLimit} field(s) exceed limits.`);
    return messages.join("\n");
  };

  const validateSquareErrors = (requireFilled = false) => {
    const state = store.getState();
    const counts = collectDuplicateCounts(state.rows);

    store.batch(() => {
      state.rows.forEach((row) => {
        let message = "";
        if (row.squareId === null || row.squareId === "") {
          if (requireFilled && !isRowEmpty(row)) {
            message = "Square # is required.";
          }
        } else if (!isValidSquareId(row.squareId)) {
          message = "Square # must be between 1 and 10000.";
        } else if (counts.get(row.squareId) > 1) {
          message = "You already added this Square.";
        } else if (
          state.ownershipStatus === "ready" &&
          state.ownedSquares &&
          !state.ownedSquares.has(row.squareId)
        ) {
          message = "You don't own this Square.";
        }
        store.setRowError(row.id, "square", message);
      });
    });
  };

  const validateForSubmit = () => {
    let rows = null;
    const issueRows = {
      incomplete: new Set(),
      invalidSquare: new Set(),
      duplicate: new Set(),
      ownership: new Set(),
      overLimit: new Set(),
    };
    let duplicateCounts = new Map();

    store.batch(() => {
      store.pruneEmptyRows();
      const state = store.getState();
      rows = state.rows;
      duplicateCounts = collectDuplicateCounts(rows);

      rows.forEach((row) => {
        const errors = { square: "", title: "", uri: "", image: "" };
        const hasData = !isRowEmpty(row);
        const hasSquare =
          row.squareId !== null &&
          row.squareId !== undefined &&
          row.squareId !== "";
        const titleLength = getTitleLength(row);
        const uriLength = getUriLength(row);

        if (!hasSquare) {
          if (hasData) {
            errors.square = "Square # is required.";
            issueRows.incomplete.add(row.id);
          }
        } else if (!isValidSquareId(row.squareId)) {
          errors.square = "Square # must be between 1 and 10000.";
          issueRows.invalidSquare.add(row.id);
        } else if (duplicateCounts.get(row.squareId) > 1) {
          errors.square = "You already added this Square.";
          issueRows.duplicate.add(row.id);
        } else if (
          state.ownershipStatus === "ready" &&
          state.ownedSquares &&
          !state.ownedSquares.has(row.squareId)
        ) {
          errors.square = "You don't own this Square.";
          issueRows.ownership.add(row.id);
        }

        if (titleLength > titleMax) {
          errors.title = "Title is too long.";
          issueRows.overLimit.add(row.id);
        } else if (titleLength < 1 && hasData) {
          errors.title = "Title is required.";
          issueRows.incomplete.add(row.id);
        }

        if (uriLength > uriMax) {
          errors.uri = "URI is too long.";
          issueRows.overLimit.add(row.id);
        } else if (uriLength < 1 && hasData) {
          errors.uri = "URI is required.";
          issueRows.incomplete.add(row.id);
        }

        if (!row.imagePixelsHex && hasData) {
          errors.image = "Upload an image.";
          issueRows.incomplete.add(row.id);
        }

        store.setRowErrors(row.id, errors);
      });
    });

    if (!rows || rows.length === 0) {
      rows = store.getState().rows;
    }

    if (rows.length === 1 && isRowEmpty(rows[0])) {
      alertFn("Please add at least one Square to personalize.");
      return false;
    }

    const counts = {
      incomplete: issueRows.incomplete.size,
      invalidSquare: issueRows.invalidSquare.size,
      duplicate: issueRows.duplicate.size,
      ownership: issueRows.ownership.size,
      overLimit: issueRows.overLimit.size,
    };

    const hasErrors =
      counts.incomplete ||
      counts.invalidSquare ||
      counts.duplicate ||
      counts.ownership ||
      counts.overLimit;

    if (hasErrors) {
      alertFn(summarizeErrors(counts));
      return false;
    }

    validateSquareErrors(true);
    return true;
  };

  const markOwnershipErrorsFromTx = (message) => {
    if (!message || typeof message !== "string") return;
    const state = store.getState();
    const rows = state.rows;
    const matchedNumbers = Array.from(message.matchAll(/#?(\d{1,5})/g))
      .map((match) => Number(match[1]))
      .filter((num) => Number.isInteger(num));

    if (matchedNumbers.length > 0) {
      matchedNumbers.forEach((num) => {
        rows.forEach((row) => {
          if (row.squareId === num) {
            store.setRowError(row.id, "square", "You don't own this Square.");
          }
        });
      });
      return;
    }

    if (/own|owner/i.test(message)) {
      const notOwned =
        state.ownedSquares && state.ownedSquares.size > 0
          ? rows.filter(
              (row) => isValidSquareId(row.squareId) && !state.ownedSquares.has(row.squareId)
            )
          : rows;
      notOwned.forEach((row) => {
        store.setRowError(row.id, "square", "You don't own this Square.");
      });
    }
  };

  return {
    validateSquareErrors,
    validateForSubmit,
    markOwnershipErrorsFromTx,
  };
}

const overLimitFlags = new Map();

export function clearOverLimitFlags(rowId) {
  const prefix = `${rowId}:`;
  Array.from(overLimitFlags.keys()).forEach((key) => {
    if (key.startsWith(prefix)) {
      overLimitFlags.delete(key);
    }
  });
}

export function resetOverLimitFlags() {
  overLimitFlags.clear();
}

export function setOverLimitFlag(rowId, field, isOver) {
  const key = `${rowId}:${field}`;
  if (isOver) {
    if (!overLimitFlags.get(key)) {
      overLimitFlags.set(key, true);
      return true;
    }
    return false;
  }
  overLimitFlags.delete(key);
  return false;
}
