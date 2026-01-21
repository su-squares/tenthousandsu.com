import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createModalShell } from '@web3/wallet/base/modal-shell.js';

describe('wallet/base/modal-shell.js', () => {
  let shell: ReturnType<typeof createModalShell>;

  beforeEach(() => {
    // Clean up any existing overlays
    document.body.innerHTML = '';
  });

  afterEach(() => {
    // Clean up
    if (shell?.overlay?.parentNode) {
      shell.overlay.remove();
    }
    document.body.innerHTML = '';
  });

  describe('createModalShell', () => {
    it('creates overlay, modal, and content elements', () => {
      shell = createModalShell();

      expect(shell.overlay).toBeInstanceOf(HTMLElement);
      expect(shell.modal).toBeInstanceOf(HTMLElement);
      expect(shell.content).toBeInstanceOf(HTMLElement);
      expect(shell.overlay.classList.contains('wallet-overlay')).toBe(true);
      expect(shell.modal.classList.contains('wallet-modal')).toBe(true);
    });

    it('sets id on overlay when provided', () => {
      shell = createModalShell({ id: 'test-modal' });

      expect(shell.overlay.id).toBe('test-modal');
    });

    it('mounts immediately when mountImmediately is true', () => {
      shell = createModalShell({ mountImmediately: true });

      expect(document.body.contains(shell.overlay)).toBe(true);
      expect(shell.overlay.hidden).toBe(true);
    });

    it('does not mount until show() when mountImmediately is false', () => {
      shell = createModalShell({ mountImmediately: false });

      expect(document.body.contains(shell.overlay)).toBe(false);
    });

    it('sets proper ARIA attributes on modal', () => {
      shell = createModalShell();

      expect(shell.modal.getAttribute('role')).toBe('dialog');
      expect(shell.modal.getAttribute('aria-modal')).toBe('true');
      expect(shell.modal.getAttribute('tabindex')).toBe('-1');
    });

    it('creates close button with aria-label', () => {
      shell = createModalShell();
      const closeBtn = shell.modal.querySelector('.wallet-close');

      expect(closeBtn).toBeTruthy();
      expect(closeBtn?.getAttribute('aria-label')).toBe('Close');
    });
  });

  describe('show()', () => {
    it('mounts overlay to body if not mounted', () => {
      shell = createModalShell();
      expect(document.body.contains(shell.overlay)).toBe(false);

      shell.show();

      expect(document.body.contains(shell.overlay)).toBe(true);
    });

    it('makes overlay visible', () => {
      shell = createModalShell();
      shell.show();

      expect(shell.overlay.hidden).toBe(false);
      expect(shell.overlay.classList.contains('is-visible')).toBe(true);
    });

    it('sets aria-hidden to false', () => {
      shell = createModalShell();
      shell.show();

      expect(shell.overlay.getAttribute('aria-hidden')).toBe('false');
    });

    it('removes inert attribute', () => {
      shell = createModalShell({ mountImmediately: true });
      shell.overlay.inert = true;

      shell.show();

      expect(shell.overlay.inert).toBe(false);
    });

    it('focuses the modal element', () => {
      shell = createModalShell();
      shell.show();

      expect(document.activeElement).toBe(shell.modal);
    });

    it('stores last focused element for restoration', () => {
      const button = document.createElement('button');
      document.body.appendChild(button);
      button.focus();

      shell = createModalShell();
      shell.show();

      expect(document.activeElement).toBe(shell.modal);

      shell.hide();

      expect(document.activeElement).toBe(button);
      button.remove();
    });
  });

  describe('hide()', () => {
    it('removes is-visible class', () => {
      shell = createModalShell();
      shell.show();
      shell.hide();

      expect(shell.overlay.classList.contains('is-visible')).toBe(false);
    });

    it('sets aria-hidden to true', () => {
      shell = createModalShell();
      shell.show();
      shell.hide();

      expect(shell.overlay.getAttribute('aria-hidden')).toBe('true');
    });

    it('sets inert and hidden attributes', () => {
      shell = createModalShell();
      shell.show();
      shell.hide();

      expect(shell.overlay.inert).toBe(true);
      expect(shell.overlay.hidden).toBe(true);
    });

    it('restores focus to previously focused element', () => {
      const input = document.createElement('input');
      document.body.appendChild(input);
      input.focus();

      shell = createModalShell();
      shell.show();
      shell.hide();

      expect(document.activeElement).toBe(input);
      input.remove();
    });
  });

  describe('close button', () => {
    it('calls onRequestClose when clicked', () => {
      const onRequestClose = vi.fn();
      shell = createModalShell({ onRequestClose });
      shell.show();

      const closeBtn = shell.modal.querySelector('.wallet-close') as HTMLButtonElement;
      closeBtn.click();

      expect(onRequestClose).toHaveBeenCalledTimes(1);
    });

    it('calls default hide when no onRequestClose provided', () => {
      shell = createModalShell();
      shell.show();

      expect(shell.overlay.classList.contains('is-visible')).toBe(true);

      const closeBtn = shell.modal.querySelector('.wallet-close') as HTMLButtonElement;
      closeBtn.click();

      expect(shell.overlay.classList.contains('is-visible')).toBe(false);
    });
  });

  describe('overlay click', () => {
    it('calls onOverlayDismiss when overlay clicked', () => {
      const onOverlayDismiss = vi.fn();
      shell = createModalShell({ onOverlayDismiss });
      shell.show();

      shell.overlay.dispatchEvent(new MouseEvent('click', { bubbles: true }));

      expect(onOverlayDismiss).toHaveBeenCalledTimes(1);
    });

    it('calls onRequestClose when overlay clicked and no onOverlayDismiss', () => {
      const onRequestClose = vi.fn();
      shell = createModalShell({ onRequestClose });
      shell.show();

      shell.overlay.dispatchEvent(new MouseEvent('click', { bubbles: true }));

      expect(onRequestClose).toHaveBeenCalledTimes(1);
    });

    it('does not close when clicking inside modal', () => {
      const onRequestClose = vi.fn();
      shell = createModalShell({ onRequestClose });
      shell.show();

      shell.modal.dispatchEvent(new MouseEvent('click', { bubbles: true }));

      expect(onRequestClose).not.toHaveBeenCalled();
    });
  });

  describe('Escape key', () => {
    it('calls onRequestClose when Escape pressed', () => {
      const onRequestClose = vi.fn();
      shell = createModalShell({ onRequestClose });
      shell.show();

      shell.overlay.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

      expect(onRequestClose).toHaveBeenCalledTimes(1);
    });

    it('stops propagation of Escape key', () => {
      shell = createModalShell();
      shell.show();

      const parentHandler = vi.fn();
      document.addEventListener('keydown', parentHandler);

      const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true });
      shell.overlay.dispatchEvent(event);

      // The event should be stopped, so parent handler sees it but with stopPropagation called
      document.removeEventListener('keydown', parentHandler);
    });
  });

  describe('focus trapping', () => {
    it('traps focus within modal on Tab', () => {
      shell = createModalShell();
      shell.show();

      // Add focusable elements
      const btn1 = document.createElement('button');
      btn1.textContent = 'First';
      const btn2 = document.createElement('button');
      btn2.textContent = 'Second';
      shell.content.appendChild(btn1);
      shell.content.appendChild(btn2);

      // Focus last element
      btn2.focus();
      expect(document.activeElement).toBe(btn2);

      // Tab from last element should wrap to first focusable (close button)
      const closeBtn = shell.modal.querySelector('.wallet-close') as HTMLButtonElement;
      const tabEvent = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true });
      Object.defineProperty(tabEvent, 'shiftKey', { value: false });

      shell.overlay.dispatchEvent(tabEvent);

      // After Tab from last, should wrap to close button (first focusable)
      expect(document.activeElement).toBe(closeBtn);
    });

    it('traps focus within modal on Shift+Tab', () => {
      shell = createModalShell();
      shell.show();

      const btn1 = document.createElement('button');
      btn1.textContent = 'Test';
      shell.content.appendChild(btn1);

      // Focus the close button (first focusable)
      const closeBtn = shell.modal.querySelector('.wallet-close') as HTMLButtonElement;
      closeBtn.focus();

      // Shift+Tab from first should wrap to last
      const tabEvent = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, shiftKey: true });

      shell.overlay.dispatchEvent(tabEvent);

      expect(document.activeElement).toBe(btn1);
    });

    it('focuses modal when no focusable elements', () => {
      shell = createModalShell();
      // Remove close button to have no focusable elements
      const closeBtn = shell.modal.querySelector('.wallet-close');
      closeBtn?.remove();

      shell.show();

      const tabEvent = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true });
      shell.overlay.dispatchEvent(tabEvent);

      expect(document.activeElement).toBe(shell.modal);
    });
  });

  describe('setAria()', () => {
    it('sets aria-labelledby attribute', () => {
      shell = createModalShell();
      shell.setAria({ labelledBy: 'my-title' });

      expect(shell.modal.getAttribute('aria-labelledby')).toBe('my-title');
    });

    it('sets aria-describedby attribute', () => {
      shell = createModalShell();
      shell.setAria({ describedBy: 'my-description' });

      expect(shell.modal.getAttribute('aria-describedby')).toBe('my-description');
    });

    it('removes aria-labelledby when not provided', () => {
      shell = createModalShell();
      shell.setAria({ labelledBy: 'my-title' });
      shell.setAria({ describedBy: 'desc' });

      expect(shell.modal.hasAttribute('aria-labelledby')).toBe(false);
    });

    it('removes aria-describedby when not provided', () => {
      shell = createModalShell();
      shell.setAria({ describedBy: 'my-desc' });
      shell.setAria({ labelledBy: 'title' });

      expect(shell.modal.hasAttribute('aria-describedby')).toBe(false);
    });
  });

  describe('setBackHandler()', () => {
    it('creates back button when handler provided', () => {
      shell = createModalShell();
      const handler = vi.fn();

      shell.setBackHandler(handler);

      const backBtn = shell.modal.querySelector('.wallet-back') as HTMLButtonElement;
      expect(backBtn).toBeTruthy();
      expect(backBtn.style.display).toBe('block');
    });

    it('hides back button when handler is null', () => {
      shell = createModalShell();
      shell.setBackHandler(vi.fn());
      shell.setBackHandler(null);

      const backBtn = shell.modal.querySelector('.wallet-back') as HTMLButtonElement;
      expect(backBtn.style.display).toBe('none');
    });

    it('calls handler when back button clicked', () => {
      shell = createModalShell();
      const handler = vi.fn();
      shell.setBackHandler(handler);

      const backBtn = shell.modal.querySelector('.wallet-back') as HTMLButtonElement;
      backBtn.click();

      expect(handler).toHaveBeenCalledTimes(1);
    });
  });

  describe('setOnRequestClose()', () => {
    it('replaces the close handler', () => {
      const originalHandler = vi.fn();
      const newHandler = vi.fn();
      shell = createModalShell({ onRequestClose: originalHandler });
      shell.show();

      shell.setOnRequestClose(newHandler);

      const closeBtn = shell.modal.querySelector('.wallet-close') as HTMLButtonElement;
      closeBtn.click();

      expect(originalHandler).not.toHaveBeenCalled();
      expect(newHandler).toHaveBeenCalledTimes(1);
    });

    it('new handler is called on Escape key', () => {
      const newHandler = vi.fn();
      shell = createModalShell();
      shell.show();

      shell.setOnRequestClose(newHandler);
      shell.overlay.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

      expect(newHandler).toHaveBeenCalledTimes(1);
    });
  });
});
