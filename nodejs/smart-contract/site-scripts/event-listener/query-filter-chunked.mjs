/**
 * Chunked queryFilter helper with auto-shrinking range on RPC limits.
 * Works with ethers v6 Contract.queryFilter(...) under the hood.
 */

function isRpcRangeLimitError(err) {
  const msg = String(err?.message ?? "");
  const code = err?.code;
  const nestedCode = err?.error?.code;
  const nestedMsg = String(err?.error?.message ?? "");

  const combined = (msg + " " + nestedMsg).toLowerCase();

  return (
    nestedCode === -32005 ||
    code === "UNKNOWN_ERROR" ||
    combined.includes("maximum rpc range limit") ||
    combined.includes("exceeds maximum rpc range") ||
    combined.includes("requested range exceeds") ||
    combined.includes("rpc-max-logs-range") ||
    combined.includes("too many results") ||
    combined.includes("log response size exceeded")
  );
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * @param {import("ethers").Contract} contract
 * @param {*} filter - contract.filters.Whatever(...)
 * @param {number} fromBlock
 * @param {number} toBlock
 * @param {{
 *   initialStep?: number,
 *   minStep?: number,
 *   maxStep?: number,
 *   backoffMs?: number,
 *   onChunk?: (info: { from: number, to: number, step: number, chunkCount: number, totalCount: number }) => void
 * }} opts
 */
export async function queryFilterChunked(contract, filter, fromBlock, toBlock, opts = {}) {
  if (fromBlock > toBlock) return [];

  const initialStep = Number.isFinite(opts.initialStep) ? Math.max(1, opts.initialStep) : 2000;
  const minStep = Number.isFinite(opts.minStep) ? Math.max(1, opts.minStep) : 25;
  const maxStep = Number.isFinite(opts.maxStep) ? Math.max(1, opts.maxStep) : 10000;
  const backoffMs = Number.isFinite(opts.backoffMs) ? Math.max(0, opts.backoffMs) : 150;

  const out = [];
  let step = initialStep;
  let start = fromBlock;

  while (start <= toBlock) {
    const end = Math.min(start + step - 1, toBlock);

    try {
      const chunk = await contract.queryFilter(filter, start, end);
      out.push(...chunk);

      if (typeof opts.onChunk === "function") {
        opts.onChunk({
          from: start,
          to: end,
          step,
          chunkCount: chunk.length,
          totalCount: out.length,
        });
      }

      start = end + 1;

      // If we’re succeeding, cautiously grow step up to maxStep (helps speed on permissive nodes).
      if (step < maxStep) {
        step = Math.min(maxStep, Math.floor(step * 1.25));
      }
    } catch (err) {
      if (isRpcRangeLimitError(err) && step > minStep) {
        step = Math.max(minStep, Math.floor(step / 2));
        if (backoffMs) await sleep(backoffMs);
        continue;
      }
      throw err;
    }
  }

  return out;
}
