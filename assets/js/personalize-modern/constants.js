export const TITLE_MAX = 64;
export const URI_MAX = 96;

export const CSV_INSTRUCTIONS = [
  "CSV Batch Instructions",
  "- Format: CSV or TSV with columns square_id,title,uri (extra columns ignored).",
  "- Square IDs can be 1 or 00001 (leading zeros are treated the same).",
  "- Title max 64 bytes; URI max 96 bytes.",
  "- If ownership data is loaded, Squares you don't own are rejected.",
  "- Running CSV Batch adds/updates rows and does not delete other rows.",
  "- Duplicate square IDs in the file are rejected.",
].join("\n");

export const IMAGE_INSTRUCTIONS = [
  "Image Batch Instructions",
  "- Upload a folder of 10x10 images named by Square number (1.png or 00001.png).",
  "- Mixed image formats are fine; duplicate names after normalization are rejected.",
  "- If ownership data is loaded, Squares you don't own are rejected.",
  "- Running Image Batch adds/updates rows and does not delete other rows.",
].join("\n");

export const CSV_TEMPLATE_LINES = [
  "square_id,title,uri",
  "1,Example Title,https://example.com",
  "00002,Second Example,mailto:hello@example.com",
  "3,Third Example,https://tenthousandsu.com",
];
