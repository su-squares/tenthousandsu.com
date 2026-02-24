import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

let lastOptions: any = null;

const createBillboardMock = vi.fn((_container, options) => {
  lastOptions = options;
  return {
    elements: { grid: document.createElement('div'), cells: [] },
    panZoom: { isActive: false, hasPanned: () => false, reset: vi.fn() },
    setSquare: vi.fn(),
    activateSquare: vi.fn(),
    clearSelection: vi.fn(),
    reset: vi.fn(),
    destroy: vi.fn(),
  };
});

const createContainedLeavingModalMock = vi.fn(() => ({
  gateLinkNavigation: vi.fn(),
  isVisible: false,
  destroy: vi.fn(),
  shouldWarnForUrl: vi.fn(() => false),
  isUrlBlocked: vi.fn(() => false),
  show: vi.fn(),
}));

const createContainedBlockedModalMock = vi.fn(() => ({
  show: vi.fn(),
  isVisible: false,
  destroy: vi.fn(),
}));

vi.mock('@billboard/billboard-core.js', () => ({
  createBillboard: createBillboardMock,
  GRID_DIMENSION: 100,
}));

vi.mock('@billboard/runtime-fallback.js', () => ({
  scheduleBillboardRuntimeFallback: () => () => {},
}));

vi.mock('@billboard/billboard-core-blocklists.js', () => ({
  coreBlocklistsReady: Promise.resolve(),
}));

vi.mock('@modals/leaving-modal/leaving-modal-contained.js', () => ({
  createContainedLeavingModal: createContainedLeavingModalMock,
}));

vi.mock('@modals/blocked-modal/blocked-modal-contained.js', () => ({
  createContainedBlockedModal: createContainedBlockedModalMock,
}));

describe('billboard wrapper blocked-scheme handling', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    lastOptions = null;
    createBillboardMock.mockClear();
    createContainedLeavingModalMock.mockClear();
    createContainedBlockedModalMock.mockClear();
    document.body.innerHTML = '';
  });

  afterEach(() => {
    if (originalFetch) {
      globalThis.fetch = originalFetch;
    } else {
      delete (globalThis as any).fetch;
    }
    delete (window as any).SuLeavingModal;
    delete (window as any).SuBlockedModal;
  });

  it('routes blocked schemes through the homepage leaving modal', async () => {
    const { initHomepageBillboard } = await import('@billboard/wrappers/index-billboard.js');

    const mapWrapper = document.createElement('div');
    const image = document.createElement('img');
    const positionDiv = document.createElement('div');
    const tooltipDiv = document.createElement('div');
    const fenceContainer = document.createElement('div');
    const linkAnchor = document.createElement('a');
    linkAnchor.setAttribute('target', '_blank');

    const gateLinkNavigation = vi.fn();
    const blockedShow = vi.fn();

    (window as any).SuLeavingModal = { gateLinkNavigation };
    (window as any).SuBlockedModal = { show: blockedShow };

    initHomepageBillboard({
      mapWrapper,
      image,
      positionDiv,
      tooltipDiv,
      fenceContainer,
      linkAnchor,
      baseurl: '',
    });

    const event = { preventDefault: vi.fn(), stopPropagation: vi.fn() };
    lastOptions.onSquareActivate(
      1,
      event,
      { personalization: ['Label', 'javascript:alert(1)'] },
      {}
    );

    expect(gateLinkNavigation).toHaveBeenCalledWith('javascript:alert(1)', event, '_blank');
    expect(blockedShow).not.toHaveBeenCalled();
  });

  it('routes blocked schemes through the embed leaving modal', async () => {
    const { initEmbedBillboard } = await import('@billboard/wrappers/embed-billboard.js');

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([]),
    });

    const container = document.createElement('div');
    document.body.appendChild(container);

    initEmbedBillboard({
      container,
      baseurl: '',
    });

    const event = { preventDefault: vi.fn() };
    lastOptions.onSquareActivate(
      1,
      event,
      { personalization: ['Label', 'javascript:alert(1)'] },
      {}
    );

    const modalInstance = createContainedLeavingModalMock.mock.results[0]?.value;
    const blockedInstance = createContainedBlockedModalMock.mock.results[0]?.value;

    expect(event.preventDefault).toHaveBeenCalled();
    expect(modalInstance.gateLinkNavigation).toHaveBeenCalledWith(
      'javascript:alert(1)',
      event,
      '_blank'
    );
    expect(blockedInstance.show).not.toHaveBeenCalled();
  });
});
