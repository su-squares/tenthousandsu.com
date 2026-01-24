import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { test, expect } from '@playwright/test';
import { expectEmbedState, parseEmbedUrl, waitForEmbedReady } from './helpers/embed.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const EMBED_QUERY = 'header=squares&bg=transparent&panzoom=off';
const EMBED_PATH = `/embed.html?${EMBED_QUERY}`;
const EMBED_HOST_FIXTURE = path.resolve(__dirname, 'fixtures', 'embed-iframe-host.html');

const buildHostUrl = (embedUrl: string) => {
  const hostUrl = new URL(pathToFileURL(EMBED_HOST_FIXTURE).toString());
  hostUrl.searchParams.set('embedUrl', embedUrl);
  return hostUrl.toString();
};

test('embed renders standalone and in iframe', async ({ page }) => {
  await page.goto(EMBED_PATH, { waitUntil: 'domcontentloaded' });

  await waitForEmbedReady(page);

  const embedUrl = page.url();
  const params = parseEmbedUrl(embedUrl);
  expect(params.panzoom).toBe('off');
  expect(params.bg).toBe('transparent');
  expect(params.header).toBe('squares');

  await expectEmbedState(page, {
    bg: 'transparent',
    headerHidden: false,
    headerText: 'Su Squares',
  });

  const hostUrl = buildHostUrl(embedUrl);
  await page.goto(hostUrl, { waitUntil: 'domcontentloaded' });

  const iframe = page.locator('#embed-host-frame');
  await expect(iframe).toHaveAttribute('src', embedUrl);
  const iframeSrc = await iframe.getAttribute('src');
  expect(iframeSrc).not.toBeNull();

  const iframeParams = parseEmbedUrl(iframeSrc ?? '', page.url());
  expect(iframeParams.panzoom).toBe('off');
  expect(iframeParams.bg).toBe('transparent');
  expect(iframeParams.header).toBe('squares');

  await expect(iframe).toHaveAttribute('data-loaded', 'true');
});
