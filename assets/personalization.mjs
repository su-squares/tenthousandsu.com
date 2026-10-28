export const squareContractAddress = "0xE9e3F9cfc1A64DFca53614a0182CFAD56c10624F";
export const underlayContractAddress = "0x992bDEC05cD423B73085586f7DcbbDaB953E0DCd";
export const pricePerSquare = 1000000000000000n;
export const pageSize = 20;

export const squareContractABI = [
  {
    name: "balanceOf", type: "function", stateMutability: "view",
    inputs: [{ name: "owner", type: "address" }],
    outputs: [{ type: "uint256" }]
  },
  {
    name: "tokenOfOwnerByIndex", type: "function", stateMutability: "view",
    inputs: [{ name: "owner", type: "address" }, { name: "index", type: "uint256" }],
    outputs: [{ type: "uint256" }]
  },
  {
    name: "ownerOf", type: "function", stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ type: "address" }]
  }
];

export const underlayContractABI = [{
  name: "personalizeSquareUnderlayBatch", type: "function", stateMutability: "payable",
  inputs: [{
    name: "personalizations", type: "tuple[]",
    components: [
      { name: "squareId", type: "uint256" },
      { name: "rgbData", type: "bytes" },
      { name: "title", type: "string" },
      { name: "href", type: "string" }
    ]
  }],
  outputs: []
}];

export function priceInEther(count) {
  const thousandths = BigInt(count);
  const fraction = (thousandths % 1000n).toString().padStart(3, "0").replace(/0+$/, "");
  return `${thousandths / 1000n}${fraction ? "." + fraction : ""}`;
}

export function validatePersonalizations(rows) {
  if (!rows.length) throw new Error("Please select or enter at least one Square.");
  const seen = new Set();
  const encoder = new TextEncoder();
  for (const [index, row] of rows.entries()) {
    const prefix = `Row ${index + 1}: `;
    if (!/^[0-9]+$/.test(String(row.squareId)) || BigInt(row.squareId) < 1n || BigInt(row.squareId) > 10000n) {
      throw new Error(prefix + "Square number must be a whole number from 1 to 10000.");
    }
    const id = BigInt(row.squareId).toString();
    if (seen.has(id)) throw new Error(prefix + `Square #${id} is repeated.`);
    seen.add(id);
    for (const [name, value, limit] of [["Title", row.title, 64], ["Link", row.href, 96]]) {
      const length = encoder.encode(value).length;
      if (length < 1 || length > limit || /[\t\r\n]/.test(value)) {
        throw new Error(prefix + `${name} must be 1-${limit} UTF-8 bytes without tabs or line breaks.`);
      }
    }
    if (!/^0x[0-9a-f]{600}$/i.test(row.rgbData)) {
      throw new Error(prefix + "Image must be 0x followed by exactly 600 hexadecimal digits (100 RGB pixels).");
    }
  }
  return rows.map(row => ({
    ...row, squareId: BigInt(row.squareId), rgbData: "0x" + row.rgbData.slice(2).toLowerCase()
  }));
}

export function parseBatch(text) {
  // Only strip trailing line endings; trimming spaces would silently change user data.
  const lines = text.replace(/[\r\n]+$/, "").split(/\r\n|\n|\r/);
  if (!text.trim()) throw new Error("Please enter at least one Square.");
  const rows = lines.map((line, index) => {
    const columns = line.split("\t");
    if (columns.length !== 4) throw new Error(`Row ${index + 1}: Expected exactly four tab-separated columns.`);
    const [squareId, title, href, rgbData] = columns;
    return { squareId, title, href, rgbData };
  });
  return validatePersonalizations(rows);
}

export async function loadOwnedPage(readSquare, address, offset, balance) {
  const end = Math.min(offset + pageSize, balance);
  return Promise.all(Array.from({ length: end - offset }, (_, i) =>
    readSquare("tokenOfOwnerByIndex", [address, BigInt(offset + i)])));
}

export async function verifyOwnership(readSquare, address, rows) {
  for (let offset = 0; offset < rows.length; offset += pageSize) {
    await Promise.all(rows.slice(offset, offset + pageSize).map(async row => {
      const owner = await readSquare("ownerOf", [row.squareId]);
      if (owner.toLowerCase() !== address.toLowerCase()) {
        throw new Error(`Your wallet does not own Square #${row.squareId}. Reload the page if your Squares have changed.`);
      }
    }));
  }
}

export function isAnimatedImage(bytes) {
  const text = (offset, length) => String.fromCharCode(...bytes.slice(offset, offset + length));
  if (bytes[0] === 137 && text(1, 3) === "PNG") {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    for (let offset = 8; offset + 12 <= bytes.length;) {
      if (text(offset + 4, 4) === "acTL") return true;
      offset += view.getUint32(offset) + 12;
    }
  }
  if (text(0, 3) === "GIF") {
    let offset = 13 + ((bytes[10] & 128) ? 3 * 2 ** ((bytes[10] & 7) + 1) : 0);
    let frames = 0;
    const skipBlocks = () => {
      while (offset < bytes.length) {
        const length = bytes[offset++];
        if (!length) break;
        offset += length;
      }
    };
    while (offset < bytes.length) {
      const marker = bytes[offset++];
      if (marker === 0x3b) break;
      if (marker === 0x21) {
        offset++; // Extension label, followed by length-prefixed data blocks.
        skipBlocks();
      } else if (marker === 0x2c) {
        if (++frames > 1) return true;
        const flags = bytes[offset + 8];
        offset += 9 + ((flags & 128) ? 3 * 2 ** ((flags & 7) + 1) : 0);
        offset++; // LZW minimum code size, followed by image data blocks.
        skipBlocks();
      } else {
        throw new Error("Unable to read GIF image.");
      }
    }
  }
  return false;
}
