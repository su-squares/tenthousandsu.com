
import { describe, it, expect } from 'vitest';
import { 
  clamp, 
  squareToCoords, 
  coordsToSquare,
  getQuadrant,
  TOTAL_SQUARES
} from '@billboard/billboard-utils.js';

describe('billboard-utils', () => {
  describe('clamp', () => {
    it('should return value if within range', () => {
      expect(clamp(5, 0, 10)).toBe(5);
    });

    it('should return min if value is less than min', () => {
      expect(clamp(-5, 0, 10)).toBe(0);
    });

    it('should return max if value is greater than max', () => {
      expect(clamp(15, 0, 10)).toBe(10);
    });
  });

  describe('coordinate conversion', () => {
    it('should convert square 1 to (0, 0)', () => {
      expect(squareToCoords(1)).toEqual({ row: 0, col: 0 });
    });

    it('should convert square 100 to (0, 99)', () => {
      expect(squareToCoords(100)).toEqual({ row: 0, col: 99 });
    });

    it('should convert square 101 to (1, 0)', () => {
      expect(squareToCoords(101)).toEqual({ row: 1, col: 0 });
    });

    it('should convert (0, 0) to square 1', () => {
      expect(coordsToSquare(0, 0)).toBe(1);
    });

    it('should convert (0, 99) to square 100', () => {
      expect(coordsToSquare(0, 99)).toBe(100);
    });

    it('should round-trip correctly', () => {
      const square = 5432;
      const { row, col } = squareToCoords(square);
      expect(coordsToSquare(row, col)).toBe(square);
    });
  });

  describe('getQuadrant', () => {
    it('should identify top-left quadrant', () => {
      // 1 is definitely top left (0,0)
      expect(getQuadrant(1)).toEqual({ isLeftHalf: true, isTopHalf: true });
    });
    
    it('should identify bottom-right quadrant', () => {
      // 10000 is bottom right (99,99)
      expect(getQuadrant(TOTAL_SQUARES)).toEqual({ isLeftHalf: false, isTopHalf: false });
    });
  });
});
