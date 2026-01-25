import { type Page } from '@playwright/test';
import { mkdtempSync, readFileSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const FIXTURES_DIR = resolve(__dirname, '..', 'fixtures');

type PersonalizeRow = {
  squareId: number | null;
  title?: string;
  uri?: string;
  imagePixelsHex?: string;
  imagePreviewUrl?: string;
};

export function getRed10x10Path() {
  return resolve(FIXTURES_DIR, 'red-10x10.png');
}

export function getRed40x40Path() {
  return resolve(FIXTURES_DIR, 'red-40x40.png');
}

export async function visitPersonalizeModernPage(page: Page) {
  await page.goto('/personalize-modern.html', { waitUntil: 'domcontentloaded' });
  await waitForPersonalizeModernReady(page);
}

export async function waitForPersonalizeModernReady(page: Page) {
  await page.waitForFunction(
    () =>
      typeof (window as any).personalizeModern?.getRows === 'function' &&
      typeof (window as any).personalizeModern?.ensureRowForSquare === 'function'
  );
}

export function buildCsvContent(squareIds: number[]) {
  const lines = ['square_id,title,uri'];
  squareIds.forEach((id) => {
    lines.push(`${id},Title ${id},https://example.com/${id}`);
  });
  return lines.join('\n');
}

export async function uploadCsvBatch(page: Page, squareIds: number[]) {
  const csv = buildCsvContent(squareIds);
  await page.locator('#csv-batch-upload').setInputFiles({
    name: 'personalize-batch.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(csv, 'utf-8'),
  });
}

export function buildImageBatchDirectory(squareIds: number[], imagePath: string) {
  const buffer = readFileSync(imagePath);
  const dir = mkdtempSync(join(tmpdir(), 'su-image-batch-'));
  const uniqueIds = Array.from(new Set(squareIds));
  uniqueIds.forEach((squareId) => {
    const filename = join(dir, `${squareId}.png`);
    writeFileSync(filename, buffer);
  });
  return dir;
}

export async function uploadImageBatch(
  page: Page,
  squareIds: number[],
  imagePath: string
) {
  const directory = buildImageBatchDirectory(squareIds, imagePath);
  await page.locator('#image-batch-upload').setInputFiles(directory);
}

export async function waitForSquares(page: Page, squareIds: number[]) {
  await page.waitForFunction((ids: number[]) => {
    const rows =
      ((window as any).personalizeModern?.getRows?.() as PersonalizeRow[]) || [];
    const available = new Set(rows.map((row: any) => row.squareId));
    return ids.every((id) => available.has(id));
  }, squareIds);
}

export async function waitForSquareText(
  page: Page,
  entries: Array<{ squareId: number; title?: string; uri?: string }>
) {
  await page.waitForFunction((items) => {
    const rows =
      ((window as any).personalizeModern?.getRows?.() as PersonalizeRow[]) || [];
    const rowMap = new Map(rows.map((row) => [row.squareId, row]));
    return items.every((item) => {
      const row = rowMap.get(item.squareId);
      if (!row) return false;
      if (typeof item.title === 'string' && row.title !== item.title) return false;
      if (typeof item.uri === 'string' && row.uri !== item.uri) return false;
      return true;
    });
  }, entries);
}

export async function waitForSquareImages(page: Page, squareIds: number[]) {
  await page.waitForFunction((ids: number[]) => {
    const rows =
      ((window as any).personalizeModern?.getRows?.() as PersonalizeRow[]) || [];
    const rowMap = new Map(rows.map((row) => [row.squareId, row]));
    return ids.every((id) => {
      const row = rowMap.get(id);
      return (
        row &&
        typeof row.imagePixelsHex === 'string' &&
        row.imagePixelsHex.startsWith('0x') &&
        row.imagePixelsHex.length > 10
      );
    });
  }, squareIds);
}

export async function waitForOwnedGlowStatic(page: Page, squareIds: number[]) {
  await page.waitForFunction((ids: number[]) => {
    const canvas = document.querySelector(
      '.personalize-billboard__glow-canvas'
    ) as HTMLCanvasElement | null;
    if (!canvas || !canvas.width || !canvas.height) return false;
    const ctx = canvas.getContext('2d');
    if (!ctx) return false;
    const cell = canvas.width / 100;
    return ids.every((id) => {
      const index = id - 1;
      if (index < 0) return false;
      const row = Math.floor(index / 100);
      const col = index % 100;
      const x = Math.floor((col + 0.5) * cell);
      const y = Math.floor((row + 0.5) * cell);
      const data = ctx.getImageData(x, y, 1, 1).data;
      return data[3] > 0;
    });
  }, squareIds);
}

export async function waitForBillboardPreviewImages(
  page: Page,
  squareIds: number[]
) {
  await page.waitForFunction((ids: number[]) => {
    const rows =
      ((window as any).personalizeModern?.getRows?.() as PersonalizeRow[]) || [];
    const rowMap = new Map(rows.map((row) => [row.squareId, row]));
    const grid = document.querySelector('.personalize-billboard__grid');
    if (!grid) return false;
    return ids.every((id) => {
      const row = rowMap.get(id);
      if (!row || !row.imagePreviewUrl) return false;
      const cell = grid.querySelector(
        `.personalize-billboard__cell[data-square="${id}"]`
      ) as HTMLElement | null;
      if (!cell || cell.dataset.preview !== 'true') return false;
      const previewValue = cell.style.getPropertyValue('--preview-image') || '';
      return previewValue.includes(row.imagePreviewUrl);
    });
  }, squareIds);
}
