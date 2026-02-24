import { describe, it, expect } from 'vitest';
import { isMintInternalLink, shouldHideUriLabel } from '@billboard/wrappers/link-label-utils.js';

describe('link-label-utils extra', () => {
  it('does not hide labels for internal buy links', () => {
    const baseurl = 'https://tenthousandsu.com';

    expect(shouldHideUriLabel('example.com', '/buy', baseurl)).toBe(false);
    expect(shouldHideUriLabel('http://example.com', '/buy/step', baseurl)).toBe(false);
  });

  it('detects internal buy links by origin', () => {
    const baseurl = 'https://tenthousandsu.com/site';

    expect(isMintInternalLink('/buy', baseurl)).toBe(true);
    expect(isMintInternalLink('/buy?ref=home', baseurl)).toBe(true);
    expect(isMintInternalLink('https://example.com/buy', baseurl)).toBe(false);
  });
});
