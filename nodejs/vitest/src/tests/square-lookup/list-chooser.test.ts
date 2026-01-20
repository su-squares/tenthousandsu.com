vi.mock('@assets-js/square-data.js', () => ({
  loadSquareData: vi.fn(),
}));

import { attachListChooser } from '@square-lookup/list.js';
import { loadSquareData } from '@assets-js/square-data.js';
import {
  createListOptions,
  cleanupChooserDOM,
  dispatchKeydown,
  createMockSquareData,
} from '@test-helpers/square-lookup';

const loadSquareDataMock = vi.mocked(loadSquareData);

interface ChooserController {
  open: () => Promise<void>;
  close: () => void;
}

describe('attachListChooser', () => {
  let controller: ChooserController | undefined;

  beforeEach(() => {
    loadSquareDataMock.mockResolvedValue(createMockSquareData(10, () => true));
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    controller?.close();
    controller = undefined;
    cleanupChooserDOM();
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  describe('initialization', () => {
    it('returns controller with open, close methods', () => {
      const options = createListOptions();
      controller = attachListChooser(options) as ChooserController;

      expect(controller).toBeDefined();
      expect(typeof controller.open).toBe('function');
      expect(typeof controller.close).toBe('function');
    });

    it('returns undefined when input is null', () => {
      const options = createListOptions({ input: null });
      const result = attachListChooser(options);

      expect(result).toBeUndefined();
    });

    it('returns undefined when trigger is null', () => {
      const options = createListOptions({ trigger: null });
      const result = attachListChooser(options);

      expect(result).toBeUndefined();
    });

    it('sets aria-haspopup on trigger', () => {
      const options = createListOptions();
      controller = attachListChooser(options) as ChooserController;

      expect(options.trigger.getAttribute('aria-haspopup')).toBe('dialog');
      expect(options.trigger.getAttribute('aria-expanded')).toBe('false');
    });
  });

  describe('modal lifecycle', () => {
    it('opens modal on trigger click', async () => {
      const options = createListOptions();
      controller = attachListChooser(options) as ChooserController;

      options.trigger.click();

      await vi.waitFor(() => {
        const backdrop = document.querySelector('.su-chooser-backdrop');
        expect(backdrop?.classList.contains('is-open')).toBe(true);
      });
    });

    it('focuses first cell when opened', async () => {
      const options = createListOptions();
      controller = attachListChooser(options) as ChooserController;

      await controller.open();

      const firstCell = document.querySelector('.su-chooser__cell');
      expect(document.activeElement).toBe(firstCell);
    });

    it('closes on Escape key', async () => {
      const options = createListOptions();
      controller = attachListChooser(options) as ChooserController;

      await controller.open();

      expect(document.querySelector('.su-chooser-backdrop.is-open')).not.toBeNull();

      dispatchKeydown(document, 'Escape');

      expect(document.querySelector('.su-chooser-backdrop.is-open')).toBeNull();
    });

    it('closes on backdrop click', async () => {
      const options = createListOptions();
      controller = attachListChooser(options) as ChooserController;

      await controller.open();

      const backdrop = document.querySelector('.su-chooser-backdrop') as HTMLElement;
      backdrop?.click();

      expect(backdrop?.classList.contains('is-open')).toBe(false);
    });

    it('closes on close button click', async () => {
      const options = createListOptions();
      controller = attachListChooser(options) as ChooserController;

      await controller.open();

      const closeButton = document.querySelector('.su-chooser__close') as HTMLElement;
      closeButton?.click();

      expect(document.querySelector('.su-chooser-backdrop.is-open')).toBeNull();
    });

    it('restores focus to previous element on close', async () => {
      const options = createListOptions();
      controller = attachListChooser(options) as ChooserController;

      // Focus the trigger before opening
      options.trigger.focus();

      await controller.open();
      controller.close();

      // Focus should return to trigger (or last focused element)
      expect(
        document.activeElement === options.trigger ||
          document.activeElement === document.body
      ).toBe(true);
    });

    it('sets aria-expanded to true when opened', async () => {
      const options = createListOptions();
      controller = attachListChooser(options) as ChooserController;

      await controller.open();

      expect(options.trigger.getAttribute('aria-expanded')).toBe('true');
    });

    it('sets aria-expanded to false when closed', async () => {
      const options = createListOptions();
      controller = attachListChooser(options) as ChooserController;

      await controller.open();
      controller.close();

      expect(options.trigger.getAttribute('aria-expanded')).toBe('false');
    });
  });

  describe('selection', () => {
    it('calls onSelect with ID when cell clicked', async () => {
      const options = createListOptions();
      controller = attachListChooser(options) as ChooserController;

      await controller.open();

      const cell = document.querySelector('.su-chooser__cell') as HTMLElement;
      cell?.click();

      expect(options.onSelect).toHaveBeenCalledWith(1);
    });

    it('updates input value when updateInput is true', async () => {
      const options = createListOptions({ updateInput: true });
      controller = attachListChooser(options) as ChooserController;

      await controller.open();

      const cell = document.querySelector('.su-chooser__cell') as HTMLElement;
      cell?.click();

      expect(options.input.value).toBe('1');
    });

    it('does not update input when updateInput is false', async () => {
      const options = createListOptions({ updateInput: false });
      controller = attachListChooser(options) as ChooserController;

      await controller.open();

      const cell = document.querySelector('.su-chooser__cell') as HTMLElement;
      cell?.click();

      expect(options.input.value).toBe('');
    });

    it('closes modal after selection', async () => {
      const options = createListOptions();
      controller = attachListChooser(options) as ChooserController;

      await controller.open();

      const cell = document.querySelector('.su-chooser__cell') as HTMLElement;
      cell?.click();

      expect(document.querySelector('.su-chooser-backdrop.is-open')).toBeNull();
    });

    it('dispatches input event when updateInput is true', async () => {
      const options = createListOptions({ updateInput: true });
      controller = attachListChooser(options) as ChooserController;

      const inputHandler = vi.fn();
      options.input.addEventListener('input', inputHandler);

      await controller.open();

      const cell = document.querySelector('.su-chooser__cell') as HTMLElement;
      cell?.click();

      expect(inputHandler).toHaveBeenCalled();
    });
  });

  describe('keyboard navigation', () => {
    it('ArrowRight moves focus to next cell', async () => {
      const options = createListOptions();
      controller = attachListChooser(options) as ChooserController;

      await controller.open();

      const cells = document.querySelectorAll('.su-chooser__cell');
      const grid = document.querySelector('.su-chooser__grid') as HTMLElement;

      dispatchKeydown(grid, 'ArrowRight');

      expect(document.activeElement).toBe(cells[1]);
    });

    it('ArrowLeft moves focus to previous cell', async () => {
      const options = createListOptions();
      controller = attachListChooser(options) as ChooserController;

      await controller.open();

      const cells = document.querySelectorAll('.su-chooser__cell');
      const grid = document.querySelector('.su-chooser__grid') as HTMLElement;

      // Move right first
      dispatchKeydown(grid, 'ArrowRight');
      expect(document.activeElement).toBe(cells[1]);

      // Then left
      dispatchKeydown(grid, 'ArrowLeft');
      expect(document.activeElement).toBe(cells[0]);
    });

    it('ArrowLeft at first cell stays at first cell', async () => {
      const options = createListOptions();
      controller = attachListChooser(options) as ChooserController;

      await controller.open();

      const cells = document.querySelectorAll('.su-chooser__cell');
      const grid = document.querySelector('.su-chooser__grid') as HTMLElement;

      dispatchKeydown(grid, 'ArrowLeft');

      expect(document.activeElement).toBe(cells[0]);
    });

    it('ArrowRight at last cell stays at last cell', async () => {
      const options = createListOptions();
      controller = attachListChooser(options) as ChooserController;

      await controller.open();

      const cells = document.querySelectorAll('.su-chooser__cell');
      const grid = document.querySelector('.su-chooser__grid') as HTMLElement;
      const lastIndex = cells.length - 1;

      // Move to last cell
      for (let i = 0; i < lastIndex; i++) {
        dispatchKeydown(grid, 'ArrowRight');
      }

      expect(document.activeElement).toBe(cells[lastIndex]);

      // Try to move further right
      dispatchKeydown(grid, 'ArrowRight');
      expect(document.activeElement).toBe(cells[lastIndex]);
    });

    it('Home moves focus to first cell', async () => {
      const options = createListOptions();
      controller = attachListChooser(options) as ChooserController;

      await controller.open();

      const cells = document.querySelectorAll('.su-chooser__cell');
      const grid = document.querySelector('.su-chooser__grid') as HTMLElement;

      // Move to middle
      dispatchKeydown(grid, 'ArrowRight');
      dispatchKeydown(grid, 'ArrowRight');

      // Then Home
      dispatchKeydown(grid, 'Home');

      expect(document.activeElement).toBe(cells[0]);
    });

    it('End moves focus to last cell', async () => {
      const options = createListOptions();
      controller = attachListChooser(options) as ChooserController;

      await controller.open();

      const cells = document.querySelectorAll('.su-chooser__cell');
      const grid = document.querySelector('.su-chooser__grid') as HTMLElement;

      dispatchKeydown(grid, 'End');

      expect(document.activeElement).toBe(cells[cells.length - 1]);
    });

    it('Enter activates current cell', async () => {
      const options = createListOptions();
      controller = attachListChooser(options) as ChooserController;

      await controller.open();

      const grid = document.querySelector('.su-chooser__grid') as HTMLElement;

      dispatchKeydown(grid, 'Enter');

      expect(options.onSelect).toHaveBeenCalledWith(1);
    });

    it('Space activates current cell', async () => {
      const options = createListOptions();
      controller = attachListChooser(options) as ChooserController;

      await controller.open();

      const grid = document.querySelector('.su-chooser__grid') as HTMLElement;

      dispatchKeydown(grid, ' ');

      expect(options.onSelect).toHaveBeenCalledWith(1);
    });

    it('vim key "d" moves right', async () => {
      const options = createListOptions();
      controller = attachListChooser(options) as ChooserController;

      await controller.open();

      const cells = document.querySelectorAll('.su-chooser__cell');
      const grid = document.querySelector('.su-chooser__grid') as HTMLElement;

      dispatchKeydown(grid, 'd');

      expect(document.activeElement).toBe(cells[1]);
    });

    it('vim key "a" moves left', async () => {
      const options = createListOptions();
      controller = attachListChooser(options) as ChooserController;

      await controller.open();

      const cells = document.querySelectorAll('.su-chooser__cell');
      const grid = document.querySelector('.su-chooser__grid') as HTMLElement;

      // Move right first
      dispatchKeydown(grid, 'ArrowRight');

      // Then "a" to go left
      dispatchKeydown(grid, 'a');

      expect(document.activeElement).toBe(cells[0]);
    });

    it('vim key "e" moves right (alternative)', async () => {
      const options = createListOptions();
      controller = attachListChooser(options) as ChooserController;

      await controller.open();

      const cells = document.querySelectorAll('.su-chooser__cell');
      const grid = document.querySelector('.su-chooser__grid') as HTMLElement;

      dispatchKeydown(grid, 'e');

      expect(document.activeElement).toBe(cells[1]);
    });

    it('vim key "q" moves left (alternative)', async () => {
      const options = createListOptions();
      controller = attachListChooser(options) as ChooserController;

      await controller.open();

      const cells = document.querySelectorAll('.su-chooser__cell');
      const grid = document.querySelector('.su-chooser__grid') as HTMLElement;

      dispatchKeydown(grid, 'ArrowRight');
      dispatchKeydown(grid, 'q');

      expect(document.activeElement).toBe(cells[0]);
    });
  });

  describe('roving tabindex', () => {
    it('only focused cell has tabindex="0"', async () => {
      const options = createListOptions();
      controller = attachListChooser(options) as ChooserController;

      await controller.open();

      const cells = document.querySelectorAll('.su-chooser__cell');
      const tabbableCells = Array.from(cells).filter(
        (cell) => cell.getAttribute('tabindex') === '0'
      );

      expect(tabbableCells.length).toBe(1);
      expect(tabbableCells[0]).toBe(cells[0]);
    });

    it('other cells have tabindex="-1"', async () => {
      const options = createListOptions();
      controller = attachListChooser(options) as ChooserController;

      await controller.open();

      const cells = document.querySelectorAll('.su-chooser__cell');
      const nonTabbableCells = Array.from(cells).filter(
        (cell) => cell.getAttribute('tabindex') === '-1'
      );

      expect(nonTabbableCells.length).toBe(cells.length - 1);
    });

    it('tabindex updates when focus moves', async () => {
      const options = createListOptions();
      controller = attachListChooser(options) as ChooserController;

      await controller.open();

      const cells = document.querySelectorAll('.su-chooser__cell');
      const grid = document.querySelector('.su-chooser__grid') as HTMLElement;

      // Initial state
      expect(cells[0].getAttribute('tabindex')).toBe('0');
      expect(cells[1].getAttribute('tabindex')).toBe('-1');

      // Move right
      dispatchKeydown(grid, 'ArrowRight');

      // New state
      expect(cells[0].getAttribute('tabindex')).toBe('-1');
      expect(cells[1].getAttribute('tabindex')).toBe('0');
    });
  });

  describe('filtering', () => {
    it('applies filter function to squares', async () => {
      loadSquareDataMock.mockResolvedValue(createMockSquareData(10, () => true));

      // Only allow even IDs
      const options = createListOptions({
        filter: (id: number) => id % 2 === 0,
      });
      controller = attachListChooser(options) as ChooserController;

      await controller.open();

      const cells = document.querySelectorAll('.su-chooser__cell');
      // Should only have even numbered squares: 2, 4, 6, 8, 10
      expect(cells.length).toBe(5);
    });

    it('caches filtered squares after first load', async () => {
      const options = createListOptions();
      controller = attachListChooser(options) as ChooserController;

      await controller.open();
      controller.close();
      await controller.open();

      // loadSquareData should only be called once
      expect(loadSquareDataMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('error handling', () => {
    it('shows alert when loadSquareData rejects', async () => {
      loadSquareDataMock.mockRejectedValue(new Error('Network error'));
      const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});

      const options = createListOptions();
      controller = attachListChooser(options) as ChooserController;

      await controller.open();

      expect(alertSpy).toHaveBeenCalledWith('Network error');
    });
  });

  describe('empty state', () => {
    it('shows empty message when no squares match filter', async () => {
      const options = createListOptions({
        filter: () => false, // Filter out everything
      });
      controller = attachListChooser(options) as ChooserController;

      await controller.open();

      const empty = document.querySelector('.su-chooser__empty');
      expect(empty?.textContent).toBe('No squares found for this filter.');
    });
  });
});
