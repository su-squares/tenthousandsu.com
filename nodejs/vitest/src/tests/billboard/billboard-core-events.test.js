
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock utils
vi.mock('@billboard/billboard-utils.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    TOTAL_SQUARES: 100, // Small grid for testing
    // Mock getSquareFromPosition to return predictable values for testing
    getSquareFromPosition: vi.fn(), 
  };
});

import { attachBillboardEvents } from '@billboard/billboard-core-events.js';
import * as utils from '@billboard/billboard-utils.js';
import { getSquareFromCell } from '@billboard/billboard-view.js';

describe('billboard-core-events', () => {
  let ctx;
  let wrapper, image, grid;
  let cells = [];
  let cleanup;

  beforeEach(() => {
    // Setup DOM elements
    wrapper = document.createElement('div');
    image = document.createElement('img');
    grid = document.createElement('div');
    
    // Create 100 cells
    cells = Array.from({ length: 100 }, (_, i) => {
        const cell = document.createElement('div');
        cell.dataset.square = String(i + 1);
        grid.appendChild(cell);
        return cell;
    });

    wrapper.appendChild(image);
    wrapper.appendChild(grid);
    document.body.appendChild(wrapper);

    // Setup Context
    ctx = {
        enableGrid: true,
        enableKeyboard: true,
        elements: { wrapper, image, grid, cells },
        panZoom: null, // Basic test without panzoom first
        cellClosestSelector: 'div[data-square]', // Simplified selector
        gridState: {},
        getCurrentSquare: vi.fn(),
        setSquare: vi.fn(),
        clearSelection: vi.fn(),
        activateSquare: vi.fn(),
    };
  });

  afterEach(() => {
    if (cleanup) cleanup.destroy();
    document.body.innerHTML = '';
    vi.clearAllMocks();
  });

  it('should attach and remove event listeners', () => {
    const addSpy = vi.spyOn(grid, 'addEventListener');
    const removeSpy = vi.spyOn(grid, 'removeEventListener');

    cleanup = attachBillboardEvents(ctx);
    
    expect(addSpy).toHaveBeenCalledWith('click', expect.any(Function));
    
    cleanup.destroy();
    expect(removeSpy).toHaveBeenCalledWith('click', expect.any(Function));
  });

  it('should handle click on a square (via event delegation)', () => {
    cleanup = attachBillboardEvents(ctx);
    
    // Mock utils.getSquareFromPosition to return null, 
    // so it falls back to cell detection logic or we rely on cell clicking.
    vi.mocked(utils.getSquareFromPosition).mockReturnValue(null);

    // Click on cell #5
    const cell = cells[4]; 
    cell.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

    expect(ctx.activateSquare).toHaveBeenCalledWith(5, expect.any(Event));
  });

  it('should handle keyboard navigation (ArrowRight)', () => {
    cleanup = attachBillboardEvents(ctx);
    
    // Focus cell #1
    const cell1 = cells[0];
    cell1.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    
    // Simulate ArrowRight
    const event = new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true });
    cell1.dispatchEvent(event);

    // Should move to #2
    expect(ctx.setSquare).toHaveBeenCalledWith(2);
  });

  it('should clear selection on pointer leave', () => {
    cleanup = attachBillboardEvents(ctx);
    
    grid.dispatchEvent(new PointerEvent('pointerleave', { bubbles: true }));
    
    expect(ctx.clearSelection).toHaveBeenCalled();
  });
});
