
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { DomainBlocklist } from '../../../../assets/blocklist/blocklist-domains.js';

describe('blocklist-domains', () => {
  beforeEach(() => {
    DomainBlocklist.clear();
    global.fetch = vi.fn();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  
  afterEach(() => {
    vi.restoreAllMocks();
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
      expect(DomainBlocklist.isDomainBlockedByHref(null)).toBe(false);
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
      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(['bad.com', 'evil.org'])
      });

      await DomainBlocklist.load();
      
      expect(DomainBlocklist.count()).toBe(2);
      expect(DomainBlocklist.isDomainBlocked('bad.com')).toBe(true);
      expect(DomainBlocklist.isDomainBlocked('evil.org')).toBe(true);
    });

    it('should handle fetch error gracefully', async () => {
      global.fetch.mockResolvedValue({
        ok: false,
        status: 404
      });

      await DomainBlocklist.load();
      expect(DomainBlocklist.count()).toBe(0);
    });
  });
});
