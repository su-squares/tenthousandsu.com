import { attachListChooserPersonalize } from '@square-lookup/list-chooser-personalize.js';
import {
  createPersonalizeOptions,
  cleanupChooserDOM,
  dispatchKeydown,
} from '@test-helpers/square-lookup';

interface ChooserController {
  open: () => Promise<void>;
  close: () => void;
  getSelectedIds: () => number[];
}

describe('attachListChooserPersonalize', () => {
  let controller: ChooserController | undefined;

  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    controller?.close();
    controller = undefined;
    cleanupChooserDOM();
    vi.restoreAllMocks();
  });

  describe('initialization', () => {
    it('returns controller with open, close, getSelectedIds methods', () => {
      const options = createPersonalizeOptions();
      controller = attachListChooserPersonalize(options) as ChooserController;

      expect(controller).toBeDefined();
      expect(typeof controller.open).toBe('function');
      expect(typeof controller.close).toBe('function');
      expect(typeof controller.getSelectedIds).toBe('function');
    });

    it('returns undefined when trigger is null', () => {
      const options = createPersonalizeOptions({ trigger: null });
      const result = attachListChooserPersonalize(options);

      expect(result).toBeUndefined();
    });

    it('sets aria-haspopup on trigger', () => {
      const options = createPersonalizeOptions();
      controller = attachListChooserPersonalize(options) as ChooserController;

      expect(options.trigger.getAttribute('aria-haspopup')).toBe('dialog');
      expect(options.trigger.getAttribute('aria-expanded')).toBe('false');
    });
  });

  describe('selection state', () => {
    it('toggling checkbox adds ID to selection', async () => {
      const options = createPersonalizeOptions();
      controller = attachListChooserPersonalize(options) as ChooserController;

      await controller.open();

      const cell = document.querySelector('.su-chooser__cell') as HTMLElement;
      cell?.click();

      expect(controller.getSelectedIds()).toContain(1);
    });

    it('toggling checkbox again removes ID from selection', async () => {
      const options = createPersonalizeOptions();
      controller = attachListChooserPersonalize(options) as ChooserController;

      await controller.open();

      const cell = document.querySelector('.su-chooser__cell') as HTMLElement;
      cell?.click(); // Add
      cell?.click(); // Remove

      expect(controller.getSelectedIds()).not.toContain(1);
    });

    it('getSelectedIds returns sorted array', async () => {
      const options = createPersonalizeOptions({
        getSquares: vi.fn().mockResolvedValue([5, 1, 3]),
      });
      controller = attachListChooserPersonalize(options) as ChooserController;

      await controller.open();

      const cells = document.querySelectorAll('.su-chooser__cell');
      // Click cells in order: 5, 1, 3 (which are in positions 0, 1, 2 after sorting in render)
      (cells[0] as HTMLElement)?.click(); // ID 1
      (cells[2] as HTMLElement)?.click(); // ID 5

      const selected = controller.getSelectedIds();
      expect(selected).toEqual([1, 5]); // Should be sorted
    });

    it('onSelectionChange fires with sorted IDs after toggle', async () => {
      const options = createPersonalizeOptions({
        getSquares: vi.fn().mockResolvedValue([3, 1, 2]),
      });
      controller = attachListChooserPersonalize(options) as ChooserController;

      await controller.open();

      const cells = document.querySelectorAll('.su-chooser__cell');
      (cells[2] as HTMLElement)?.click(); // ID 3

      expect(options.onSelectionChange).toHaveBeenCalledWith([3]);

      (cells[0] as HTMLElement)?.click(); // ID 1

      expect(options.onSelectionChange).toHaveBeenCalledWith([1, 3]); // Sorted
    });

    it('selection persists across modal close and reopen', async () => {
      const options = createPersonalizeOptions();
      controller = attachListChooserPersonalize(options) as ChooserController;

      await controller.open();

      const cell = document.querySelector('.su-chooser__cell') as HTMLElement;
      cell?.click();

      expect(controller.getSelectedIds()).toContain(1);

      controller.close();

      // Reopen - getSelectedIds is called to restore selection
      options.getSelectedIds.mockReturnValue([1]);
      await controller.open();

      // Selection should be restored from getSelectedIds
      expect(controller.getSelectedIds()).toContain(1);
    });

    it('initializes with pre-selected IDs from getSelectedIds', async () => {
      const options = createPersonalizeOptions({
        getSelectedIds: vi.fn().mockReturnValue([2, 4]),
        getSquares: vi.fn().mockResolvedValue([1, 2, 3, 4, 5]),
      });
      controller = attachListChooserPersonalize(options) as ChooserController;

      await controller.open();

      expect(controller.getSelectedIds()).toEqual([2, 4]);
    });
  });

  describe('modal lifecycle', () => {
    it('opens modal on trigger click', async () => {
      const options = createPersonalizeOptions();
      controller = attachListChooserPersonalize(options) as ChooserController;

      options.trigger.click();

      await vi.waitFor(() => {
        const backdrop = document.querySelector('.su-chooser-backdrop');
        expect(backdrop?.classList.contains('is-open')).toBe(true);
      });
    });

    it('closes on Escape key', async () => {
      const options = createPersonalizeOptions();
      controller = attachListChooserPersonalize(options) as ChooserController;

      await controller.open();

      expect(document.querySelector('.su-chooser-backdrop.is-open')).not.toBeNull();

      dispatchKeydown(document, 'Escape');

      expect(document.querySelector('.su-chooser-backdrop.is-open')).toBeNull();
    });

    it('closes on backdrop click', async () => {
      const options = createPersonalizeOptions();
      controller = attachListChooserPersonalize(options) as ChooserController;

      await controller.open();

      const backdrop = document.querySelector('.su-chooser-backdrop') as HTMLElement;
      backdrop?.click();

      expect(backdrop?.classList.contains('is-open')).toBe(false);
    });

    it('closes on close button click', async () => {
      const options = createPersonalizeOptions();
      controller = attachListChooserPersonalize(options) as ChooserController;

      await controller.open();

      const closeButton = document.querySelector('.su-chooser__close') as HTMLElement;
      closeButton?.click();

      expect(document.querySelector('.su-chooser-backdrop.is-open')).toBeNull();
    });

    it('fires onOpen callback when opened', async () => {
      const options = createPersonalizeOptions();
      controller = attachListChooserPersonalize(options) as ChooserController;

      await controller.open();

      expect(options.onOpen).toHaveBeenCalledTimes(1);
    });

    it('fires onClose callback when closed', async () => {
      const options = createPersonalizeOptions();
      controller = attachListChooserPersonalize(options) as ChooserController;

      await controller.open();
      controller.close();

      expect(options.onClose).toHaveBeenCalledTimes(1);
    });

    it('sets aria-expanded to true when opened', async () => {
      const options = createPersonalizeOptions();
      controller = attachListChooserPersonalize(options) as ChooserController;

      await controller.open();

      expect(options.trigger.getAttribute('aria-expanded')).toBe('true');
    });

    it('sets aria-expanded to false when closed', async () => {
      const options = createPersonalizeOptions();
      controller = attachListChooserPersonalize(options) as ChooserController;

      await controller.open();
      controller.close();

      expect(options.trigger.getAttribute('aria-expanded')).toBe('false');
    });
  });

  describe('confirmation', () => {
    it('fires onConfirm with sorted IDs on Okay click', async () => {
      const options = createPersonalizeOptions({
        getSquares: vi.fn().mockResolvedValue([3, 1, 2]),
      });
      controller = attachListChooserPersonalize(options) as ChooserController;

      await controller.open();

      // Select some items
      const cells = document.querySelectorAll('.su-chooser__cell');
      (cells[2] as HTMLElement)?.click(); // ID 3
      (cells[0] as HTMLElement)?.click(); // ID 1

      const okayButton = document.querySelector('.su-chooser__okay-btn') as HTMLElement;
      okayButton?.click();

      expect(options.onConfirm).toHaveBeenCalledWith([1, 3]); // Sorted
    });

    it('closes modal after Okay click', async () => {
      const options = createPersonalizeOptions();
      controller = attachListChooserPersonalize(options) as ChooserController;

      await controller.open();

      const okayButton = document.querySelector('.su-chooser__okay-btn') as HTMLElement;
      okayButton?.click();

      expect(document.querySelector('.su-chooser-backdrop.is-open')).toBeNull();
    });
  });

  describe('error handling', () => {
    it('shows alert when getSquares rejects', async () => {
      const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
      const options = createPersonalizeOptions({
        getSquares: vi.fn().mockRejectedValue(new Error('Network error')),
      });
      controller = attachListChooserPersonalize(options) as ChooserController;

      await controller.open();

      expect(alertSpy).toHaveBeenCalledWith('Network error');
    });

    it('shows generic message when error has no message', async () => {
      const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
      const options = createPersonalizeOptions({
        getSquares: vi.fn().mockRejectedValue(null),
      });
      controller = attachListChooserPersonalize(options) as ChooserController;

      await controller.open();

      expect(alertSpy).toHaveBeenCalledWith('Failed to load squares');
    });
  });

  describe('empty state', () => {
    it('shows empty message when no squares available', async () => {
      const options = createPersonalizeOptions({
        getSquares: vi.fn().mockResolvedValue([]),
      });
      controller = attachListChooserPersonalize(options) as ChooserController;

      await controller.open();

      const empty = document.querySelector('.su-chooser__empty');
      expect(empty?.textContent).toBe('No squares found for this filter.');
    });
  });
});
