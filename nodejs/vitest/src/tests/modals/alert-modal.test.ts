import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

interface SuAlertModalInterface {
  init: () => Promise<HTMLElement | null>;
  show: (message?: unknown) => void;
  hide: () => void;
}

declare global {
  interface Window {
    SuAlertModal: SuAlertModalInterface;
  }
}

describe('alert-modal', () => {
  let SuAlertModal: SuAlertModalInterface;

  beforeEach(async () => {
    // Reset module cache to ensure fresh state
    vi.resetModules();

    // Delete any existing global instance
    delete (window as any).SuAlertModal;

    // Dynamically import the module (fresh instance)
    await import('@modals/alert-modal/alert-modal.js');

    // Get the fresh global instance
    SuAlertModal = window.SuAlertModal;

    // Wait for initialization to complete
    await SuAlertModal.init();
    SuAlertModal.hide();
  });

  afterEach(() => {
    // Cleanup modal DOM
    const backdrop = document.querySelector('.su-alert-backdrop');
    if (backdrop) {
      backdrop.remove();
    }

    // Delete global instance
    delete (window as any).SuAlertModal;

    vi.restoreAllMocks();
  });

  describe('initialization', () => {
    it('should expose SuAlertModal on window', () => {
      expect(window.SuAlertModal).toBeDefined();
      expect(window.SuAlertModal.init).toBeInstanceOf(Function);
      expect(window.SuAlertModal.show).toBeInstanceOf(Function);
      expect(window.SuAlertModal.hide).toBeInstanceOf(Function);
    });

    it('should create modal DOM on init', async () => {
      await SuAlertModal.init();
      const backdrop = document.querySelector('.su-alert-backdrop');
      expect(backdrop).not.toBeNull();
    });

    it('should add stylesheet on init', async () => {
      await SuAlertModal.init();
      const stylesheet = document.querySelector('link[href*="alert-modal"]');
      expect(stylesheet).not.toBeNull();
    });

    it('should only create one modal instance (singleton)', async () => {
      await SuAlertModal.init();
      await SuAlertModal.init();
      await SuAlertModal.init();

      const backdrops = document.querySelectorAll('.su-alert-backdrop');
      expect(backdrops.length).toBe(1);
    });
  });

  describe('show and hide', () => {
    it('should show modal with message', async () => {
      SuAlertModal.show('Test message');

      await vi.waitFor(() => {
        const backdrop = document.querySelector('.su-alert-backdrop');
        return backdrop && backdrop.classList.contains('is-visible');
      });

      const messageNode = document.querySelector('.su-alert__message');
      expect(messageNode?.textContent).toBe('Test message');
    });

    it('should hide modal', async () => {
      SuAlertModal.show('Test message');

      await vi.waitFor(() => {
        const backdrop = document.querySelector('.su-alert-backdrop');
        return backdrop && backdrop.classList.contains('is-visible');
      });

      SuAlertModal.hide();

      const backdrop = document.querySelector('.su-alert-backdrop');
      expect(backdrop?.classList.contains('is-visible')).toBe(false);
    });

    it('should update message on subsequent show calls', async () => {
      SuAlertModal.show('First message');

      await vi.waitFor(() => {
        const backdrop = document.querySelector('.su-alert-backdrop');
        return backdrop && backdrop.classList.contains('is-visible');
      });

      SuAlertModal.hide();
      SuAlertModal.show('Second message');

      await vi.waitFor(() => {
        const backdrop = document.querySelector('.su-alert-backdrop');
        return backdrop && backdrop.classList.contains('is-visible');
      });

      const messageNode = document.querySelector('.su-alert__message');
      expect(messageNode?.textContent).toBe('Second message');
    });

    it('should handle undefined message', async () => {
      SuAlertModal.show(undefined);

      await vi.waitFor(() => {
        const backdrop = document.querySelector('.su-alert-backdrop');
        return backdrop && backdrop.classList.contains('is-visible');
      });

      const messageNode = document.querySelector('.su-alert__message');
      expect(messageNode?.textContent).toBe('');
    });

    it('should handle null message', async () => {
      SuAlertModal.show(null);

      await vi.waitFor(() => {
        const backdrop = document.querySelector('.su-alert-backdrop');
        return backdrop && backdrop.classList.contains('is-visible');
      });

      const messageNode = document.querySelector('.su-alert__message');
      expect(messageNode?.textContent).toBe('null');
    });

    it('should handle number message', async () => {
      SuAlertModal.show(42);

      await vi.waitFor(() => {
        const backdrop = document.querySelector('.su-alert-backdrop');
        return backdrop && backdrop.classList.contains('is-visible');
      });

      const messageNode = document.querySelector('.su-alert__message');
      expect(messageNode?.textContent).toBe('42');
    });
  });

  describe('keyboard interaction', () => {
    it('should close modal on Escape key', async () => {
      SuAlertModal.show('Test message');

      await vi.waitFor(() => {
        const backdrop = document.querySelector('.su-alert-backdrop');
        return backdrop && backdrop.classList.contains('is-visible');
      });

      const escapeEvent = new KeyboardEvent('keydown', {
        key: 'Escape',
        bubbles: true,
      });
      document.dispatchEvent(escapeEvent);

      const backdrop = document.querySelector('.su-alert-backdrop');
      expect(backdrop?.classList.contains('is-visible')).toBe(false);
    });

    it('should trap focus on Tab key', async () => {
      SuAlertModal.show('Test message');

      await vi.waitFor(() => {
        const backdrop = document.querySelector('.su-alert-backdrop');
        return backdrop && backdrop.classList.contains('is-visible');
      });

      const tabEvent = new KeyboardEvent('keydown', {
        key: 'Tab',
        bubbles: true,
        cancelable: true,
      });

      const defaultPrevented = !document.dispatchEvent(tabEvent);

      // Tab should be prevented and focus should stay on button
      expect(defaultPrevented).toBe(true);
    });

    it('should not respond to Escape when modal is hidden', async () => {
      await SuAlertModal.init();

      const backdrop = document.querySelector('.su-alert-backdrop');
      expect(backdrop?.classList.contains('is-visible')).toBe(false);

      const escapeEvent = new KeyboardEvent('keydown', {
        key: 'Escape',
        bubbles: true,
      });
      document.dispatchEvent(escapeEvent);

      // Should not throw and should still be hidden
      expect(backdrop?.classList.contains('is-visible')).toBe(false);
    });
  });

  describe('backdrop click', () => {
    it('should close modal when clicking backdrop', async () => {
      SuAlertModal.show('Test message');

      await vi.waitFor(() => {
        const backdrop = document.querySelector('.su-alert-backdrop');
        return backdrop && backdrop.classList.contains('is-visible');
      });

      const backdrop = document.querySelector('.su-alert-backdrop') as HTMLElement;
      backdrop.click();

      expect(backdrop.classList.contains('is-visible')).toBe(false);
    });

    it('should not close modal when clicking modal content', async () => {
      SuAlertModal.show('Test message');

      await vi.waitFor(() => {
        const backdrop = document.querySelector('.su-alert-backdrop');
        return backdrop && backdrop.classList.contains('is-visible');
      });

      const modalContent = document.querySelector('.su-alert') as HTMLElement;
      modalContent.click();

      const backdrop = document.querySelector('.su-alert-backdrop');
      expect(backdrop?.classList.contains('is-visible')).toBe(true);
    });
  });

  describe('dismiss button', () => {
    it('should close modal when clicking dismiss button', async () => {
      SuAlertModal.show('Test message');

      await vi.waitFor(() => {
        const backdrop = document.querySelector('.su-alert-backdrop');
        return backdrop && backdrop.classList.contains('is-visible');
      });

      const dismissButton = document.querySelector('.su-alert__button') as HTMLElement;
      dismissButton.click();

      const backdrop = document.querySelector('.su-alert-backdrop');
      expect(backdrop?.classList.contains('is-visible')).toBe(false);
    });
  });

  describe('accessibility', () => {
    it('should have role="dialog"', async () => {
      await SuAlertModal.init();

      const dialog = document.querySelector('.su-alert');
      expect(dialog?.getAttribute('role')).toBe('dialog');
    });

    it('should have aria-modal="true"', async () => {
      await SuAlertModal.init();

      const dialog = document.querySelector('.su-alert');
      expect(dialog?.getAttribute('aria-modal')).toBe('true');
    });

    it('should set aria-hidden="false" when visible', async () => {
      SuAlertModal.show('Test message');

      await vi.waitFor(() => {
        const backdrop = document.querySelector('.su-alert-backdrop');
        return backdrop && backdrop.classList.contains('is-visible');
      });

      const backdrop = document.querySelector('.su-alert-backdrop');
      expect(backdrop?.getAttribute('aria-hidden')).toBe('false');
    });

    it('should set aria-hidden="true" when hidden', async () => {
      SuAlertModal.show('Test message');

      await vi.waitFor(() => {
        const backdrop = document.querySelector('.su-alert-backdrop');
        return backdrop && backdrop.classList.contains('is-visible');
      });

      SuAlertModal.hide();

      const backdrop = document.querySelector('.su-alert-backdrop');
      expect(backdrop?.getAttribute('aria-hidden')).toBe('true');
    });

    it('should have aria-describedby pointing to message', async () => {
      await SuAlertModal.init();

      const dialog = document.querySelector('.su-alert');
      const describedBy = dialog?.getAttribute('aria-describedby');
      const message = describedBy ? document.querySelector(`#${describedBy}`) : null;

      expect(message).not.toBeNull();
    });
  });

  describe('singleton behavior', () => {
    it('should not create duplicate modals', async () => {
      SuAlertModal.show('First');
      SuAlertModal.show('Second');
      SuAlertModal.show('Third');

      await vi.waitFor(() => {
        const backdrop = document.querySelector('.su-alert-backdrop');
        return backdrop && backdrop.classList.contains('is-visible');
      });

      const backdrops = document.querySelectorAll('.su-alert-backdrop');
      expect(backdrops.length).toBe(1);
    });

    it('should reuse same modal instance', async () => {
      await SuAlertModal.init();
      const firstBackdrop = document.querySelector('.su-alert-backdrop');

      await SuAlertModal.init();
      const secondBackdrop = document.querySelector('.su-alert-backdrop');

      expect(firstBackdrop).toBe(secondBackdrop);
    });
  });

  describe('hide without show', () => {
    it('should not throw when hide is called without show', async () => {
      await SuAlertModal.init();

      // Should not throw
      SuAlertModal.hide();

      const backdrop = document.querySelector('.su-alert-backdrop');
      expect(backdrop?.classList.contains('is-visible')).toBe(false);
    });
  });
});
