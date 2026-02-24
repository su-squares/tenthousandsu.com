import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createSquareOverrideManager } from '@billboard/square-override.js';

describe('square-override extra', () => {
  let cells: HTMLElement[];
  let manager: ReturnType<typeof createSquareOverrideManager>;

  beforeEach(() => {
    cells = Array.from({ length: 5 }, (_, i) => {
      const cell = document.createElement('div');
      cell.dataset.square = String(i + 1);
      cell.className = `base-${i + 1}`;
      cell.innerHTML = `Cell ${i + 1}`;
      return cell;
    });
    manager = createSquareOverrideManager(cells);
  });

  it('registers a range of squares from a range string', () => {
    manager.registerRange('1-3', { cssClass: 'range' });

    expect(manager.count()).toBe(3);
    expect(cells[0].classList.contains('range')).toBe(true);
    expect(cells[1].classList.contains('range')).toBe(true);
    expect(cells[2].classList.contains('range')).toBe(true);
  });

  it('unregisterBatch restores original state', () => {
    manager.registerBatch([1, 2], { cssClass: 'temp', innerHTML: 'Override' });

    manager.unregisterBatch([1, 2]);

    expect(manager.count()).toBe(0);
    expect(cells[0].className).toBe('base-1');
    expect(cells[0].innerHTML).toBe('Cell 1');
    expect(cells[1].className).toBe('base-2');
    expect(cells[1].innerHTML).toBe('Cell 2');
  });

  it('calls render and cleanup hooks', () => {
    const render = vi.fn((cell: HTMLElement) => {
      cell.dataset.rendered = 'true';
    });
    const cleanup = vi.fn((cell: HTMLElement) => {
      cell.dataset.cleaned = 'true';
    });

    manager.register(4, { render, cleanup });

    expect(render).toHaveBeenCalledWith(
      cells[3],
      4,
      expect.objectContaining({ config: expect.any(Object) })
    );
    expect(cells[3].dataset.override).toBe('true');

    manager.unregister(4);

    expect(cleanup).toHaveBeenCalledWith(cells[3], 4);
    expect(cells[3].dataset.override).toBeUndefined();
  });
});
