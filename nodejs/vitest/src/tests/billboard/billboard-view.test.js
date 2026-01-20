
import { describe, it, expect, vi } from 'vitest';

// Mock utils BEFORE importing view to override TOTAL_SQUARES
vi.mock('@billboard/billboard-utils.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    TOTAL_SQUARES: 100 // Reduce from 10000 to 100 for testing
  };
});

import { 
  createGrid,
  createTooltip,
  createHighlight,
  updateTooltip,
  updateHighlight,
  getSquareFromCell,
} from '@billboard/billboard-view.js';
import { TOTAL_SQUARES } from '@billboard/billboard-utils.js'; // This will be the mocked 100


describe('billboard-view', () => {
  describe('createGrid', () => {
    it('should create a grid with correct number of cells', () => {
      // Note: TOTAL_SQUARES is mocked to 100
      const { grid, cells } = createGrid();
      
      expect(grid.className).toBe('billboard__grid');
      expect(cells.length).toBe(TOTAL_SQUARES); // 100
      expect(grid.children.length).toBe(TOTAL_SQUARES);
      
      // Check first cell
      const firstCell = cells[0];
      expect(firstCell.dataset.square).toBe('1');
      expect(firstCell.getAttribute('role')).toBe('gridcell');
      expect(firstCell.getAttribute('aria-label')).toBe('Square #1');
      expect(firstCell.tabIndex).toBe(0); // First one is tab stop

      // Check last cell
      const lastCell = cells[TOTAL_SQUARES - 1]; // 99
      expect(lastCell.dataset.square).toBe(String(TOTAL_SQUARES));
      expect(lastCell.getAttribute('aria-label')).toBe(`Square #${TOTAL_SQUARES}`);
      expect(lastCell.tabIndex).toBe(-1);
    });

    it('should allow custom class names', () => {
      const { grid } = createGrid({ gridClassName: 'my-grid' });
      expect(grid.className).toBe('my-grid');
    });
  });

  describe('createTooltip', () => {
    it('should create tooltip element', () => {
      const tooltip = createTooltip();
      expect(tooltip.className).toBe('billboard__tooltip');
    });
  });

  describe('updateTooltip', () => {
    it('should update text and position', () => {
      const tooltip = createTooltip();
      const pos = { left: '10px', right: 'auto', top: '20px', transform: 'none', transformOrigin: 'top left' };
      
      updateTooltip(tooltip, {
        content: 'Hello World',
        position: pos,
        visible: true
      });

      expect(tooltip.textContent).toBe('Hello World');
      expect(tooltip.style.left).toBe('10px');
      expect(tooltip.style.display).toBe('block');
    });

    it('should handle visibility toggle', () => {
      const tooltip = createTooltip();
      updateTooltip(tooltip, { content: 'x', position: {}, visible: false });
      expect(tooltip.style.display).toBe('none');
    });

    it('should handle custom classes using data attribute management', () => {
      const tooltip = createTooltip();
      
      // First update with class
      updateTooltip(tooltip, { content: '1', cssClass: 'my-error' });
      expect(tooltip.classList.contains('my-error')).toBe(true);
      expect(tooltip.dataset.customClass).toBe('my-error');

      // Second update replacing class
      updateTooltip(tooltip, { content: '2', cssClass: 'my-warning' });
      expect(tooltip.classList.contains('my-error')).toBe(false);
      expect(tooltip.classList.contains('my-warning')).toBe(true);
      expect(tooltip.dataset.customClass).toBe('my-warning');
      
      // Third update removing class
      updateTooltip(tooltip, { content: '3' }); // cssClass null
      expect(tooltip.classList.contains('my-warning')).toBe(false);
      expect(tooltip.dataset.customClass).toBeUndefined();
    });
  });

  describe('getSquareFromCell', () => {
    it('should return number for valid cell', () => {
      const div = document.createElement('div');
      div.dataset.square = '42';
      expect(getSquareFromCell(div)).toBe(42);
    });

    it('should return null for null input or invalid cell', () => {
      expect(getSquareFromCell(null)).toBeNull();
      const div = document.createElement('div');
      expect(getSquareFromCell(div)).toBeNull(); // NaN
    });
  });
});
