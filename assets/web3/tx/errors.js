import { getWeb3Config } from "../config/index.js";

function collectMessageParts(error) {
  return [
    error?.message,
    error?.shortMessage,
    error?.cause?.message,
    error?.cause?.shortMessage,
  ].filter(Boolean);
}

function isChainMismatchError(error, combinedMessage) {
  const name = String(error?.name || error?.cause?.name || "").toLowerCase();
  if (name.includes("chainmismatch")) return true;

  const message = String(combinedMessage || "").toLowerCase();
  if (
    message.includes("chain mismatch") ||
    message.includes("expected chain id") ||
    message.includes("expected chain") ||
    message.includes("current chain of the wallet") ||
    message.includes("does not match the target chain") ||
    message.includes("received \"chain")
  ) {
    return true;
  }

  return message.includes("expected") && message.includes("received") && message.includes("chain");
}

function getActiveNetworkLabel() {
  try {
    const { activeNetwork } = getWeb3Config();
    return activeNetwork?.label || null;
  } catch (_error) {
    return null;
  }
}

function buildChainMismatchMessage(isWalletConnect) {
  const label = getActiveNetworkLabel() || "the correct network";
  const base = `Please switch your wallet to ${label} and try again.`;
  if (!isWalletConnect) return base;
  return `${base} If you are using WalletConnect, disconnect the session, switch networks in your wallet app, then reconnect.`;
}

function isInsufficientFundsError(error, combinedMessage) {
  const code = error?.code || error?.cause?.code;
  if (code === "INSUFFICIENT_FUNDS" || code === "INSUFFICIENT_FUNDS_FOR_GAS") return true;
  const message = String(combinedMessage || "").toLowerCase();
  return (
    message.includes("insufficient funds") ||
    message.includes("exceeds the balance") ||
    message.includes("gas * price + value") ||
    message.includes("total cost") ||
    message.includes("not enough funds")
  );
}

function parseHaveWantWei(message) {
  const match = /have\s+(\d+)\s+want\s+(\d+)/i.exec(message || "");
  if (!match) return null;
  try {
    return { have: BigInt(match[1]), want: BigInt(match[2]) };
  } catch (_error) {
    return null;
  }
}

function parseValueWei(message) {
  if (!message) return null;
  const ethMatch = /value:\s*([0-9]+(?:\.[0-9]+)?)\s*eth/i.exec(message);
  if (ethMatch) {
    return parseEthToWei(ethMatch[1]);
  }
  const weiMatch = /value:\s*(\d+)\b/i.exec(message);
  if (weiMatch) {
    try {
      return BigInt(weiMatch[1]);
    } catch (_error) {
      return null;
    }
  }
  return null;
}

function parseEthToWei(raw) {
  if (!raw) return null;
  const cleaned = String(raw).trim();
  if (!/^\d+(\.\d+)?$/.test(cleaned)) return null;
  const [wholeRaw, fracRaw = ""] = cleaned.split(".");
  const whole = wholeRaw || "0";
  const frac = (fracRaw || "").slice(0, 18).padEnd(18, "0");
  const weiString = `${whole}${frac}`.replace(/^0+(?=\d)/, "");
  try {
    return BigInt(weiString || "0");
  } catch (_error) {
    return null;
  }
}

function formatEthFromWei(wei, maxDecimals = 6) {
  if (typeof wei !== "bigint") return null;
  const negative = wei < 0n;
  const abs = negative ? -wei : wei;
  const base = 10n ** 18n;
  const whole = abs / base;
  const frac = abs % base;
  let fracStr = frac.toString().padStart(18, "0").slice(0, maxDecimals);
  fracStr = fracStr.replace(/0+$/, "");
  const sign = negative ? "-" : "";
  return fracStr ? `${sign}${whole.toString()}.${fracStr}` : `${sign}${whole.toString()}`;
}

function buildInsufficientFundsMessage(message) {
  const haveWant = parseHaveWantWei(message);
  const valueWei = parseValueWei(message);
  if (haveWant && valueWei !== null) {
    if (haveWant.have < valueWei) {
      const shortValueWei = valueWei - haveWant.have;
      const shortValueEth = formatEthFromWei(shortValueWei);
      const haveEth = formatEthFromWei(haveWant.have);
      const valueEth = formatEthFromWei(valueWei);
      const detail = haveEth && valueEth ? ` Balance ~${haveEth} ETH, value ${valueEth} ETH.` : "";
      return `You need about ${shortValueEth ?? "more"} ETH to afford the transaction value (not including gas).${detail}`;
    }
    const shortTotalWei = haveWant.want - haveWant.have;
    const shortTotalEth = formatEthFromWei(shortTotalWei);
    const haveEth = formatEthFromWei(haveWant.have);
    const valueEth = formatEthFromWei(valueWei);
    const wantEth = formatEthFromWei(haveWant.want);
    const detailParts = [];
    if (haveEth) detailParts.push(`Balance ~${haveEth} ETH`);
    if (valueEth) detailParts.push(`value ${valueEth} ETH`);
    if (wantEth) detailParts.push(`total ~${wantEth} ETH`);
    const detail = detailParts.length ? ` ${detailParts.join(", ")}.` : "";
    return `You can cover the value, but need about ${shortTotalEth ?? "more"} ETH for gas.${detail}`;
  }
  if (haveWant) {
    const shortTotalWei = haveWant.want - haveWant.have;
    const shortTotalEth = formatEthFromWei(shortTotalWei);
    return `You need about ${shortTotalEth ?? "more"} ETH to cover the total cost (fee + gas).`;
  }
  return "You don't have enough ETH to cover the total cost (fee + gas) for this transaction.";
}

