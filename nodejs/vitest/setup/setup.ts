import { beforeEach, afterEach, vi } from 'vitest';
import { setupLocalStorageShim } from './localStorage-shim';

// Setup localStorage
setupLocalStorageShim();

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
