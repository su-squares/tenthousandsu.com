import { describe, it, expect, vi, afterEach } from 'vitest';

vi.mock('@billboard/billboard-core-blocklists.js', () => ({
  loadCoreBlocklistsOnce: vi.fn(),
  coreBlocklistsReady: Promise.resolve(),
  isCoreSquareBlocked: vi.fn((squareNumber: number) => squareNumber === 1),
  isCoreHrefBlocked: vi.fn(() => false),
  isCoreSquareTextHidden: vi.fn(() => false),
  applyCoreSquareBlocklistOverrides: vi.fn(),
}));

import { createBillboard } from '@billboard/billboard-core.js';

describe('billboard-core tooltip sanitization', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('passes sanitized ctx to wrapper tooltip override for blocked squares', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);

    const image = document.createElement('img');
    const highlight = document.createElement('div');
    const tooltip = document.createElement('div');

    const getTooltipContent = vi.fn(() => 'tooltip');

    const billboard = createBillboard(container, {
      enableGrid: false,
      enableKeyboard: false,
      enablePanZoom: false,
      allowWrapperTooltipOverride: true,
      getTooltipContent,
      getPersonalization: () => ['Label', 'https://example.com'],
      mount: { wrapper: container, image, highlight, tooltip },
    });

    billboard.setSquare(1);

    expect(getTooltipContent).toHaveBeenCalled();
    const passedCtx = getTooltipContent.mock.calls[0][1];
    expect(passedCtx.personalization).toBeNull();
  });
});
