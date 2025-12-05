import { getRuntimeFlags } from "/assets/web3/config/runtime.js";

function normalizeBase(base) {
  if (!base) return "/build";
  // Ensure leading slash and no trailing slash
  let normalized = base.trim();
  if (!normalized.startsWith("/")) {
    normalized = "/" + normalized;
  }
  return normalized.replace(/\/+$/, "");
}

export function getAssetBase() {
  const { chain, assetBases } = getRuntimeFlags();
  const base = assetBases?.[chain] || "/build";
  return normalizeBase(base);
}

export function assetPath(relativePath) {
  const base = getAssetBase();
  const suffix = relativePath.startsWith("/") ? relativePath : `/${relativePath}`;
  return `${base}${suffix}`;
}
