export function createBatchErrorGroups() {
  return {
    missingColumns: [],
    invalidSquare: [],
    duplicateSquares: [],
    titleMissing: [],
    titleTooLong: [],
    uriMissing: [],
    uriTooLong: [],
    notOwned: [],
    invalidFilenames: [],
    duplicateImageSquares: [],
    unreadableImages: [],
    invalidImageSize: [],
    animatedImages: [],
  };
}

export function buildBatchErrorMessage(title, groups) {
  const lines = [title];
  const addGroup = (label, values) => {
    if (!values || values.length === 0) return;
    lines.push(`${label}: ${values.join(", ")}`);
  };

  addGroup("Rows with missing columns", groups.missingColumns);
  addGroup("Invalid Square numbers", groups.invalidSquare);
  addGroup("Duplicate Squares", groups.duplicateSquares);
  addGroup("Missing titles", groups.titleMissing);
  addGroup("Titles too long", groups.titleTooLong);
  addGroup("Missing URIs", groups.uriMissing);
  addGroup("URIs too long", groups.uriTooLong);
  addGroup("Squares not owned", groups.notOwned);
  addGroup("Invalid filenames", groups.invalidFilenames);
  addGroup("Duplicate image Squares", groups.duplicateImageSquares);
  addGroup("Unreadable images", groups.unreadableImages);
  addGroup("Invalid image size", groups.invalidImageSize);
  addGroup("Animated images", groups.animatedImages);

  return lines.join("\n");
}
