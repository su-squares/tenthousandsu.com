/**
 * WalletConnect constants and utilities for mobile deep linking.
 * This replaces wc-store.js with a simpler approach:
 * - No localStorage session persistence
 * - Placeholder URI for post-connection deep links
 * - Real URI only used during initial connection (in-memory)
 * @module wc-constants
 */

const MOBILE_QUERY = "(max-width: 730px)";

/**
 * Placeholder WalletConnect URI for triggering OS app chooser on mobile.
 * This does NOT contain any actual session information - it just opens
 * the native share sheet / app picker for wc: protocol handlers.
 */
export const PLACEHOLDER_WC_URI = "wc:susquares@2";

/**
 * Check if device is mobile/touch capable for deep link behavior.
 * @returns {boolean}
 */
export function isMobileDevice() {
    try {
        const touch = typeof navigator !== "undefined" && navigator.maxTouchPoints > 0;
        const media =
            typeof window !== "undefined" &&
            typeof window.matchMedia === "function" &&
            window.matchMedia(MOBILE_QUERY).matches;
        return Boolean(touch || media);
    } catch (_error) {
        return false;
    }
}

/**
 * Open the placeholder WC URI to trigger OS app chooser.
 * Does NOT expose any real WC session data - just opens the
 * system's handler for wc: protocol URIs.
 * @returns {boolean} true if attempted on a mobile device
 */
export function openWalletChooser() {
    if (!isMobileDevice()) return false;
    try {
        const link = document.createElement("a");
        link.href = PLACEHOLDER_WC_URI;
        link.style.display = "none";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        return true;
    } catch (_error) {
        return false;
    }
}

/**
 * Open a specific WalletConnect URI (used during initial connection only).
 * @param {string} uri - The full WC URI with session info
 * @returns {boolean} true if attempted
 */
export function openWalletDeepLink(uri) {
    if (!uri || !isMobileDevice()) return false;
    try {
        const link = document.createElement("a");
        link.href = uri;
        link.style.display = "none";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        return true;
    } catch (_error) {
        return false;
    }
}
