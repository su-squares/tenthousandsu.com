import { DomainBlocklist } from '../../../../assets/blocklist/blocklist-domains.js';

const originalFetch = globalThis.fetch;

describe('blocklist-domains', () => {
  beforeEach(() => {
    DomainBlocklist.clear();
    (globalThis as any).fetch = vi.fn();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  
  afterEach(() => {
    vi.restoreAllMocks();
    if (originalFetch) {
      globalThis.fetch = originalFetch;
    } else {
      delete (globalThis as any).fetch;
    }
  });

  it('should start empty', () => {
    expect(DomainBlocklist.count()).toBe(0);
    expect(DomainBlocklist.isDomainBlocked('anything.com')).toBe(false);
  });

  describe('addDomain / isDomainBlocked', () => {
    it('should block exact domain', () => {
      DomainBlocklist.addDomain('evil.com');
      expect(DomainBlocklist.isDomainBlocked('evil.com')).toBe(true);
      expect(DomainBlocklist.isDomainBlocked('good.com')).toBe(false);
    });

    it('should block subdomains of blocked domain', () => {
      DomainBlocklist.addDomain('evil.com');
      expect(DomainBlocklist.isDomainBlocked('sub.evil.com')).toBe(true);
      expect(DomainBlocklist.isDomainBlocked('deep.sub.evil.com')).toBe(true);
    });

    it('should block parent domains if subdomain is blocked', () => {
      DomainBlocklist.addDomain('sub.evil.com');
      expect(DomainBlocklist.isDomainBlocked('evil.com')).toBe(true);
    });

    it('should normalize domains (lowercase, trim)', () => {
      DomainBlocklist.addDomain('  EVIL.COM  ');
      expect(DomainBlocklist.isDomainBlocked('evil.com')).toBe(true);
    });
  });

  describe('isDomainBlockedByHref', () => {
    it('should extract and check domain from full URL', () => {
      DomainBlocklist.addDomain('evil.com');
      expect(DomainBlocklist.isDomainBlockedByHref('https://evil.com/path')).toBe(true);
      expect(DomainBlocklist.isDomainBlockedByHref('https://sub.evil.com/')).toBe(true);
      expect(DomainBlocklist.isDomainBlockedByHref('https://good.com/')).toBe(false);
    });

    it('should return false for invalid href', () => {
      expect(DomainBlocklist.isDomainBlockedByHref('')).toBe(false);
      expect(DomainBlocklist.isDomainBlockedByHref(null as any)).toBe(false);
    });
  });

  describe('extractDomain', () => {
    it('should extract domain from URL', () => {
      expect(DomainBlocklist.extractDomain('https://example.com/path')).toBe('example.com');
      expect(DomainBlocklist.extractDomain('http://Sub.Domain.COM/')).toBe('sub.domain.com');
    });

    it('should return null for non-http schemes', () => {
      expect(DomainBlocklist.extractDomain('mailto:test@example.com')).toBeNull();
      expect(DomainBlocklist.extractDomain('javascript:void(0)')).toBeNull();
    });
  });

  describe('removeDomain', () => {
    it('should remove a blocked domain', () => {
      DomainBlocklist.addDomain('evil.com');
      expect(DomainBlocklist.isDomainBlocked('evil.com')).toBe(true);
      DomainBlocklist.removeDomain('evil.com');
      expect(DomainBlocklist.isDomainBlocked('evil.com')).toBe(false);
    });
  });

  describe('load', () => {
    it('should load array of domains from JSON', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(['bad.com', 'evil.org'])
      });
      (globalThis as any).fetch = fetchMock;

      await DomainBlocklist.load();
      
      expect(DomainBlocklist.count()).toBe(2);
      expect(DomainBlocklist.isDomainBlocked('bad.com')).toBe(true);
      expect(DomainBlocklist.isDomainBlocked('evil.org')).toBe(true);
    });

    it('should clear list on non-array JSON', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ blocked: ['evil.com'] })
      });
      (globalThis as any).fetch = fetchMock;

      await DomainBlocklist.load();

      expect(DomainBlocklist.count()).toBe(0);
      expect(console.warn).toHaveBeenCalled();
    });

    it('should keep existing blocklist on fetch error', async () => {
      DomainBlocklist.addDomain('evil.com');

      const fetchMock = vi.fn().mockResolvedValue({
        ok: false,
        status: 500
      });
      (globalThis as any).fetch = fetchMock;

      await DomainBlocklist.load();

      expect(DomainBlocklist.isDomainBlocked('evil.com')).toBe(true);
    });

    it('should handle fetch error gracefully', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: false,
        status: 404
      });
      (globalThis as any).fetch = fetchMock;

      await DomainBlocklist.load();
      expect(DomainBlocklist.count()).toBe(0);
    });
  });

  describe('loadOnce', () => {
    it('should memoize loadOnce', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(['bad.com'])
      });
      (globalThis as any).fetch = fetchMock;

      await Promise.all([DomainBlocklist.loadOnce(), DomainBlocklist.loadOnce()]);

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(DomainBlocklist.isDomainBlocked('bad.com')).toBe(true);
    });
  });
});
