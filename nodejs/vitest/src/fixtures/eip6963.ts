import { vi } from 'vitest';

/**
 * Create a mock EIP-6963 provider with customizable properties
 */
export function createMockEIP6963Provider(overrides: any = {}) {
  const defaultInfo = {
    uuid: 'mock-uuid-1234',
    name: 'Mock Wallet',
    icon: 'data:image/svg+xml;base64,PHN2Zy8+',
    rdns: 'com.mock.wallet'
  };

  return {
    info: {
      ...defaultInfo,
      ...overrides.info
    },
    provider: {
      request: vi.fn(),
      on: vi.fn(),
      removeListener: vi.fn(),
      ...overrides.provider
    }
  };
}

/**
 * Create a Map of multiple mock EIP-6963 providers
 */
export function createMockProviderMap(count: number = 1) {
  const map = new Map();
  for (let i = 0; i < count; i++) {
    const provider = createMockEIP6963Provider({
      info: {
        uuid: `mock-uuid-${i}`,
        name: `Mock Wallet ${i}`,
        rdns: `com.mock.wallet${i}`
      }
    });
    map.set(provider.info.uuid, provider);
  }
  return map;
}
