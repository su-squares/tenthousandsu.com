
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { 
  createSquareOverrideManager, 
  parseRangeString,
  TOTAL_SQUARES 
} from '@billboard/square-override.js';

describe('square-override', () => {
    describe('parseRangeString', () => {
        it('should handle empty or invalid input', () => {
            expect(parseRangeString('').size).toBe(0);
            expect(parseRangeString(null).size).toBe(0);
            expect(parseRangeString('abc').size).toBe(0);
        });

        it('should parse simple comma-separated list', () => {
            const set = parseRangeString('1, 5, 10');
            expect(set.has(1)).toBe(true);
            expect(set.has(5)).toBe(true);
            expect(set.has(10)).toBe(true);
            expect(set.size).toBe(3);
        });

        it('should parse ranges', () => {
            const set = parseRangeString('1-3');
            expect(set.has(1)).toBe(true);
            expect(set.has(2)).toBe(true);
            expect(set.has(3)).toBe(true);
            expect(set.size).toBe(3);
        });

        it('should mixed ranges and numbers', () => {
            const set = parseRangeString('1-2, 5, 8-9');
            expect(set.has(1)).toBe(true);
            expect(set.has(2)).toBe(true);
            expect(set.has(5)).toBe(true);
            expect(set.has(8)).toBe(true);
            expect(set.has(9)).toBe(true);
            expect(set.size).toBe(5);
        });

        it('should ignore out of bounds numbers', () => {
            // TOTAL_SQUARES is 10000
            const set = parseRangeString(`10000, 10001, 0, -5`);
            expect(set.has(10000)).toBe(true);
            expect(set.has(10001)).toBe(false);
            expect(set.has(0)).toBe(false);
            expect(set.size).toBe(1);
        });
    });

    describe('createSquareOverrideManager', () => {
        let cells;
        let manager;

        beforeEach(() => {
            // Mock cells array
            cells = Array.from({ length: 10 }, (_, i) => {
                const el = document.createElement('div');
                el.dataset.square = String(i + 1);
                return el;
            });
            // We mock the TOTAL_SQUARES check implicitly by only passing 10 cells 
            // but the manager uses the imported constant.
            // For Unit testing register logic, the manager checks the global TOTAL_SQUARES (10000).
            // But it also checks if cell exists [squareNumber -1]. Since we only provide 10 cells,
            // we should only test with squares 1-10 to avoid "Cell not found" errors unless we want to test that specific error.
            
            manager = createSquareOverrideManager(cells);
        });

        it('should register and apply an override', () => {
            const square = 1;
            const config = { cssClass: 'test-class', style: { color: 'red' } };
            
            manager.register(square, config);
            
            const cell = cells[0];
            expect(manager.has(square)).toBe(true);
            expect(cell.classList.contains('test-class')).toBe(true);
            expect(cell.style.color).toBe('red');
            expect(cell.dataset.override).toBe('true');
        });

        it('should restore original state on unregister', () => {
            const square = 2;
            const cell = cells[1];
            cell.className = 'original-class';
            cell.innerHTML = '<span>Original</span>';

            manager.register(square, { cssClass: 'new-class', innerHTML: 'New' });
            
            expect(cell.className).toContain('new-class');
            expect(cell.innerHTML).toBe('New');

            manager.unregister(square);

            expect(manager.has(square)).toBe(false);
            expect(cell.className).toBe('original-class');
            expect(cell.innerHTML).toBe('<span>Original</span>');
            expect(cell.dataset.override).toBeUndefined();
        });

        it('should not override locked config unless new config is also locked (policy check)', () => {
            // This behavior is slightly ambiguous in the code:
            // "If a square has an override with { locked: true }, later register() calls without locked:true will NOT replace it."
            const square = 3;
            const cell = cells[2];

            // 1. Register blocked/locked override
            manager.register(square, { cssClass: 'locked', locked: true });
            expect(cell.classList.contains('locked')).toBe(true);

            // 2. Try to register normal override (should fail)
            const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
            manager.register(square, { cssClass: 'normal' });
            
            expect(cell.classList.contains('locked')).toBe(true);
            expect(cell.classList.contains('normal')).toBe(false);
            expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Refusing to override locked square'));

            // 3. Register another locked override (should succeed? The code says: "if existing.locked && !(config && config.locked)")
            // So if new config IS locked, it should proceed.
            manager.register(square, { cssClass: 'new-locked', locked: true });
            expect(cell.classList.contains('new-locked')).toBe(true);
            
            consoleSpy.mockRestore();
        });

        it('should handle batch registration', () => {
            const squares = [4, 5];
            manager.registerBatch(squares, { cssClass: 'batch' });
            
            expect(cells[3].classList.contains('batch')).toBe(true);
            expect(cells[4].classList.contains('batch')).toBe(true);
            expect(manager.count()).toBe(2);
        });

        it('should clear all overrides', () => {
            manager.register(1, { cssClass: 'one' });
            manager.register(2, { cssClass: 'two' });
            
            expect(manager.count()).toBe(2);
            
            manager.clear();
            
            expect(manager.count()).toBe(0);
            expect(cells[0].classList.contains('one')).toBe(false);
            expect(cells[1].classList.contains('two')).toBe(false);
        });
    });
});