function isUserRejected(error, combinedMessage) {
  const code = error?.code || error?.cause?.code;
  if (code === 4001 || code === "ACTION_REJECTED") return true;
  const message = String(combinedMessage || "").toLowerCase();
  return (
    message.includes("user rejected") ||
    message.includes("user denied") ||
    message.includes("request rejected") ||
    message.includes("rejected the request")
  );
}

function isRateLimited(message) {
  const text = String(message || "").toLowerCase();
  return (
    text.includes("rate limit") ||
    text.includes("too many requests") ||
    text.includes("429")
  );
}

function isNonceIssue(message) {
  const text = String(message || "").toLowerCase();
  return (
    text.includes("nonce too low") ||
    text.includes("replacement transaction underpriced") ||
    text.includes("already known") ||
    text.includes("known transaction")
  );
}

function isGasIssue(message) {
  const text = String(message || "").toLowerCase();
  return (
    text.includes("intrinsic gas too low") ||
    text.includes("gas required exceeds allowance") ||
    text.includes("out of gas") ||
    text.includes("gas limit too low")
  );
}

function isGasTipTooLow(message) {
  const text = String(message || "").toLowerCase();
  return (
    text.includes("gas price below minimum") ||
    (text.includes("gas tip cap") && text.includes("minimum needed"))
  );
}

function buildGasTipTooLowMessage(message) {
  const raw = String(message || "");
  const minMatch = /minimum needed\s+(\d+)/i.exec(raw);
  if (minMatch && minMatch[1]) {
    return `Gas tip is too low. Minimum required is ${minMatch[1]}. Increase the priority fee and retry.`;
  }
  return "Gas tip is too low. Increase the priority fee and retry.";
}

function isRpcUnavailable(message) {
  const text = String(message || "").toLowerCase();
  return (
    text.includes("network error") ||
    text.includes("failed to fetch") ||
    text.includes("timeout") ||
    text.includes("timed out") ||
    text.includes("connection refused") ||
    text.includes("econnrefused") ||
    text.includes("enotfound") ||
    text.includes("502") ||
    text.includes("503") ||
    text.includes("504")
  );
}

function isNoWallet(message) {
  const text = String(message || "").toLowerCase();
  return (
    text.includes("connector not found") ||
    text.includes("no injected provider") ||
    text.includes("no accounts") ||
    text.includes("not connected")
  );
}

function extractRevertReason(message) {
  const raw = String(message || "");
  const match = /execution reverted(?::\s*([^\n]+))?/i.exec(raw);
  if (match && match[1]) return match[1].trim();
  const reasonMatch = /reverted(?::\s*([^\n]+))?/i.exec(raw);
  if (reasonMatch && reasonMatch[1]) return reasonMatch[1].trim();
  return null;
}

function isSimulationFailure(message) {
  const text = String(message || "").toLowerCase();
  return (
    text.includes("simulate") &&
    (text.includes("revert") || text.includes("reverted"))
  );
}

export function getTxErrorMessage(error, { isWalletConnect } = {}) {
  const parts = collectMessageParts(error);
  const combined = parts.join(" ");
  if (isChainMismatchError(error, combined)) {
    return buildChainMismatchMessage(isWalletConnect);
  }
  if (isInsufficientFundsError(error, combined)) {
    return buildInsufficientFundsMessage(combined);
  }
  if (isUserRejected(error, combined)) {
    return "Transaction cancelled in your wallet.";
  }
  if (isGasTipTooLow(combined)) {
    return buildGasTipTooLowMessage(combined);
  }
  if (isRateLimited(combined)) {
    return "RPC rate-limited. Wait a moment and try again.";
  }
  if (isNonceIssue(combined)) {
    return "You already have a pending transaction. Speed it up or wait for it to confirm.";
  }
  if (isGasIssue(combined)) {
    return "Gas limit looks too low. Try again or increase gas.";
  }
  if (isRpcUnavailable(combined)) {
    return "RPC unavailable. Check your connection or try again.";
  }
  if (isNoWallet(combined)) {
    return "No wallet connected. Please connect a wallet to continue.";
  }
  const revertReason = extractRevertReason(combined);
  if (revertReason) {
    return `Transaction reverted: ${revertReason}`;
  }
  if (isSimulationFailure(combined)) {
    return "Transaction would fail (simulation reverted). Check inputs or try a different square.";
  }
  return parts[0] || "Transaction failed";
}
