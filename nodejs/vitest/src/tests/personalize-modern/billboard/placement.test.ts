import { type MockInstance } from 'vitest';
import {
  revokePlacementUrl,
  loadPlacementImage,
  buildPlacementTiles,
  PLACEMENT_CHUNK_SIZE,
} from '@assets-js/personalize-modern/billboard/placement.js';

describe('PLACEMENT_CHUNK_SIZE', () => {
  it('exports chunk size constant', () => {
    expect(PLACEMENT_CHUNK_SIZE).toBe(200);
  });
});

describe('revokePlacementUrl', () => {
  let revokeObjectURLSpy: MockInstance;

  beforeEach(() => {
    revokeObjectURLSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
  });

  afterEach(() => {
    revokeObjectURLSpy.mockRestore();
  });

  it('does nothing for null/undefined', () => {
    revokePlacementUrl(null);
    revokePlacementUrl(undefined);

    expect(revokeObjectURLSpy).not.toHaveBeenCalled();
  });

  it('does nothing for non-string values', () => {
    revokePlacementUrl(123 as unknown as string);
    revokePlacementUrl({} as unknown as string);

    expect(revokeObjectURLSpy).not.toHaveBeenCalled();
  });

  it('does nothing for non-blob URLs', () => {
    revokePlacementUrl('https://example.com/image.png');
    revokePlacementUrl('data:image/png;base64,abc');

    expect(revokeObjectURLSpy).not.toHaveBeenCalled();
  });

  it('revokes blob URLs', () => {
    const blobUrl = 'blob:https://example.com/abc-123';
    revokePlacementUrl(blobUrl);

    expect(revokeObjectURLSpy).toHaveBeenCalledWith(blobUrl);
  });
});

describe('loadPlacementImage', () => {
  let createObjectURLSpy: MockInstance;
  let revokeObjectURLSpy: MockInstance;

  beforeEach(() => {
    createObjectURLSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test-url');
    revokeObjectURLSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
  });

  afterEach(() => {
    createObjectURLSpy.mockRestore();
    revokeObjectURLSpy.mockRestore();
  });

  it('creates object URL from file', async () => {
    const file = new File(['test'], 'test.png', { type: 'image/png' });

    // Trigger load event on the image
    const originalImage = window.Image;
    window.Image = class MockImage {
      src = '';
      width = 100;
      height = 100;
      naturalWidth = 100;
      naturalHeight = 100;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;

      addEventListener(event: string, handler: () => void) {
        if (event === 'load') {
          this.onload = handler;
          // Simulate async load
          setTimeout(() => handler(), 0);
        } else if (event === 'error') {
          this.onerror = handler;
        }
      }

      removeEventListener() {}
    } as unknown as typeof Image;

    const result = await loadPlacementImage(file);

    expect(createObjectURLSpy).toHaveBeenCalledWith(file);
    expect(result).toHaveProperty('image');
    expect(result).toHaveProperty('url');

    window.Image = originalImage;
  });

  it('rejects with error message for image load failure', async () => {
    const file = new File(['test'], 'test.png', { type: 'image/png' });

    const originalImage = window.Image;
    window.Image = class MockImage {
      src = '';
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;

      addEventListener(event: string, handler: () => void) {
        if (event === 'load') {
          this.onload = handler;
        } else if (event === 'error') {
          this.onerror = handler;
          setTimeout(() => handler(), 0);
        }
      }

      removeEventListener() {}
    } as unknown as typeof Image;

    await expect(loadPlacementImage(file)).rejects.toThrow('Unable to read file');
    expect(revokeObjectURLSpy).toHaveBeenCalled();

    window.Image = originalImage;
  });

  it('rejects animated images (different natural vs display dimensions)', async () => {
    const file = new File(['test'], 'animated.gif', { type: 'image/gif' });

    const originalImage = window.Image;
    window.Image = class MockImage {
      src = '';
      width = 100;
      height = 100;
      naturalWidth = 200; // Different from width = animated
      naturalHeight = 200;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;

      addEventListener(event: string, handler: () => void) {
        if (event === 'load') {
          this.onload = handler;
          setTimeout(() => handler(), 0);
        } else if (event === 'error') {
          this.onerror = handler;
        }
      }

      removeEventListener() {}
    } as unknown as typeof Image;

    await expect(loadPlacementImage(file)).rejects.toThrow('Image must not be animated');
    expect(revokeObjectURLSpy).toHaveBeenCalled();

    window.Image = originalImage;
  });

  it('rejects images with zero dimensions', async () => {
    const file = new File(['test'], 'bad.png', { type: 'image/png' });

    const originalImage = window.Image;
    window.Image = class MockImage {
      src = '';
      width = 0;
      height = 0;
      naturalWidth = 0;
      naturalHeight = 0;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;

      addEventListener(event: string, handler: () => void) {
        if (event === 'load') {
          this.onload = handler;
          setTimeout(() => handler(), 0);
        } else if (event === 'error') {
          this.onerror = handler;
        }
      }

      removeEventListener() {}
    } as unknown as typeof Image;

    await expect(loadPlacementImage(file)).rejects.toThrow('Unable to read file');
    expect(revokeObjectURLSpy).toHaveBeenCalled();

    window.Image = originalImage;
  });
});

describe('buildPlacementTiles', () => {
  it('returns empty tiles for null state', async () => {
    const result = await buildPlacementTiles(null);

    expect(result).toEqual({ tiles: [], alphaWarning: false });
  });

  it('returns empty tiles for state without image', async () => {
    const result = await buildPlacementTiles({ row: 0, col: 0 });

    expect(result).toEqual({ tiles: [], alphaWarning: false });
  });

  // Canvas-dependent tests skipped in happy-dom (no canvas support)
  // These would need jsdom with canvas package or browser environment
});
