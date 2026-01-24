import {
  extractScheme,
  isBlockedScheme,
  isHttpScheme,
  classifyUri,
  normalizeHref,
  isSafeInternalPath,
  URI_CLASSIFICATION
} from '../../../../assets/js/link-utils.js';

const originalWindow = globalThis.window;

describe('link-utils', () => {
  afterEach(() => {
    (globalThis as any).window = originalWindow;
  });

  describe('extractScheme', () => {
    it('should extract http scheme', () => {
      expect(extractScheme('http://example.com')).toBe('http');
    });

    it('should extract https scheme', () => {
      expect(extractScheme('https://example.com/path')).toBe('https');
    });

    it('should extract mailto scheme', () => {
      expect(extractScheme('mailto:test@example.com')).toBe('mailto');
    });

    it('should extract tel scheme', () => {
      expect(extractScheme('tel:+1234567890')).toBe('tel');
    });

    it('should extract custom schemes', () => {
      expect(extractScheme('myapp://path')).toBe('myapp');
      expect(extractScheme('custom-scheme://test')).toBe('custom-scheme');
    });

    it('should handle URL-encoded javascript scheme', () => {
      expect(extractScheme('%6A%61%76%61%73%63%72%69%70%74:alert(1)')).toBe('javascript');
    });

    it('should handle double-encoded javascript scheme', () => {
      expect(extractScheme('%256A%2561%2576%2561%2573%2563%2572%2569%2570%2574:alert(1)')).toBe('javascript');
    });

    it('should handle mixed-case encoded schemes', () => {
      expect(extractScheme('JaVaScRiPt:alert(1)')).toBe('javascript');
    });

    it('should return lowercase scheme', () => {
      expect(extractScheme('HTTP://EXAMPLE.COM')).toBe('http');
      expect(extractScheme('MAILTO:TEST@EXAMPLE.COM')).toBe('mailto');
    });

    it('should return null for relative URLs', () => {
      expect(extractScheme('/path/to/file')).toBeNull();
      expect(extractScheme('./relative')).toBeNull();
      expect(extractScheme('../parent')).toBeNull();
    });

    it('should return null for empty/null/invalid input', () => {
      expect(extractScheme('')).toBeNull();
      expect(extractScheme(null as any)).toBeNull();
      expect(extractScheme(undefined as any)).toBeNull();
      expect(extractScheme('   ')).toBeNull();
    });

    it('should return null for URLs without scheme', () => {
      expect(extractScheme('example.com')).toBeNull();
      expect(extractScheme('www.example.com/path')).toBeNull();
    });

    it('should return null for invalid scheme characters', () => {
      expect(extractScheme('javascript%:alert(1)')).toBeNull();
    });
  });

  describe('isBlockedScheme', () => {
    it('should block javascript scheme', () => {
      expect(isBlockedScheme('javascript')).toBe(true);
    });

    it('should block data scheme', () => {
      expect(isBlockedScheme('data')).toBe(true);
    });

    it('should block blob scheme', () => {
      expect(isBlockedScheme('blob')).toBe(true);
    });

    it('should block vbscript scheme', () => {
      expect(isBlockedScheme('vbscript')).toBe(true);
    });

    it('should block file scheme', () => {
      expect(isBlockedScheme('file')).toBe(true);
    });

    it('should not block http scheme', () => {
      expect(isBlockedScheme('http')).toBe(false);
    });

    it('should not block https scheme', () => {
      expect(isBlockedScheme('https')).toBe(false);
    });

    it('should not block safe schemes', () => {
      expect(isBlockedScheme('mailto')).toBe(false);
      expect(isBlockedScheme('tel')).toBe(false);
      expect(isBlockedScheme('custom')).toBe(false);
    });
  });

  describe('isHttpScheme', () => {
    it('should recognize http', () => {
      expect(isHttpScheme('http')).toBe(true);
    });

    it('should recognize https', () => {
      expect(isHttpScheme('https')).toBe(true);
    });

    it('should not recognize other schemes', () => {
      expect(isHttpScheme('ftp')).toBe(false);
      expect(isHttpScheme('mailto')).toBe(false);
      expect(isHttpScheme('tel')).toBe(false);
      expect(isHttpScheme('javascript')).toBe(false);
    });
  });

  describe('isSafeInternalPath', () => {
    it('should recognize /buy as safe internal path', () => {
      const url = new URL('https://example.com/buy');
      expect(isSafeInternalPath(url)).toBe(true);
    });

    it('should recognize /buy/ as safe internal path', () => {
      const url = new URL('https://example.com/buy/');
      expect(isSafeInternalPath(url)).toBe(true);
    });

    it('should recognize /buy/123 as safe internal path', () => {
      const url = new URL('https://example.com/buy/123');
      expect(isSafeInternalPath(url)).toBe(true);
    });

    it('should not recognize other paths as safe', () => {
      expect(isSafeInternalPath(new URL('https://example.com/'))).toBe(false);
      expect(isSafeInternalPath(new URL('https://example.com/other'))).toBe(false);
      expect(isSafeInternalPath(new URL('https://example.com/buyable'))).toBe(false);
    });

    it('should handle null URL', () => {
      expect(isSafeInternalPath(null as any)).toBe(false);
    });
  });

  describe('classifyUri', () => {
    beforeEach(() => {
      (globalThis as any).window = {
        location: {
          origin: 'https://example.com',
          href: 'https://example.com/'
        }
      };
    });

    describe('blocked schemes', () => {
      it('should classify javascript: as blocked', () => {
        const result = classifyUri('javascript:alert(1)');
        expect(result.classification).toBe(URI_CLASSIFICATION.BLOCKED);
        expect(result.scheme).toBe('javascript');
        expect(result.displayUri).toBe('javascript:');
      });

      it('should classify data: as blocked', () => {
        const result = classifyUri('data:text/html,<script>alert(1)</script>');
        expect(result.classification).toBe(URI_CLASSIFICATION.BLOCKED);
        expect(result.scheme).toBe('data');
      });

      it('should classify encoded javascript: as blocked', () => {
        const result = classifyUri('%6A%61%76%61%73%63%72%69%70%74:alert(1)');
        expect(result.classification).toBe(URI_CLASSIFICATION.BLOCKED);
        expect(result.scheme).toBe('javascript');
      });

      it('should classify blob: as blocked', () => {
        const result = classifyUri('blob:https://example.com/123');
        expect(result.classification).toBe(URI_CLASSIFICATION.BLOCKED);
        expect(result.scheme).toBe('blob');
      });

      it('should classify vbscript: as blocked', () => {
        const result = classifyUri('vbscript:msgbox(1)');
        expect(result.classification).toBe(URI_CLASSIFICATION.BLOCKED);
        expect(result.scheme).toBe('vbscript');
      });

      it('should classify file: as blocked', () => {
        const result = classifyUri('file:///etc/passwd');
        expect(result.classification).toBe(URI_CLASSIFICATION.BLOCKED);
        expect(result.scheme).toBe('file');
      });
    });

    describe('relative URLs', () => {
      it('should classify absolute-path URLs as internal', () => {
        const result = classifyUri('/path/to/page');
        expect(result.classification).toBe(URI_CLASSIFICATION.INTERNAL);
        expect(result.displayUri).toBe('/path/to/page');
        expect(result.url?.pathname).toBe('/path/to/page');
      });

      it('should classify relative-path URLs as internal', () => {
        const result = classifyUri('./page');
        expect(result.classification).toBe(URI_CLASSIFICATION.INTERNAL);
        expect(result.displayUri).toBe('./page');
      });

      it('should classify parent-path URLs as internal', () => {
        const result = classifyUri('../page');
        expect(result.classification).toBe(URI_CLASSIFICATION.INTERNAL);
        expect(result.displayUri).toBe('../page');
      });

      it('should classify query-only URLs as internal', () => {
        const result = classifyUri('?query=value');
        expect(result.classification).toBe(URI_CLASSIFICATION.INTERNAL);
        expect(result.displayUri).toBe('?query=value');
      });

      it('should classify hash-only URLs as internal', () => {
        const result = classifyUri('#section');
        expect(result.classification).toBe(URI_CLASSIFICATION.INTERNAL);
        expect(result.displayUri).toBe('#section');
      });

      it('should classify relative URLs with custom origin', () => {
        const result = classifyUri('/path', 'https://example.com');
        expect(result.classification).toBe(URI_CLASSIFICATION.INTERNAL);

        const external = classifyUri('/path', 'https://other.com');
        expect(external.classification).toBe(URI_CLASSIFICATION.EXTERNAL);
      });
    });

    describe('protocol-relative URLs', () => {
      it('should classify same-origin protocol-relative URL as internal', () => {
        const result = classifyUri('//example.com/path');
        expect(result.classification).toBe(URI_CLASSIFICATION.INTERNAL);
        expect(result.url?.origin).toBe('https://example.com');
      });

      it('should classify different-origin protocol-relative URL as external', () => {
        const result = classifyUri('//other.com/path');
        expect(result.classification).toBe(URI_CLASSIFICATION.EXTERNAL);
        expect(result.url?.origin).toBe('https://other.com');
      });

      it('should handle malformed protocol-relative URLs', () => {
        const result = classifyUri('//');
        expect(result.classification).toBe(URI_CLASSIFICATION.BLOCKED);
      });

      it('should use custom origin for protocol-relative URLs', () => {
        const result = classifyUri('//example.com/path', 'https://example.com');
        expect(result.classification).toBe(URI_CLASSIFICATION.INTERNAL);
      });
    });

    describe('external vs internal URLs', () => {
      it('should classify same-origin https URL as internal', () => {
        const result = classifyUri('https://example.com/path');
        expect(result.classification).toBe(URI_CLASSIFICATION.INTERNAL);
      });

      it('should classify different-origin https URL as external', () => {
        const result = classifyUri('https://other.com/path');
        expect(result.classification).toBe(URI_CLASSIFICATION.EXTERNAL);
        expect(result.displayUri).toBe('https://other.com/path');
      });

      it('should classify http URL to different origin as external', () => {
        const result = classifyUri('http://other.com/path');
        expect(result.classification).toBe(URI_CLASSIFICATION.EXTERNAL);
      });

      it('should auto-prefix https for domain-only input', () => {
        const result = classifyUri('google.com');
        expect(result.classification).toBe(URI_CLASSIFICATION.EXTERNAL);
        expect(result.displayUri).toBe('https://google.com/');
        expect(result.scheme).toBe('https');
      });
    });

    describe('deeplinks', () => {
      it('should classify mailto: as deeplink', () => {
        const result = classifyUri('mailto:test@example.com');
        expect(result.classification).toBe(URI_CLASSIFICATION.DEEPLINK);
        expect(result.scheme).toBe('mailto');
      });

      it('should classify tel: as deeplink', () => {
        const result = classifyUri('tel:+1234567890');
        expect(result.classification).toBe(URI_CLASSIFICATION.DEEPLINK);
        expect(result.scheme).toBe('tel');
      });

      it('should classify custom schemes as deeplink', () => {
        const result = classifyUri('myapp://action');
        expect(result.classification).toBe(URI_CLASSIFICATION.DEEPLINK);
        expect(result.scheme).toBe('myapp');
      });

      it('should classify sms: as deeplink', () => {
        const result = classifyUri('sms:+1234567890');
        expect(result.classification).toBe(URI_CLASSIFICATION.DEEPLINK);
      });
    });

    describe('edge cases', () => {
      it('should handle empty string', () => {
        const result = classifyUri('');
        expect(result.classification).toBe(URI_CLASSIFICATION.BLOCKED);
        expect(result.displayUri).toBe('');
      });

      it('should handle null', () => {
        const result = classifyUri(null as any);
        expect(result.classification).toBe(URI_CLASSIFICATION.BLOCKED);
      });

      it('should handle undefined', () => {
        const result = classifyUri(undefined as any);
        expect(result.classification).toBe(URI_CLASSIFICATION.BLOCKED);
      });

      it('should handle whitespace-only string', () => {
        const result = classifyUri('   ');
        expect(result.classification).toBe(URI_CLASSIFICATION.BLOCKED);
      });

      it('should handle malformed URLs as blocked', () => {
        const result = classifyUri('http://[invalid');
        expect(result.classification).toBe(URI_CLASSIFICATION.BLOCKED);
      });
    });

    describe('custom origin', () => {
      it('should use custom origin for classification', () => {
        const result = classifyUri('https://example.com/path', 'https://example.com');
        expect(result.classification).toBe(URI_CLASSIFICATION.INTERNAL);
      });

      it('should detect external with custom origin', () => {
        const result = classifyUri('https://other.com/path', 'https://example.com');
        expect(result.classification).toBe(URI_CLASSIFICATION.EXTERNAL);
      });
    });
  });

  describe('normalizeHref', () => {
    it('should return empty string for blocked schemes', () => {
      expect(normalizeHref('javascript:alert(1)')).toBe('');
      expect(normalizeHref('data:text/html,<script>')).toBe('');
      expect(normalizeHref('blob:https://example.com/123')).toBe('');
      expect(normalizeHref('vbscript:msgbox(1)')).toBe('');
      expect(normalizeHref('file:///etc/passwd')).toBe('');
    });

    it('should return empty string for encoded javascript', () => {
      expect(normalizeHref('%6A%61%76%61%73%63%72%69%70%74:alert(1)')).toBe('');
    });

    it('should keep relative URLs unchanged', () => {
      expect(normalizeHref('/path/to/page')).toBe('/path/to/page');
      expect(normalizeHref('./relative')).toBe('./relative');
      expect(normalizeHref('../parent')).toBe('../parent');
      expect(normalizeHref('?query=value')).toBe('?query=value');
      expect(normalizeHref('#section')).toBe('#section');
    });

    it('should keep protocol-relative URLs unchanged', () => {
      expect(normalizeHref('//example.com/path')).toBe('//example.com/path');
    });

    it('should keep URLs with existing schemes unchanged', () => {
      expect(normalizeHref('http://example.com')).toBe('http://example.com');
      expect(normalizeHref('https://example.com/path')).toBe('https://example.com/path');
      expect(normalizeHref('mailto:test@example.com')).toBe('mailto:test@example.com');
      expect(normalizeHref('tel:+1234567890')).toBe('tel:+1234567890');
    });

    it('should prefix https:// for domain-only input', () => {
      expect(normalizeHref('example.com')).toBe('https://example.com');
      expect(normalizeHref('www.example.com')).toBe('https://www.example.com');
      expect(normalizeHref('example.com/path')).toBe('https://example.com/path');
    });

    it('should handle empty/null input', () => {
      expect(normalizeHref('')).toBe('');
      expect(normalizeHref(null as any)).toBe('');
      expect(normalizeHref(undefined as any)).toBe('');
      expect(normalizeHref('   ')).toBe('');
    });

    it('should trim whitespace', () => {
      expect(normalizeHref('  example.com  ')).toBe('https://example.com');
      expect(normalizeHref('  /path  ')).toBe('/path');
    });
  });
});
