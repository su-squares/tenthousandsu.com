import { vi } from 'vitest';

export function setupLocalStorageShim() {
  const storage = new Map<string, string>();

  const localStorageMock: Storage = {
    getItem: vi.fn((key: string) => storage.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      storage.set(key, value);
    }),
    removeItem: vi.fn((key: string) => {
      storage.delete(key);
    }),
    clear: vi.fn(() => {
      storage.clear();
    }),
    key: vi.fn((index: number) => {
      const keys = Array.from(storage.keys());
      return keys[index] ?? null;
    }),
    get length() {
      return storage.size;
    }
  };

  Object.defineProperty(window, 'localStorage', {
    value: localStorageMock,
    writable: true
  });
}
