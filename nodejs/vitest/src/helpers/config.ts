import { vi } from 'vitest';

/**
 * Mock window.suWeb3 configuration object
 */
export function mockWeb3Config(config: Partial<any>) {
  (window as any).suWeb3 = config;
}

/**
 * Clear window.suWeb3 and window.SU_WEB3 configuration
 */
export function clearWeb3Config() {
  delete (window as any).suWeb3;
  delete (window as any).SU_WEB3;
}

/**
 * Reset vitest module cache to force re-import
 */
export async function resetConfigModule() {
  vi.resetModules();
}

/**
 * Mock window.SITE_BASEURL
 */
export function mockSiteBaseUrl(baseurl: string) {
  (window as any).SITE_BASEURL = baseurl;
}

/**
 * Clear window.SITE_BASEURL
 */
export function clearSiteBaseUrl() {
  delete (window as any).SITE_BASEURL;
}
