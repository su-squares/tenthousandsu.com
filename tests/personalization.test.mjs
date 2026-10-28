import test from "node:test";
import assert from "node:assert/strict";
import {
  parseBatch, validatePersonalizations, priceInEther, pricePerSquare,
  loadOwnedPage, verifyOwnership, isAnimatedImage
} from "../assets/personalization.mjs";

const rgbData = "0x" + "ff0000".repeat(100);
const makeRow = (overrides = {}) => ({
  squareId: 1234n, title: "My Square", href: "https://example.com", rgbData, ...overrides
});
const line = (overrides = {}) => {
  const row = makeRow(overrides);
  return [row.squareId, row.title, row.href, row.rgbData].join("\t");
};

test("batch format produces contract tuples, accepting CRLF and final line endings", () => {
  assert.deepEqual(parseBatch(line() + "\r\n" + line({ squareId: 10000n }) + "\r\n"), [
    makeRow(), makeRow({ squareId: 10000n })
  ]);
  assert.equal(parseBatch(line({ title: " Keep spaces ", href: "https://example.com " }))[0].title, " Keep spaces ");
});

test("rejects empty batches, missing/extra columns and interior blank lines", () => {
  for (const text of ["", " \n", "1234\tTitle\tURL", line() + "\textra", line() + "\n\n" + line({ squareId: 1n })]) {
    assert.throws(() => parseBatch(text));
  }
  assert.throws(() => validatePersonalizations([]), /at least one/);
});

test("Square IDs must be whole numbers in range and unique", () => {
  for (const squareId of ["0", "10001", "1.5", "1junk", "-1", "1e2", " 1", "1 "]) {
    assert.throws(() => parseBatch(line({ squareId })), /whole number/);
  }
  assert.throws(() => parseBatch(line({ squareId: "001" }) + "\n" + line({ squareId: 1n })), /repeated/);
  assert.equal(parseBatch(line({ squareId: 1n }))[0].squareId, 1n);
});

test("enforces UTF-8 byte limits rather than character limits", () => {
  assert.equal(parseBatch(line({ title: "é".repeat(32), href: "é".repeat(48) })).length, 1);
  for (const overrides of [{ title: "é".repeat(33) }, { href: "é".repeat(49) }, { title: "" }, { href: "" }]) {
    assert.throws(() => parseBatch(line(overrides)), /UTF-8 bytes/);
  }
  assert.throws(() => validatePersonalizations([makeRow({ title: "two\nlines" })]), /line breaks/);
});

test("requires exactly 300 bytes of RGB, with a hex prefix and no alpha", () => {
  for (const data of [null, "", rgbData.slice(2), rgbData + "00", rgbData.slice(0, -2), "0x" + "zz0000".repeat(100)]) {
    assert.throws(() => parseBatch(line({ rgbData: data })), /600 hexadecimal/);
  }
  assert.equal(parseBatch(line({ rgbData: rgbData.toUpperCase() }))[0].rgbData, rgbData);
});

test("prices every selected Square exactly without floating point artifacts", () => {
  for (const [count, expected] of [[0, "0"], [1, "0.001"], [4, "0.004"], [20, "0.02"], [999, "0.999"], [1000, "1"], [10000, "10"]]) {
    assert.equal(priceInEther(count), expected);
    assert.equal(BigInt(count) * pricePerSquare, BigInt(count) * 10n ** 15n);
  }
});

test("enumerates only 20 ownership indexes at a time, including the final partial page", async () => {
  const calls = [];
  const read = async (name, args) => {
    calls.push([name, ...args]);
    return 10000n - args[1] * 2n;
  };
  assert.equal((await loadOwnedPage(read, "wallet", 0, 45)).length, 20);
  assert.deepEqual(calls.map(call => call[2]), Array.from({ length: 20 }, (_, i) => BigInt(i)));
  assert.ok(calls.every(call => call[0] === "tokenOfOwnerByIndex" && call[1] === "wallet"));
  calls.length = 0;
  assert.equal((await loadOwnedPage(read, "wallet", 20, 45)).length, 20);
  assert.equal(calls[0][2], 20n);
  calls.length = 0;
  assert.deepEqual(await loadOwnedPage(read, "wallet", 40, 45), [9920n, 9918n, 9916n, 9914n, 9912n]);
  assert.equal(calls.length, 5);
  assert.deepEqual(await loadOwnedPage(read, "wallet", 45, 45), []);
  await assert.rejects(loadOwnedPage(async () => { throw new Error("RPC failed"); }, "wallet", 0, 1), /RPC failed/);
});

test("checks live ownership for all submitted Squares, not just those enumerated", async () => {
  const calls = [];
  const read = async (name, [id]) => {
    calls.push([name, id]);
    return "0xAbCd";
  };
  await verifyOwnership(read, "0xabcd", [makeRow(), makeRow({ squareId: 9999n })]);
  assert.deepEqual(calls, [["ownerOf", 1234n], ["ownerOf", 9999n]]);
  await assert.rejects(verifyOwnership(async () => "0xOther", "0xabcd", [makeRow()]), /does not own Square #1234/);
  await assert.rejects(verifyOwnership(async () => { throw new Error("RPC failed"); }, "0xabcd", [makeRow()]), /RPC failed/);
});

test("ownership checks bound concurrent RPC calls to 20", async () => {
  let active = 0;
  let maximum = 0;
  const read = async () => {
    active++;
    maximum = Math.max(active, maximum);
    await new Promise(resolve => setImmediate(resolve));
    active--;
    return "wallet";
  };
  await verifyOwnership(read, "wallet", Array.from({ length: 45 }, (_, i) => makeRow({ squareId: BigInt(i + 1) })));
  assert.equal(maximum, 20);
});

test("detects APNG animation without mistaking pixel data for chunk names", () => {
  const signature = [137, 80, 78, 71, 13, 10, 26, 10];
  const chunk = (type, data) => [0, 0, 0, data.length, ...Buffer.from(type), ...data, 0, 0, 0, 0];
  assert.equal(isAnimatedImage(Uint8Array.from([...signature, ...chunk("acTL", [0])])), true);
  assert.equal(isAnimatedImage(Uint8Array.from([...signature, ...chunk("IDAT", [...Buffer.from("acTL")])])), false);
});

test("allows a static GIF but rejects a GIF with multiple frames", () => {
  const header = [...Buffer.from("GIF89a"), 10, 0, 10, 0, 0, 0, 0];
  const frame = [0x2c, 0, 0, 0, 0, 10, 0, 10, 0, 0, 2, 2, 0x2c, 0, 0];
  const extension = [0x21, 0xf9, 4, 0, 0, 0, 0, 0];
  assert.equal(isAnimatedImage(Uint8Array.from([...header, ...extension, ...frame, 0x3b])), false);
  assert.equal(isAnimatedImage(Uint8Array.from([...header, ...extension, ...frame, ...frame, 0x3b])), true);
  assert.equal(isAnimatedImage(Uint8Array.from([0xff, 0xd8, 0xff])), false);
});
