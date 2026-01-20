import { beforeEach, afterEach, vi } from 'vitest';
import { setupLocalStorageShim } from './localStorage-shim';

// Setup localStorage
setupLocalStorageShim();

// Disable CSS file loading in happy-dom so tests don't try to fetch real assets (e.g. /assets/...css)
(() => {
  const w = globalThis as unknown as { window?: any };
  const happyDOM = w.window?.happyDOM;

  if (happyDOM?.settings) {
    happyDOM.settings.disableCSSFileLoading = true;
    happyDOM.settings.handleDisabledFileLoadingAsSuccess = true;
  }
})();

// Mock window.alert (happy-dom doesn't have it)
if (typeof window !== 'undefined' && !window.alert) {
  (window as any).alert = vi.fn();
}

// Global beforeEach
beforeEach(() => {
  // Clear localStorage before each test
  localStorage.clear();

  // Clear all timers
  vi.clearAllTimers();

  // Reset DOM
  document.body.innerHTML = '';

  // Mock window.SITE_BASEURL
  (window as any).SITE_BASEURL = '';
});

// Global afterEach
afterEach(() => {
  // Clear all timers
  vi.clearAllTimers();

  // Clear all mocks
  vi.clearAllMocks();
});

// Mock console methods for cleaner test output
global.console = {
  ...console,
  warn: vi.fn(),
  error: vi.fn(),
  log: vi.fn()
};
