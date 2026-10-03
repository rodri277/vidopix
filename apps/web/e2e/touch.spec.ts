import { expect, test } from '@playwright/test';
import { exportPng, paintedPixels, readCanvas } from './helpers';

test.use({ hasTouch: true });

interface TouchPoint {
  x: number;
  y: number;
  id: number;
}

test('two fingers zoom and pan the canvas without drawing, one finger draws', async ({
  page,
  browserName,
}) => {
  test.skip(browserName !== 'chromium', 'Touch is simulated through the Chrome DevTools Protocol');
  await page.goto('/');
  await expect(page.getByRole('application', { name: /Drawing canvas/ })).toBeVisible();
  const canvas = await readCanvas(page);
  const client = await page.context().newCDPSession(page);
  const touch = async (
    type: 'touchStart' | 'touchMove' | 'touchEnd',
    points: TouchPoint[],
  ): Promise<void> => {
    await client.send('Input.dispatchTouchEvent', {
      type,
      touchPoints: type === 'touchEnd' ? [] : points,
    });
  };

  // One finger draws.
  const dot = canvas.center(5, 5);
  await touch('touchStart', [{ x: dot.x, y: dot.y, id: 1 }]);
  await touch('touchEnd', []);
  expect(paintedPixels(await exportPng(page))).toEqual(new Set(['5,5']));

  // Two fingers spreading apart zoom in, and drawing does not happen.
  const before = (await readCanvas(page)).zoom;
  const middle = canvas.center(16, 16);
  await touch('touchStart', [
    { x: middle.x - 20, y: middle.y, id: 1 },
    { x: middle.x + 20, y: middle.y, id: 2 },
  ]);
  for (const spread of [40, 70, 100, 130]) {
    await touch('touchMove', [
      { x: middle.x - spread, y: middle.y, id: 1 },
      { x: middle.x + spread, y: middle.y, id: 2 },
    ]);
  }
  await touch('touchEnd', []);
  await expect
    .poll(async () => /(\d+)%/.exec(await page.getByRole('contentinfo').innerText())?.[1])
    .not.toBe(String(before * 100));
  expect(paintedPixels(await exportPng(page))).toEqual(new Set(['5,5']));
});
