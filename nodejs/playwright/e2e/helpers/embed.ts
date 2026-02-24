import { expect, type Locator } from '@playwright/test';

type LocatorContext = {
  locator: (selector: string) => Locator;
};

export type EmbedUrlParams = {
  panzoom: string | null;
  bg: string | null;
  header: string | null;
  headerSize: string | null;
  blockSquares: string | null;
  silenceSquares: string | null;
  blockDomains: string | null;
};

export function parseEmbedUrl(rawUrl: string, baseUrl?: string): EmbedUrlParams {
  const url = baseUrl ? new URL(rawUrl, baseUrl) : new URL(rawUrl);
  const params = url.searchParams;

  return {
    panzoom: params.get('panzoom'),
    bg: params.get('bg'),
    header: params.get('header'),
    headerSize: params.get('headerSize'),
    blockSquares: params.get('blockSquares'),
    silenceSquares: params.get('silenceSquares'),
    blockDomains: params.get('blockDomains'),
  };
}

export async function waitForEmbedReady(context: LocatorContext) {
  await context.locator('#embed-loading').waitFor({ state: 'hidden', timeout: 20_000 });
  await context
    .locator('[data-testid="embed-billboard-grid"]')
    .waitFor({ state: 'visible', timeout: 20_000 });
}

type EmbedStateExpectations = {
  bg?: string;
  headerHidden?: boolean;
  fullbleed?: boolean;
  headerText?: string;
};

export async function expectEmbedState(context: LocatorContext, expected: EmbedStateExpectations) {
  if (expected.bg !== undefined) {
    await expect(context.locator('body')).toHaveAttribute('data-bg', expected.bg);
  }

  if (expected.headerHidden !== undefined) {
    const header = context.locator('#embed-header');
    if (expected.headerHidden) {
      await expect(header).toHaveClass(/embed-header--hidden/);
    } else {
      await expect(header).not.toHaveClass(/embed-header--hidden/);
    }
  }

  if (expected.fullbleed !== undefined) {
    await expect(context.locator('body')).toHaveAttribute(
      'data-fullbleed',
      expected.fullbleed ? 'true' : 'false'
    );
  }

  if (expected.headerText !== undefined) {
    await expect(context.locator('#embed-header-title')).toHaveText(expected.headerText);
  }
}
