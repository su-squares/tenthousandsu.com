import { getAssetBase, hasRuntimeConfig } from "../js/asset-base.js";

/**
 * Schedule a delayed runtime config check to swap billboard assets if needed.
 * Returns a cleanup function to cancel the pending check.
 */
export function scheduleBillboardRuntimeFallback(options = {}) {
  const { delayMs = 2500, onChange } = options;
  if (typeof window === "undefined") return () => {};

  const initialAssetBase = getAssetBase();
  const timer = window.setTimeout(() => {
    if (!hasRuntimeConfig()) return;
    const latestAssetBase = getAssetBase();
    if (latestAssetBase === initialAssetBase) return;
    if (typeof onChange === "function") {
      onChange({ initialAssetBase, latestAssetBase });
    }
  }, delayMs);

  return () => {
    window.clearTimeout(timer);
  };
}
