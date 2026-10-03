import { ditherAllows } from '@vidopix/core';
import { expect, test } from '@playwright/test';
import { clickPixel, exportPng, paintedPixels, readCanvas } from './helpers';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('application', { name: /Drawing canvas/ })).toBeVisible();
});

test('mirror buttons draw the other half of a stroke', async ({ page }) => {
  const canvas = await readCanvas(page);
  await page.getByRole('button', { name: 'Mirror left-right' }).click();
  await page.getByRole('button', { name: 'Mirror top-bottom' }).click();
  await clickPixel(page, canvas, 3, 5);
  expect(paintedPixels(await exportPng(page))).toEqual(new Set(['3,5', '28,5', '3,26', '28,26']));
  await page.keyboard.press('ControlOrMeta+z');
  expect(paintedPixels(await exportPng(page)).size).toBe(0);
});

test('the dither slider fills only the pixels of the Bayer pattern', async ({ page }) => {
  const canvas = await readCanvas(page);
  await page.keyboard.press('g');
  await page.getByLabel('Dither').fill('8');
  await clickPixel(page, canvas, 0, 0);
  const result = paintedPixels(await exportPng(page));
  expect(result.size).toBe(32 * 32 * 0.5);
  for (const key of result) {
    const [x, y] = key.split(',').map(Number) as [number, number];
    expect(ditherAllows(x, y, 8)).toBe(true);
  }
});

test('pixel-perfect takes the corners out of a staircase', async ({ page }) => {
  const canvas = await readCanvas(page);
  await page.getByRole('button', { name: 'Pixel-perfect' }).click();
  const path: [number, number][] = [
    [2, 2],
    [3, 2],
    [3, 3],
    [4, 3],
    [4, 4],
  ];
  const [start = [2, 2]] = path;
  const first = canvas.center(start[0], start[1]);
  await page.mouse.move(first.x, first.y);
  await page.mouse.down();
  for (const [x, y] of path.slice(1)) {
    const point = canvas.center(x, y);
    await page.mouse.move(point.x, point.y);
  }
  await page.mouse.up();
  expect(paintedPixels(await exportPng(page))).toEqual(new Set(['2,2', '3,3', '4,4']));
});

test('the aids are announced as toggles and the guides appear only when mirroring', async ({
  page,
}) => {
  const mirror = page.getByRole('button', { name: 'Mirror left-right' });
  await expect(mirror).toHaveAttribute('aria-pressed', 'false');
  await mirror.click();
  await expect(mirror).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('u');
  await expect(page.getByRole('button', { name: 'Mirror left-right' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.keyboard.press('g');
  await expect(page.getByRole('button', { name: 'Mirror left-right' })).toHaveCount(0);
});
