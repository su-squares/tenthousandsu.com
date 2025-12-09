import fs from "fs";
import path from "path";
import sharp from "sharp";

export type PersonalizationMetadata = {
  tokenId: number;
  title: string;
  href: string;
};

const BASE_DIR = path.join(__dirname, "..", "personalizing");
const IMAGES_DIR = path.join(BASE_DIR, "images");
const METADATA_FILE = path.join(BASE_DIR, "metadata", "personalizations.csv");
const IMAGE_EXTENSIONS = [".svg", ".webp", ".png", ".jpg"];

const IMAGE_TARGET_SIZE = 10;
const IMAGE_TARGET_PIXELS = IMAGE_TARGET_SIZE * IMAGE_TARGET_SIZE * 3;

export function loadMetadata(): Map<number, PersonalizationMetadata> {
  if (!fs.existsSync(METADATA_FILE)) {
    throw new Error(
      `Metadata CSV not found at ${METADATA_FILE}. Create it using tokenId,title,href rows.`,
    );
  }

  const raw = fs.readFileSync(METADATA_FILE, "utf8");
  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length === 0) {
    throw new Error(`Metadata CSV ${METADATA_FILE} is empty.`);
  }

  const dataLines = [...lines];
  const headerParts = dataLines[0].split(",").map((part) => part.trim().toLowerCase());
  const hasHeader =
    headerParts.length >= 3 && headerParts[0] === "tokenid" && headerParts[1] === "title";
  if (hasHeader) {
    dataLines.shift();
  }

  const metadataMap = new Map<number, PersonalizationMetadata>();

  for (const line of dataLines) {
    const parts = line.split(",");
    if (parts.length < 3) {
      throw new Error(`Malformed metadata row: ${line}`);
    }
    const tokenId = Number(parts[0].trim());
    if (!Number.isInteger(tokenId) || tokenId <= 0) {
      throw new Error(`Invalid tokenId in metadata: ${parts[0]}`);
    }
    const title = parts[1].trim();
    const href = parts[2].trim();

    if (metadataMap.has(tokenId)) {
      throw new Error(`Duplicate entry for tokenId ${tokenId} in metadata CSV.`);
    }

    metadataMap.set(tokenId, { tokenId, title, href });
  }

  return metadataMap;
}

export function ensureMetadataForToken(
  metadata: Map<number, PersonalizationMetadata>,
  tokenId: number,
): PersonalizationMetadata {
  const entry = metadata.get(tokenId);
  if (!entry) {
    throw new Error(`No metadata entry for token ${tokenId}. Populate ${METADATA_FILE}.`);
  }
  return entry;
}

export async function loadRgbDataForToken(tokenId: number): Promise<Buffer> {
  const imagePath = findImagePath(tokenId);
  const { data, info } = await sharp(imagePath)
    .resize(IMAGE_TARGET_SIZE, IMAGE_TARGET_SIZE, { fit: "fill" })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  if (data.length !== IMAGE_TARGET_PIXELS || info.channels !== 3) {
    throw new Error(
      `Image ${imagePath} did not produce ${IMAGE_TARGET_PIXELS} bytes of RGB data (got ${data.length}).`,
    );
  }

  return data;
}

export const TITLE_MAX_BYTES = 64;
export const HREF_MAX_BYTES = 96;

export function validateTextLength(name: string, value: string, limit: number): void {
  const length = Buffer.from(value, "utf8").length;
  if (length > limit) {
    throw new Error(`${name} exceeds ${limit} bytes (${length} bytes provided).`);
  }
}

function findImagePath(tokenId: number): string {
  for (const ext of IMAGE_EXTENSIONS) {
    const candidate = path.join(IMAGES_DIR, `${tokenId}${ext}`);
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  throw new Error(
    `No image found for token ${tokenId} in ${IMAGES_DIR} (supported extensions: ${IMAGE_EXTENSIONS.join(
      ", ",
    )})`,
  );
}
