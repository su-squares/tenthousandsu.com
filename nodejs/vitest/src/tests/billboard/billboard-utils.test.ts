import { describe, it, expect } from 'vitest';
import {
  calculateTooltipPosition,
  getSquareFromPosition,
  GRID_DIMENSION,
  TOTAL_SQUARES
} from '@billboard/billboard-utils.js';

describe('billboard-utils extra', () => {
  describe('getSquareFromPosition boundaries', () => {
    it('returns null for out of bounds coordinates', () => {
      const width = 1000;
      expect(getSquareFromPosition(-1, 50, width)).toBeNull();
      expect(getSquareFromPosition(50, -1, width)).toBeNull();
      expect(getSquareFromPosition(width + 1, 50, width)).toBeNull();
      expect(getSquareFromPosition(50, width + 1, width)).toBeNull();
    });

    it('returns last square when on the far edge', () => {
      const width = 1000;
      expect(getSquareFromPosition(width, width, width)).toBe(TOTAL_SQUARES);
    });
  });

  describe('calculateTooltipPosition', () => {
    it('positions tooltip in top-left quadrant', () => {
      const cellSize = 10;
      const pos = calculateTooltipPosition(1, cellSize);

      expect(pos.left).toBe('15px');
      expect(pos.right).toBe('auto');
      expect(pos.top).toBe('10px');
      expect(pos.transformOrigin).toBe('left top');
      expect(pos.transform).toBe('');
    });

    it('positions tooltip in bottom-right quadrant with scale', () => {
      const cellSize = 10;
      const square = GRID_DIMENSION * GRID_DIMENSION;
      const pos = calculateTooltipPosition(square, cellSize, { scale: 2 });

      expect(pos.left).toBe('auto');
      expect(pos.right).toBe('15px');
      expect(pos.top).toBe('990px');
      expect(pos.transformOrigin).toBe('right bottom');
      expect(pos.transform).toContain('translateY(-100%)');
      expect(pos.transform).toContain('scale(0.5)');
    });
  });
});
