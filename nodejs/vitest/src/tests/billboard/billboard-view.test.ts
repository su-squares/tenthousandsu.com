import { describe, it, expect } from 'vitest';
import {
  createHighlight,
  createTooltip,
  updateGridSelection,
  clearGridSelection,
  showSquare,
  hideSquare
} from '@billboard/billboard-view.js';

describe('billboard-view extra', () => {
  it('updates aria selection and tab stop when moving between cells', () => {
    const cells = Array.from({ length: 3 }, (_, i) => {
      const cell = document.createElement('div');
      cell.dataset.square = String(i + 1);
      cell.setAttribute('aria-selected', 'false');
      cell.tabIndex = -1;
      return cell;
    });

    const state: { activeCell?: HTMLElement | null; tabStopCell?: HTMLElement | null } = {};

    updateGridSelection(cells, 1, state, { updateTabStop: true });
    expect(cells[0].getAttribute('aria-selected')).toBe('true');
    expect(cells[0].tabIndex).toBe(0);

    updateGridSelection(cells, 2, state, { updateTabStop: true });
    expect(cells[0].getAttribute('aria-selected')).toBe('false');
    expect(cells[0].tabIndex).toBe(-1);
    expect(cells[1].getAttribute('aria-selected')).toBe('true');
    expect(cells[1].tabIndex).toBe(0);

    clearGridSelection(state);
    expect(cells[1].getAttribute('aria-selected')).toBe('false');
    expect(state.activeCell).toBeNull();
  });

  it('shows and hides highlight + tooltip elements', () => {
    const highlight = createHighlight();
    const tooltip = createTooltip();

    showSquare({ highlight, tooltip }, 1, {
      cellSize: 10,
      tooltipContent: 'Hello',
      tooltipCssClass: 'custom-tooltip'
    });

    expect(highlight.style.display).toBe('block');
    expect(highlight.style.left).toBe('0px');
    expect(highlight.style.top).toBe('0px');
    expect(highlight.style.width).toBe('10px');
    expect(highlight.style.height).toBe('10px');

    expect(tooltip.style.display).toBe('block');
    expect(tooltip.textContent).toBe('Hello');
    expect(tooltip.dataset.disabled).toBe('false');
    expect(tooltip.classList.contains('custom-tooltip')).toBe(true);
    expect(tooltip.dataset.customClass).toBe('custom-tooltip');

    hideSquare({ highlight, tooltip });
    expect(highlight.style.display).toBe('none');
    expect(tooltip.style.display).toBe('none');
  });
});
