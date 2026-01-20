import { createContainedLeavingModal } from '@modals/leaving-modal/leaving-modal-contained.js';

type LeavingVariant = 'standard' | 'deeplink';

interface LeavingModalOptions {
  variant?: LeavingVariant;
}

interface LeavingModalConfig {
  blocklist?: string[];
}

interface LeavingModalController {
  show: (url: string | URL, target: string, options?: LeavingModalOptions) => void;
  hide: () => void;
  destroy: () => void;
  isVisible: boolean;
  isDestroyed: boolean;
  shouldWarnForUrl: (url: URL | null | undefined) => boolean;
  isUrlBlocked: (url: URL | null) => boolean;
  addBlockedDomains: (domains: unknown) => void;
  gateAnchor: (anchor: HTMLAnchorElement | null) => void;
  gateLinkNavigation: (href: string, event?: { preventDefault: () => void }, target?: string) => boolean;
}

const createModal = (target: HTMLElement | null, options?: LeavingModalConfig) =>
  createContainedLeavingModal(target as HTMLElement, options) as LeavingModalController | null;

describe('leaving-modal-contained', () => {
  let container: HTMLDivElement;
  let modal: LeavingModalController | null;

  beforeEach(() => {
    // Setup container
    container = document.createElement('div');
    container.style.width = '500px';
    container.style.height = '500px';
    document.body.appendChild(container);

    // Mock window.location
    Object.defineProperty(window, 'location', {
      value: {
        hostname: 'tenthousandsu.com',
        href: 'https://tenthousandsu.com/',
        origin: 'https://tenthousandsu.com',
        assign: vi.fn(),
      },
      writable: true,
    });

    // Mock fetch for blocklist
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([]),
    }) as unknown as typeof fetch;

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
      const result = createModal(null);
      expect(result).toBeNull();
    });

    it('should return null for non-HTMLElement container', () => {
      const result = createContainedLeavingModal('not-an-element' as unknown as HTMLElement);
      expect(result).toBeNull();
    });

    it('should return modal controller for valid container', () => {
      modal = createModal(container);
      expect(modal).not.toBeNull();
      expect(modal!.show).toBeInstanceOf(Function);
      expect(modal!.hide).toBeInstanceOf(Function);
      expect(modal!.destroy).toBeInstanceOf(Function);
    });

    it('should set container position to relative if static', () => {
      container.style.position = 'static';
      modal = createModal(container);
      expect(container.style.position).toBe('relative');
    });

    it('should not change container position if already positioned', () => {
      container.style.position = 'absolute';
      modal = createModal(container);
      expect(container.style.position).toBe('absolute');
    });
  });

  describe('shouldWarnForUrl', () => {
    beforeEach(() => {
      modal = createModal(container);
    });

    it('should return false for same-domain URLs', () => {
      const url = new URL('https://tenthousandsu.com/page');
      expect(modal!.shouldWarnForUrl(url)).toBe(false);
    });

    it('should return true for external domains', () => {
      const url = new URL('https://external.com/page');
      expect(modal!.shouldWarnForUrl(url)).toBe(true);
    });

    it('should return false for non-HTTP URLs', () => {
      const url = new URL('mailto:test@example.com');
      expect(modal!.shouldWarnForUrl(url)).toBe(false);
    });

    it('should return false for null URL', () => {
      expect(modal!.shouldWarnForUrl(null)).toBe(false);
    });

    it('should return false for undefined URL', () => {
      expect(modal!.shouldWarnForUrl(undefined)).toBe(false);
    });

    it('should be case-insensitive for hostname comparison', () => {
      const url = new URL('https://TENTHOUSANDSU.COM/page');
      expect(modal!.shouldWarnForUrl(url)).toBe(false);
    });
  });

  describe('domain blocking', () => {
    it('should block exact domain matches', () => {
      modal = createModal(container, {
        blocklist: ['evil.com'],
      });

      const url = new URL('https://evil.com/page');
      expect(modal!.isUrlBlocked(url)).toBe(true);
    });

    it('should block subdomains of blocked domains', () => {
      modal = createModal(container, {
        blocklist: ['evil.com'],
      });

      const url = new URL('https://sub.evil.com/page');
      expect(modal!.isUrlBlocked(url)).toBe(true);
    });

    it('should block deeply nested subdomains', () => {
      modal = createModal(container, {
        blocklist: ['evil.com'],
      });

      const url = new URL('https://a.b.c.evil.com/page');
      expect(modal!.isUrlBlocked(url)).toBe(true);
    });

    it('should block parent domains when subdomain is blocked (bidirectional blocking)', () => {
      // Note: The implementation uses bidirectional domain blocking.
      // If sub.evil.com is blocked, evil.com is also considered blocked.
      // This is because the code checks if the target domain appears in
      // the domain parts of any blocked entry.
      modal = createModal(container, {
        blocklist: ['sub.evil.com'],
      });

      const url = new URL('https://evil.com/page');
      expect(modal!.isUrlBlocked(url)).toBe(true);
    });

    it('should be case-insensitive for domain matching', () => {
      modal = createModal(container, {
        blocklist: ['EVIL.COM'],
      });

      const url = new URL('https://evil.com/page');
      expect(modal!.isUrlBlocked(url)).toBe(true);
    });

    it('should return false for empty blocklist', () => {
      modal = createModal(container, {
        blocklist: [],
      });

      const url = new URL('https://anysite.com/page');
      expect(modal!.isUrlBlocked(url)).toBe(false);
    });

    it('should return false for non-HTTP URLs', () => {
      modal = createModal(container, {
        blocklist: ['example.com'],
      });

      const url = new URL('mailto:test@example.com');
      expect(modal!.isUrlBlocked(url)).toBe(false);
    });

    it('should return false for null URL', () => {
      modal = createModal(container, {
        blocklist: ['evil.com'],
      });

      expect(modal!.isUrlBlocked(null)).toBe(false);
    });

    it('should add domains at runtime via addBlockedDomains', () => {
      modal = createModal(container);

      const url = new URL('https://newbad.com/page');
      expect(modal!.isUrlBlocked(url)).toBe(false);

      modal!.addBlockedDomains(['newbad.com']);
      expect(modal!.isUrlBlocked(url)).toBe(true);
    });

    it('should ignore non-array input to addBlockedDomains', () => {
      modal = createModal(container);
      modal!.addBlockedDomains('not-an-array');
      modal!.addBlockedDomains(null);
      modal!.addBlockedDomains(123);
      // Should not throw
    });

    it('should trim and lowercase domains in blocklist', () => {
      modal = createModal(container, {
        blocklist: ['  EVIL.COM  ', '  bad.org  '],
      });

      expect(modal!.isUrlBlocked(new URL('https://evil.com/'))).toBe(true);
      expect(modal!.isUrlBlocked(new URL('https://bad.org/'))).toBe(true);
    });

    it('should ignore empty strings in blocklist', () => {
      modal = createModal(container, {
        blocklist: ['', '  ', 'evil.com'],
      });

      expect(modal!.isUrlBlocked(new URL('https://evil.com/'))).toBe(true);
    });
  });

  describe('modal lifecycle', () => {
    beforeEach(() => {
      modal = createModal(container);
    });

    it('should start hidden', () => {
      expect(modal!.isVisible).toBe(false);
    });

    it('should become visible when show() is called', async () => {
      const url = new URL('https://external.com/');
      modal!.show(url, '_self');

      // Wait for async operations
      await vi.waitFor(() => {
        expect(modal!.isVisible).toBe(true);
      });
    });

    it('should hide when hide() is called', async () => {
      const url = new URL('https://external.com/');
      modal!.show(url, '_self');

      await vi.waitFor(() => {
        expect(modal!.isVisible).toBe(true);
      });

      modal!.hide();
      expect(modal!.isVisible).toBe(false);
    });

    it('should display the target URL', async () => {
      const url = new URL('https://external.com/path');
      modal!.show(url, '_self');

      await vi.waitFor(() => {
        expect(modal!.isVisible).toBe(true);
      });

      const urlNode = container.querySelector('.su-leaving__url');
      expect(urlNode?.textContent).toBe('https://external.com/path');
    });

    it('should accept string URLs', async () => {
      modal!.show('https://external.com/path', '_self');

      await vi.waitFor(() => {
        expect(modal!.isVisible).toBe(true);
      });

      const urlNode = container.querySelector('.su-leaving__url');
      expect(urlNode?.textContent).toBe('https://external.com/path');
    });
  });

  describe('modal variants', () => {
    beforeEach(() => {
      modal = createModal(container);
    });

    it('should show standard variant by default', async () => {
      modal!.show(new URL('https://external.com/'), '_self');

      await vi.waitFor(() => {
        expect(modal!.isVisible).toBe(true);
      });

      const title = container.querySelector('.su-leaving__title');
      expect(title?.textContent).toBe('You are leaving this site');
    });

    it('should show deeplink variant when specified', async () => {
      modal!.show('mailto:test@example.com', '_self', { variant: 'deeplink' });

      await vi.waitFor(() => {
        expect(modal!.isVisible).toBe(true);
      });

      const title = container.querySelector('.su-leaving__title');
      expect(title?.textContent).toBe('You are using a deeplink');
    });

    it('should show correct button text for standard variant', async () => {
      modal!.show(new URL('https://external.com/'), '_self');

      await vi.waitFor(() => {
        expect(modal!.isVisible).toBe(true);
      });

      const stayButton = container.querySelector('.su-leaving__button--stay');
      const goButton = container.querySelector('.su-leaving__button--go');
      expect(stayButton?.textContent).toBe('Stay Here');
      expect(goButton?.textContent).toBe('Go There');
    });

    it('should show correct button text for deeplink variant', async () => {
      modal!.show('tel:+1234567890', '_self', { variant: 'deeplink' });

      await vi.waitFor(() => {
        expect(modal!.isVisible).toBe(true);
      });

      const stayButton = container.querySelector('.su-leaving__button--stay');
      const goButton = container.querySelector('.su-leaving__button--go');
      expect(stayButton?.textContent).toBe('Cancel');
      expect(goButton?.textContent).toBe('Open');
    });
  });

  describe('destroy lifecycle', () => {
    it('should remove modal from container on destroy', () => {
      modal = createModal(container);
      expect(container.querySelector('.su-leaving-backdrop')).not.toBeNull();

      modal!.destroy();
      expect(container.querySelector('.su-leaving-backdrop')).toBeNull();
    });

    it('should set isDestroyed to true after destroy', () => {
      modal = createModal(container);
      expect(modal!.isDestroyed).toBe(false);

      modal!.destroy();
      expect(modal!.isDestroyed).toBe(true);
    });

    it('should be safe to call destroy multiple times', () => {
      modal = createModal(container);
      modal!.destroy();
      modal!.destroy();
      modal!.destroy();
      // Should not throw
      expect(modal!.isDestroyed).toBe(true);
    });

    it('should not show modal after destroy', () => {
      modal = createModal(container);
      modal!.destroy();

      modal!.show(new URL('https://external.com/'), '_self');
      // isVisible returns falsy when destroyed
      expect(modal!.isVisible).toBeFalsy();
    });

    it('should not gate anchors after destroy', () => {
      modal = createModal(container);

      const anchor = document.createElement('a');
      anchor.href = 'https://external.com/';
      container.appendChild(anchor);

      modal!.destroy();
      modal!.gateAnchor(anchor);

      // Should not have added the guarded data attribute
      expect(anchor.dataset.suLeavingContainedGuarded).toBeUndefined();
    });
  });

  describe('gateAnchor', () => {
    beforeEach(() => {
      modal = createModal(container);
    });

    it('should intercept clicks on external links', async () => {
      const anchor = document.createElement('a');
      anchor.href = 'https://external.com/page';
      container.appendChild(anchor);

      modal!.gateAnchor(anchor);

      const event = new MouseEvent('click', { bubbles: true, cancelable: true });
      anchor.dispatchEvent(event);

      await vi.waitFor(() => {
        expect(modal!.isVisible).toBe(true);
      });
    });

    it('should not intercept clicks on internal links', () => {
      const anchor = document.createElement('a');
      anchor.href = 'https://tenthousandsu.com/internal';
      container.appendChild(anchor);

      modal!.gateAnchor(anchor);

      const event = new MouseEvent('click', { bubbles: true, cancelable: true });
      anchor.dispatchEvent(event);

      expect(modal!.isVisible).toBe(false);
    });

    it('should mark anchor as guarded', () => {
      const anchor = document.createElement('a');
      anchor.href = 'https://external.com/';
      container.appendChild(anchor);

      modal!.gateAnchor(anchor);
      expect(anchor.dataset.suLeavingContainedGuarded).toBe('1');
    });

    it('should not double-guard already guarded anchors', () => {
      const anchor = document.createElement('a');
      anchor.href = 'https://external.com/';
      container.appendChild(anchor);

      const addEventListenerSpy = vi.spyOn(anchor, 'addEventListener');

      modal!.gateAnchor(anchor);
      modal!.gateAnchor(anchor);

      // Should only add listener once
      expect(addEventListenerSpy).toHaveBeenCalledTimes(1);
    });

    it('should ignore null anchors', () => {
      modal!.gateAnchor(null);
      // Should not throw
    });

    it('should ignore anchors without href', () => {
      const anchor = document.createElement('a');
      container.appendChild(anchor);

      modal!.gateAnchor(anchor);

      const event = new MouseEvent('click', { bubbles: true, cancelable: true });
      anchor.dispatchEvent(event);

      expect(modal!.isVisible).toBe(false);
    });
  });

  describe('gateLinkNavigation fallback (without link-utils)', () => {
    beforeEach(() => {
      // Ensure SuLinkUtils is not available
      delete (window as any).SuLinkUtils;
      modal = createModal(container);
    });

    it('should return false for empty href', () => {
      const result = modal!.gateLinkNavigation('');
      expect(result).toBe(false);
    });

    it('should return false for internal URLs', () => {
      const result = modal!.gateLinkNavigation('https://tenthousandsu.com/page');
      expect(result).toBe(false);
    });

    it('should return true and show modal for external URLs', async () => {
      const event = { preventDefault: vi.fn() };
      const result = modal!.gateLinkNavigation('https://external.com/', event, '_self');

      expect(result).toBe(true);
      expect(event.preventDefault).toHaveBeenCalled();

      await vi.waitFor(() => {
        expect(modal!.isVisible).toBe(true);
      });
    });

    it('should return true for blocked domains', () => {
      modal!.addBlockedDomains(['blocked.com']);

      const event = { preventDefault: vi.fn() };
      const result = modal!.gateLinkNavigation('https://blocked.com/', event, '_self');

      expect(result).toBe(true);
      expect(event.preventDefault).toHaveBeenCalled();
    });

    it('should return false for malformed URLs', () => {
      const result = modal!.gateLinkNavigation('not-a-valid-url-at-all');
      expect(result).toBe(false);
    });
  });

  describe('keyboard interaction', () => {
    beforeEach(() => {
      modal = createModal(container);
    });

    it('should close modal on Escape key', async () => {
      modal!.show(new URL('https://external.com/'), '_self');

      await vi.waitFor(() => {
        expect(modal!.isVisible).toBe(true);
      });

      const backdrop = container.querySelector('.su-leaving-backdrop') as HTMLElement;
      const escapeEvent = new KeyboardEvent('keydown', {
        key: 'Escape',
        bubbles: true,
      });
      backdrop.dispatchEvent(escapeEvent);

      expect(modal!.isVisible).toBe(false);
    });
  });

  describe('backdrop click', () => {
    beforeEach(() => {
      modal = createModal(container);
    });

    it('should close modal when clicking backdrop', async () => {
      modal!.show(new URL('https://external.com/'), '_self');

      await vi.waitFor(() => {
        expect(modal!.isVisible).toBe(true);
      });

      const backdrop = container.querySelector('.su-leaving-backdrop') as HTMLElement;
      backdrop.click();

      expect(modal!.isVisible).toBe(false);
    });

    it('should not close modal when clicking modal content', async () => {
      modal!.show(new URL('https://external.com/'), '_self');

      await vi.waitFor(() => {
        expect(modal!.isVisible).toBe(true);
      });

      const modalContent = container.querySelector('.su-leaving') as HTMLElement;
      modalContent.click();

      expect(modal!.isVisible).toBe(true);
    });
  });

  describe('stay button', () => {
    beforeEach(() => {
      modal = createModal(container);
    });

    it('should close modal when clicking stay button', async () => {
      modal!.show(new URL('https://external.com/'), '_self');

      await vi.waitFor(() => {
        expect(modal!.isVisible).toBe(true);
      });

      const stayButton = container.querySelector('.su-leaving__button--stay') as HTMLElement;
      stayButton.click();

      expect(modal!.isVisible).toBe(false);
    });
  });
});
