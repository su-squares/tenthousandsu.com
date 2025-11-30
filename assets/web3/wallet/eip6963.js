/**
 * EIP-6963 Multi Injected Provider Discovery
 * @module eip6963
 */

const DEBUG = Boolean(window?.suWeb3?.debug);
const log = (...args) => {
  if (DEBUG) console.debug("[eip6963]", ...args);
};

/**
 * @typedef {Object} EIP6963ProviderInfo
 * @property {string} uuid - Unique identifier for the provider
 * @property {string} name - Human-readable name
 * @property {string} icon - Data URI or URL for the icon
 * @property {string} [rdns] - Reverse domain name identifier
 */

/**
 * @typedef {Object} EIP6963ProviderDetail
 * @property {EIP6963ProviderInfo} info
 * @property {import("viem").EIP1193Provider} provider
 */

/** @type {Map<string, EIP6963ProviderDetail>} */
const discoveredProviders = new Map();

/** @type {Array<(providers: Map<string, EIP6963ProviderDetail>) => void>} */
const listeners = [];

let isListening = false;

/**
 * Handle provider announcement
 * @param {CustomEvent<EIP6963ProviderDetail>} event
 */
function handleAnnouncement(event) {
  const { info, provider } = event.detail || {};
  if (!info?.uuid || !provider) return;

  log("Provider announced:", info.name, info);
  discoveredProviders.set(info.uuid, { info, provider });
  listeners.forEach((cb) => cb(discoveredProviders));
}

/**
 * Start listening for EIP-6963 provider announcements.
 * Call this early in app lifecycle.
 */
export function startEIP6963Discovery() {
  if (isListening) return;
  isListening = true;

  window.addEventListener("eip6963:announceProvider", handleAnnouncement);

  // Request providers to announce themselves
  window.dispatchEvent(new Event("eip6963:requestProvider"));
  log("Discovery started, request dispatched");
}

/**
 * Get all currently discovered providers
 * @returns {Map<string, EIP6963ProviderDetail>}
 */
export function getDiscoveredProviders() {
  return discoveredProviders;
}

/**
 * Subscribe to provider discovery updates
 * @param {(providers: Map<string, EIP6963ProviderDetail>) => void} callback
 * @returns {() => void} Unsubscribe function
 */
export function onProvidersChanged(callback) {
  listeners.push(callback);
  // Immediately call with current state
  if (discoveredProviders.size > 0) {
    callback(discoveredProviders);
  }
  return () => {
    const idx = listeners.indexOf(callback);
    if (idx !== -1) listeners.splice(idx, 1);
  };
}

/**
 * Wait for providers with a timeout
 * @param {number} [timeoutMs=500] - How long to wait for providers
 * @returns {Promise<Map<string, EIP6963ProviderDetail>>}
 */
export function waitForProviders(timeoutMs = 500) {
  startEIP6963Discovery();

  return new Promise((resolve) => {
    // If we already have providers, resolve quickly but give a small window for more
    const hasProviders = discoveredProviders.size > 0;
    const waitTime = hasProviders ? Math.min(100, timeoutMs) : timeoutMs;

    setTimeout(() => {
      resolve(discoveredProviders);
    }, waitTime);
  });
}