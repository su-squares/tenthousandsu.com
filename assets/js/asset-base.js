import { getRuntimeFlags } from "../web3/config/runtime.js";

function readRuntimeConfig() {
  if (typeof window === "undefined") return null;
  return window.suWeb3 || window.SU_WEB3 || null;
}

function normalizeBase(base) {
  const baseurl = (window.SITE_BASEURL || "").trim().replace(/\/+$/, "");
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
  const baseurl = (window.SITE_BASEURL || "").trim().replace(/\/+$/, "");
  const base = assetBases?.[chain] || (baseurl + "/build");
  return normalizeBase(base);
}

export function hasRuntimeConfig() {
  const raw = readRuntimeConfig();
  if (!raw || typeof raw !== "object") return false;
  return Object.keys(raw).length > 0;
}

export function assetPath(relativePath) {
  const base = getAssetBase();
  const suffix = relativePath.startsWith("/") ? relativePath : `/${relativePath}`;
  return `${base}${suffix}`;
}
