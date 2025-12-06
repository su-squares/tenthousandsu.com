import { getRuntimeFlags } from "../web3/config/runtime.js";

function normalizeBase(base) {
  const baseurl = window.SITE_BASEURL || '';
  if (!base) return baseurl + "/build";
  // Ensure leading slash and no trailing slash
  let normalized = base.trim();
  if (!normalized.startsWith("/")) {
    normalized = "/" + normalized;
  }
  return normalized.replace(/\/+$/, "");
}

export function getAssetBase() {
  const { chain, assetBases } = getRuntimeFlags();
  const baseurl = window.SITE_BASEURL || '';
  const base = assetBases?.[chain] || (baseurl + "/build");
  return normalizeBase(base);
}

export function assetPath(relativePath) {
  const base = getAssetBase();
  const suffix = relativePath.startsWith("/") ? relativePath : `/${relativePath}`;
  return `${base}${suffix}`;
}
