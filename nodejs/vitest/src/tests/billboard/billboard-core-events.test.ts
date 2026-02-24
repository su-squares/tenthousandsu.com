import { describe, it, expect, vi, afterEach } from 'vitest';

vi.mock('@billboard/billboard-utils.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@billboard/billboard-utils.js')>();
  return {
    ...actual,
    getSquareFromPosition: vi.fn()
  };
});

import { attachBillboardEvents } from '@billboard/billboard-core-events.js';
import * as utils from '@billboard/billboard-utils.js';

function createContext(options: {
  enableGrid?: boolean;
  enableKeyboard?: boolean;
  includeGrid?: boolean;
  cellClosestSelector?: string | null;
  panZoom?: any;
  cellCount?: number;
} = {}) {
  const wrapper = document.createElement('div');
  const image = document.createElement('img');
  const grid = options.includeGrid === false ? null : document.createElement('div');
  const cellCount = options.cellCount ?? 4;
  const cells = Array.from({ length: cellCount }, (_, i) => {
    const cell = document.createElement('div');
    cell.dataset.square = String(i + 1);
    if (grid) grid.appendChild(cell);
    return cell;
  });

  wrapper.appendChild(image);
  if (grid) wrapper.appendChild(grid);
  document.body.appendChild(wrapper);

  const ctx = {
    enableGrid: options.enableGrid ?? false,
    enableKeyboard: options.enableKeyboard ?? false,
    elements: { wrapper, image, grid, cells },
    panZoom: options.panZoom ?? null,
    cellClosestSelector: options.cellClosestSelector ?? 'div[data-square]',
    gridState: {},
    getCurrentSquare: vi.fn(),
    setSquare: vi.fn(),
    clearSelection: vi.fn(),
    activateSquare: vi.fn()
  };

  return { ctx, wrapper, image, grid, cells };
}

function makeClickEvent(pointerType: string) {
  const event = new MouseEvent('click', { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'pointerType', { value: pointerType });
  return event;
}

afterEach(() => {
  document.body.innerHTML = '';
  vi.clearAllMocks();
});

describe('billboard-core-events extra', () => {
  it('touch click previews first and activates on second tap', () => {
    const { ctx, cells } = createContext();
    const cleanup = attachBillboardEvents(ctx);

    const square = 1;
    ctx.getCurrentSquare.mockReturnValueOnce(null).mockReturnValue(square);

    cells[0].dispatchEvent(makeClickEvent('touch'));
    cells[0].dispatchEvent(makeClickEvent('touch'));

    expect(ctx.setSquare).toHaveBeenCalledTimes(1);
    expect(ctx.setSquare).toHaveBeenCalledWith(square);
    expect(ctx.activateSquare).toHaveBeenCalledTimes(1);
    expect(ctx.activateSquare).toHaveBeenCalledWith(square, expect.any(Event));

    cleanup.destroy();
  });

  it('does not activate when panZoom has panned', () => {
    const panZoom = { hasPanned: vi.fn(() => true) };
    const { ctx, cells } = createContext({ panZoom });
    const cleanup = attachBillboardEvents(ctx);

    cells[0].dispatchEvent(makeClickEvent('mouse'));

    expect(panZoom.hasPanned).toHaveBeenCalledTimes(1);
    expect(ctx.activateSquare).not.toHaveBeenCalled();
    expect(ctx.setSquare).not.toHaveBeenCalled();

    cleanup.destroy();
  });

  it('uses panZoom screenToCanvas and wrapper width for pointer move', () => {
    const panZoom = {
      isActive: true,
      screenToCanvas: vi.fn(() => ({ x: 25, y: 75 }))
    };

    const { ctx, wrapper, image } = createContext({
      includeGrid: false,
      cellClosestSelector: null,
      panZoom
    });
    const cleanup = attachBillboardEvents(ctx);

    Object.defineProperty(wrapper, 'offsetWidth', { value: 500 });

    vi.mocked(utils.getSquareFromPosition).mockReturnValue(7);

    const event = new MouseEvent('pointermove', { bubbles: true, clientX: 100, clientY: 200 });
    Object.defineProperty(event, 'pointerType', { value: 'mouse' });
    image.dispatchEvent(event);

    expect(panZoom.screenToCanvas).toHaveBeenCalledWith(100, 200);
    expect(utils.getSquareFromPosition).toHaveBeenCalledWith(25, 75, 500);
    expect(ctx.setSquare).toHaveBeenCalledWith(7);

    cleanup.destroy();
  });
});
