import { describe, it, expect } from 'vitest';
import { isMintInternalLink, shouldHideUriLabel } from '@billboard/wrappers/link-label-utils.js';

describe('link-label-utils extra', () => {
  it('does not hide labels for internal mint links', () => {
    const baseurl = 'https://tenthousandsu.com';

    expect(shouldHideUriLabel('example.com', '/mint', baseurl)).toBe(false);
    expect(shouldHideUriLabel('http://example.com', '/mint/step', baseurl)).toBe(false);
  });

  it('detects internal mint links by origin', () => {
    const baseurl = 'https://tenthousandsu.com/site';

    expect(isMintInternalLink('/mint', baseurl)).toBe(true);
    expect(isMintInternalLink('/mint?ref=home', baseurl)).toBe(true);
    expect(isMintInternalLink('https://example.com/mint', baseurl)).toBe(false);
  });
});
