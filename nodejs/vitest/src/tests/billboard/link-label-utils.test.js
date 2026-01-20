import { describe, it, expect } from 'vitest';
import { shouldHideUriLabel } from '@billboard/wrappers/link-label-utils.js';

describe('link-label-utils', () => {
    describe('shouldHideUriLabel', () => {
        it('should return false for normal text labels', () => {
            expect(shouldHideUriLabel('My Awesome Site', 'https://example.com')).toBe(false);
        });

        it('should return true if label duplicates the href', () => {
            expect(shouldHideUriLabel('https://example.com', 'https://example.com')).toBe(true);
            expect(shouldHideUriLabel('example.com', 'example.com')).toBe(true);
        });

        it('should return true if label looks like a URI', () => {
            expect(shouldHideUriLabel('sub.domain.com', 'https://other.com')).toBe(true);
            expect(shouldHideUriLabel('http://insecure.com', 'https://secure.com')).toBe(true);
        });

        it('should return false for empty label', () => {
            // function says: if (!labelString) return false;
            expect(shouldHideUriLabel('', 'https://example.com')).toBe(false);
        });
    });
});

