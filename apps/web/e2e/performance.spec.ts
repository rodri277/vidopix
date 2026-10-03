import { expect, test, type Page } from '@playwright/test';
import { readCanvas } from './helpers';

interface FrameProbe {
  readonly mean: number;
  readonly p95: number;
  readonly frames: number;
}

/** Measures the time between animation frames while `action` runs. */
async function measureFrames(page: Page, action: () => Promise<void>): Promise<FrameProbe> {
  await page.evaluate(() => {
    const probe = { deltas: [] as number[], running: true };
    Object.assign(window, { __probe: probe });
    let last = performance.now();
    const tick = (now: number): void => {
      probe.deltas.push(now - last);
      last = now;
      if (probe.running) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  await action();
  return page.evaluate(() => {
    const probe = (window as unknown as { __probe: { deltas: number[]; running: boolean } })
      .__probe;
    probe.running = false;
    const deltas = probe.deltas.slice(2).sort((a, b) => a - b);
    const mean = deltas.reduce((sum, value) => sum + value, 0) / deltas.length;
    return { mean, p95: deltas[Math.floor(deltas.length * 0.95)] ?? 0, frames: deltas.length };
  });
}

test('drawing on a 256x256 sprite keeps the frame rate near 60 fps', async ({ page }, testInfo) => {
  await page.goto('/');
  await expect(page.getByRole('application', { name: /Drawing canvas/ })).toBeVisible();
  await page.keyboard.press('ControlOrMeta+n');
  const dialog = page.getByRole('dialog', { name: 'New sprite' });
  await dialog.getByRole('button', { name: '256×256' }).click();
  await dialog.getByRole('button', { name: 'Create' }).click();
  await expect(page.getByRole('contentinfo')).toContainText('256×256 px');

  const canvas = await readCanvas(page, 256, 256);
  await page.keyboard.press('ControlOrMeta+\\');
  await page.keyboard.press('ControlOrMeta+\\');

  const probe = await measureFrames(page, async () => {
    const start = canvas.center(20, 20);
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    for (let i = 0; i < 400; i++) {
      const point = canvas.center(20 + ((i * 3) % 200), 20 + ((i * 5) % 200));
      await page.mouse.move(point.x, point.y);
    }
    await page.mouse.up();
  });

  testInfo.annotations.push({
    type: 'frame time',
    description: `mean ${probe.mean.toFixed(1)} ms, p95 ${probe.p95.toFixed(1)} ms over ${String(probe.frames)} frames`,
  });
  console.warn(
    `Frame time while drawing at 256x256: mean ${probe.mean.toFixed(1)} ms, p95 ${probe.p95.toFixed(1)} ms (${String(probe.frames)} frames)`,
  );
  // 60 fps is 16.7 ms per frame. The bound is loose enough for shared CI machines.
  expect(probe.mean).toBeLessThan(20);
});
