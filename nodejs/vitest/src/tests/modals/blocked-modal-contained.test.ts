import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createContainedBlockedModal } from '@modals/blocked-modal/blocked-modal-contained.js';

type BlockedVariant = 'domain' | 'uri' | 'square';

interface BlockedModalOptions {
  variant?: BlockedVariant;
}

interface BlockedModalController {
  show: (url: string | URL, options?: BlockedModalOptions) => void;
  hide: () => void;
  destroy: () => void;
  isVisible: boolean | null;
  isDestroyed: boolean;
}

describe('blocked-modal-contained', () => {
  let container: HTMLDivElement;
  let modal: BlockedModalController | null;

  beforeEach(() => {
    // Setup container
    container = document.createElement('div');
    container.style.width = '500px';
    container.style.height = '500px';
    document.body.appendChild(container);

    // Suppress console errors during tests
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    // Cleanup modal
    if (modal && !modal.isDestroyed) {
      modal.destroy();
    }
    modal = null;

    // Cleanup container
    if (container && container.parentNode) {
      container.parentNode.removeChild(container);
    }

    vi.restoreAllMocks();
  });

  describe('factory function', () => {
    it('should return null for invalid container', () => {
      const result = createContainedBlockedModal(null);
      expect(result).toBeNull();
    });

    it('should return null for non-HTMLElement container', () => {
      const result = createContainedBlockedModal('not-an-element' as unknown as HTMLElement);
      expect(result).toBeNull();
    });

    it('should return modal controller for valid container', () => {
      modal = createContainedBlockedModal(container);
      expect(modal).not.toBeNull();
      expect(modal!.show).toBeInstanceOf(Function);
      expect(modal!.hide).toBeInstanceOf(Function);
      expect(modal!.destroy).toBeInstanceOf(Function);
    });

    it('should set container position to relative if static', () => {
      container.style.position = 'static';
      modal = createContainedBlockedModal(container);
      expect(container.style.position).toBe('relative');
    });

    it('should not change container position if already positioned', () => {
      container.style.position = 'absolute';
      modal = createContainedBlockedModal(container);
      expect(container.style.position).toBe('absolute');
    });

    it('should preload stylesheets', () => {
      modal = createContainedBlockedModal(container);

      // Check that stylesheets were added
      const baseStylesheet = document.querySelector('link[href*="blocked-modal.css"]');
      const containedStylesheet = document.querySelector('link[href*="blocked-modal-contained.css"]');

      expect(baseStylesheet).not.toBeNull();
      expect(containedStylesheet).not.toBeNull();
    });
  });

  describe('variant handling', () => {
    beforeEach(() => {
      modal = createContainedBlockedModal(container);
    });

    it('should show domain variant by default', async () => {
      modal!.show('https://evil.com/');

      await vi.waitFor(() => {
        expect(modal!.isVisible).toBe(true);
      });

      const title = container.querySelector('.su-blocked__title');
      expect(title?.textContent).toBe('This link has been blocked for your protection');
    });

    it('should show domain variant content', async () => {
      modal!.show('https://evil.com/', { variant: 'domain' });

      await vi.waitFor(() => {
        expect(modal!.isVisible).toBe(true);
      });

      const title = container.querySelector('.su-blocked__title');
      const message = container.querySelector('.su-blocked__message') as HTMLElement;

      expect(title?.textContent).toBe('This link has been blocked for your protection');
      expect(message.style.display).toBe('none'); // No message for domain variant
    });

    it('should show uri variant content', async () => {
      modal!.show('javascript:alert(1)', { variant: 'uri' });

      await vi.waitFor(() => {
        expect(modal!.isVisible).toBe(true);
      });

      const title = container.querySelector('.su-blocked__title');
      const message = container.querySelector('.su-blocked__message') as HTMLElement;

      expect(title?.textContent).toBe('This deeplink is disallowed');
      expect(message.textContent).toBe('Certain URIs are known for malicious activity so we disable them by default.');
      expect(message.style.display).not.toBe('none');
    });

    it('should show square variant content', async () => {
      modal!.show('square:123', { variant: 'square' });

      await vi.waitFor(() => {
        expect(modal!.isVisible).toBe(true);
      });

      const title = container.querySelector('.su-blocked__title');
      const message = container.querySelector('.su-blocked__message') as HTMLElement;

      expect(title?.textContent).toBe('This square is disabled for your protection');
      expect(message.style.display).toBe('none'); // No message for square variant
    });

    it('should fallback to domain variant for unknown variants', async () => {
      modal!.show('https://evil.com/', { variant: 'unknown-variant' as BlockedVariant });

      await vi.waitFor(() => {
        expect(modal!.isVisible).toBe(true);
      });

      const title = container.querySelector('.su-blocked__title');
      expect(title?.textContent).toBe('This link has been blocked for your protection');
    });

    it('should show correct button text for all variants', async () => {
      modal!.show('https://evil.com/', { variant: 'domain' });

      await vi.waitFor(() => {
        expect(modal!.isVisible).toBe(true);
      });

      const button = container.querySelector('.su-blocked__button');
      expect(button?.textContent).toBe('Okay');
    });
  });

  describe('URL display', () => {
    beforeEach(() => {
      modal = createContainedBlockedModal(container);
    });

    it('should display target URL as string', async () => {
      modal!.show('https://evil.com/malicious/path');

      await vi.waitFor(() => {
        expect(modal!.isVisible).toBe(true);
      });

      const urlNode = container.querySelector('.su-blocked__url');
      expect(urlNode?.textContent).toBe('https://evil.com/malicious/path');
    });

    it('should display URL object href', async () => {
      const url = new URL('https://evil.com/malicious/path');
      modal!.show(url);

      await vi.waitFor(() => {
        expect(modal!.isVisible).toBe(true);
      });

      const urlNode = container.querySelector('.su-blocked__url');
      expect(urlNode?.textContent).toBe('https://evil.com/malicious/path');
    });

    it('should handle URIs', async () => {
      modal!.show('javascript:alert("XSS")', { variant: 'uri' });

      await vi.waitFor(() => {
        expect(modal!.isVisible).toBe(true);
      });

      const urlNode = container.querySelector('.su-blocked__url');
      expect(urlNode?.textContent).toBe('javascript:alert("XSS")');
    });
  });

  describe('modal lifecycle', () => {
    beforeEach(() => {
      modal = createContainedBlockedModal(container);
    });

    it('should start not visible', () => {
      // isVisible returns falsy (null or false) when modal is not shown
      expect(modal!.isVisible).toBeFalsy();
    });

    it('should become visible when show() is called', async () => {
      modal!.show('https://evil.com/');

      await vi.waitFor(() => {
        expect(modal!.isVisible).toBe(true);
      });
    });

    it('should hide when hide() is called', async () => {
      modal!.show('https://evil.com/');

      await vi.waitFor(() => {
        expect(modal!.isVisible).toBe(true);
      });

      modal!.hide();
      expect(modal!.isVisible).toBe(false);
    });

    it('should add is-visible class when shown', async () => {
      modal!.show('https://evil.com/');

      await vi.waitFor(() => {
        expect(modal!.isVisible).toBe(true);
      });

      const backdrop = container.querySelector('.su-blocked-backdrop');
      expect(backdrop?.classList.contains('is-visible')).toBe(true);
    });

    it('should remove is-visible class when hidden', async () => {
      modal!.show('https://evil.com/');

      await vi.waitFor(() => {
        expect(modal!.isVisible).toBe(true);
      });

      modal!.hide();

      const backdrop = container.querySelector('.su-blocked-backdrop');
      expect(backdrop?.classList.contains('is-visible')).toBe(false);
    });

    it('should set aria-hidden correctly', async () => {
      modal!.show('https://evil.com/');

      await vi.waitFor(() => {
        expect(modal!.isVisible).toBe(true);
      });

      const backdrop = container.querySelector('.su-blocked-backdrop');
      expect(backdrop?.getAttribute('aria-hidden')).toBe('false');

      modal!.hide();
      expect(backdrop?.getAttribute('aria-hidden')).toBe('true');
    });
  });

  describe('destroy lifecycle', () => {
    it('should remove modal from container on destroy', () => {
      modal = createContainedBlockedModal(container);

      // First show the modal to ensure DOM is created
      modal!.show('https://evil.com/');

      expect(container.querySelector('.su-blocked-backdrop')).not.toBeNull();

      modal!.destroy();
      expect(container.querySelector('.su-blocked-backdrop')).toBeNull();
    });

    it('should set isDestroyed to true after destroy', () => {
      modal = createContainedBlockedModal(container);
      expect(modal!.isDestroyed).toBe(false);

      modal!.destroy();
      expect(modal!.isDestroyed).toBe(true);
    });

    it('should be safe to call destroy multiple times', () => {
      modal = createContainedBlockedModal(container);
      modal!.destroy();
      modal!.destroy();
      modal!.destroy();
      // Should not throw
      expect(modal!.isDestroyed).toBe(true);
    });

    it('should not show modal after destroy', () => {
      modal = createContainedBlockedModal(container);
      modal!.destroy();

      modal!.show('https://evil.com/');
      // isVisible returns falsy when destroyed
      expect(modal!.isVisible).toBeFalsy();
    });

    it('should not hide after destroy', () => {
      modal = createContainedBlockedModal(container);
      modal!.destroy();

      // Should not throw
      modal!.hide();
      expect(modal!.isDestroyed).toBe(true);
    });
  });

  describe('keyboard interaction', () => {
    beforeEach(() => {
      modal = createContainedBlockedModal(container);
    });

    it('should close modal on Escape key', async () => {
      modal!.show('https://evil.com/');

      await vi.waitFor(() => {
        expect(modal!.isVisible).toBe(true);
      });

      const backdrop = container.querySelector('.su-blocked-backdrop') as HTMLElement;
      const escapeEvent = new KeyboardEvent('keydown', {
        key: 'Escape',
        bubbles: true,
      });
      backdrop.dispatchEvent(escapeEvent);

      expect(modal!.isVisible).toBe(false);
    });

    it('should not close modal on other keys', async () => {
      modal!.show('https://evil.com/');

      await vi.waitFor(() => {
        expect(modal!.isVisible).toBe(true);
      });

      const backdrop = container.querySelector('.su-blocked-backdrop') as HTMLElement;
      const enterEvent = new KeyboardEvent('keydown', {
        key: 'Enter',
        bubbles: true,
      });
      backdrop.dispatchEvent(enterEvent);

      expect(modal!.isVisible).toBe(true);
    });
  });

  describe('backdrop click', () => {
    beforeEach(() => {
      modal = createContainedBlockedModal(container);
    });

    it('should close modal when clicking backdrop', async () => {
      modal!.show('https://evil.com/');

      await vi.waitFor(() => {
        expect(modal!.isVisible).toBe(true);
      });

      const backdrop = container.querySelector('.su-blocked-backdrop') as HTMLElement;
      backdrop.click();

      expect(modal!.isVisible).toBe(false);
    });

    it('should not close modal when clicking modal content', async () => {
      modal!.show('https://evil.com/');

      await vi.waitFor(() => {
        expect(modal!.isVisible).toBe(true);
      });

      const modalContent = container.querySelector('.su-blocked') as HTMLElement;
      modalContent.click();

      expect(modal!.isVisible).toBe(true);
    });
  });

  describe('okay button', () => {
    beforeEach(() => {
      modal = createContainedBlockedModal(container);
    });

    it('should close modal when clicking okay button', async () => {
      modal!.show('https://evil.com/');

      await vi.waitFor(() => {
        expect(modal!.isVisible).toBe(true);
      });

      const okayButton = container.querySelector('.su-blocked__button') as HTMLElement;
      okayButton.click();

      expect(modal!.isVisible).toBe(false);
    });
  });

  describe('accessibility', () => {
    beforeEach(() => {
      modal = createContainedBlockedModal(container);
    });

    it('should have role="alertdialog"', async () => {
      modal!.show('https://evil.com/');

      await vi.waitFor(() => {
        expect(modal!.isVisible).toBe(true);
      });

      const dialog = container.querySelector('.su-blocked');
      expect(dialog?.getAttribute('role')).toBe('alertdialog');
    });

    it('should have aria-modal="true"', async () => {
      modal!.show('https://evil.com/');

      await vi.waitFor(() => {
        expect(modal!.isVisible).toBe(true);
      });

      const dialog = container.querySelector('.su-blocked');
      expect(dialog?.getAttribute('aria-modal')).toBe('true');
    });

    it('should have aria-labelledby pointing to title', async () => {
      modal!.show('https://evil.com/');

      await vi.waitFor(() => {
        expect(modal!.isVisible).toBe(true);
      });

      const dialog = container.querySelector('.su-blocked');
      const titleId = dialog?.getAttribute('aria-labelledby');
      const title = titleId ? container.querySelector(`#${titleId}`) : null;

      expect(title).not.toBeNull();
      expect(title?.textContent).toBe('This link has been blocked for your protection');
    });
  });

  describe('container positioning', () => {
    it('should not change position if already relative', () => {
      container.style.position = 'relative';
      modal = createContainedBlockedModal(container);
      expect(container.style.position).toBe('relative');
    });

    it('should not change position if already fixed', () => {
      container.style.position = 'fixed';
      modal = createContainedBlockedModal(container);
      expect(container.style.position).toBe('fixed');
    });
  });
});
