import { readFile } from 'node:fs/promises';
import { expect, test, type Download, type Page } from '@playwright/test';
import {
  clickPixel,
  decodeGif,
  exportPng,
  openExport,
  pixelAt,
  readCanvas,
  screenPixel,
  setPrimaryColor,
} from './helpers';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('application', { name: /Drawing canvas/ })).toBeVisible();
});

const frameButton = (page: Page, number: number) =>
  page
    .getByRole('list', { name: 'Frames' })
    .getByRole('button', { name: new RegExp(`^Frame ${String(number)} of`) });

const durationField = (page: Page, number: number) =>
  page.getByLabel(`Duration of frame ${String(number)} (ms)`);

/** Draws one pixel of a color on the active frame. */
async function paint(page: Page, x: number, y: number, hex: string): Promise<void> {
  const canvas = await readCanvas(page);
  await setPrimaryColor(page, hex);
  await clickPixel(page, canvas, x, y);
}

test('each frame keeps its own drawing and undo returns to the frame it belongs to', async ({
  page,
}) => {
  await paint(page, 2, 2, '#FF0000');
  await page.getByRole('button', { name: 'New frame' }).click();
  await expect(frameButton(page, 2)).toHaveAttribute('aria-current', 'true');
  expect(pixelAt(await exportPng(page), 2, 2)).toEqual([0, 0, 0, 0]);

  await paint(page, 5, 5, '#0000FF');
  await frameButton(page, 1).click();
  const first = await exportPng(page);
  expect(pixelAt(first, 2, 2)).toEqual([255, 0, 0, 255]);
  expect(pixelAt(first, 5, 5)).toEqual([0, 0, 0, 0]);

  // The last stroke was drawn on frame 2: undoing it shows that frame again.
  await page.keyboard.press('ControlOrMeta+z');
  await expect(frameButton(page, 2)).toHaveAttribute('aria-current', 'true');
  expect(pixelAt(await exportPng(page), 5, 5)).toEqual([0, 0, 0, 0]);
});

test('frames can be duplicated, reordered with Alt+arrows and deleted', async ({ page }) => {
  await paint(page, 1, 1, '#FF0000');
  await page.getByRole('button', { name: 'Duplicate frame' }).click();
  await expect(page.getByRole('list', { name: 'Frames' }).getByRole('listitem')).toHaveCount(2);
  expect(pixelAt(await exportPng(page), 1, 1)).toEqual([255, 0, 0, 255]);

  await page.getByRole('button', { name: 'New frame' }).click();
  await paint(page, 9, 9, '#00FF00');
  // Move the green frame to the front from the keyboard.
  await frameButton(page, 3).focus();
  await page.keyboard.press('Alt+ArrowLeft');
  await page.keyboard.press('Alt+ArrowLeft');
  await expect(frameButton(page, 1)).toHaveAttribute('aria-current', 'true');
  expect(pixelAt(await exportPng(page), 9, 9)).toEqual([0, 255, 0, 255]);

  await page.getByRole('button', { name: 'Delete frame' }).click();
  await expect(page.getByRole('list', { name: 'Frames' }).getByRole('listitem')).toHaveCount(2);
  expect(pixelAt(await exportPng(page), 1, 1)).toEqual([255, 0, 0, 255]);
  await page.keyboard.press('ControlOrMeta+z');
  await expect(page.getByRole('list', { name: 'Frames' }).getByRole('listitem')).toHaveCount(3);
});

test('the comma and period keys move between frames', async ({ page }) => {
  await page.getByRole('button', { name: 'New frame' }).click();
  await page.getByRole('button', { name: 'New frame' }).click();
  await page.getByRole('application').focus();
  await page.keyboard.press(',');
  await expect(frameButton(page, 2)).toHaveAttribute('aria-current', 'true');
  await page.keyboard.press('.');
  await page.keyboard.press('.');
  await expect(frameButton(page, 3)).toHaveAttribute('aria-current', 'true');
});

test('onion skin shows the previous frame in red and the next one in blue', async ({ page }) => {
  const canvas = await readCanvas(page);
  await paint(page, 4, 4, '#FFFFFF');
  await page.getByRole('button', { name: 'New frame' }).click();
  await paint(page, 8, 8, '#FFFFFF');
  await page.getByRole('button', { name: 'New frame' }).click();

  const before = await screenPixel(page, canvas, 8, 8);
  await page.getByRole('button', { name: 'Show the previous frame' }).click();
  await expect
    .poll(async () => {
      const [r, g, b] = await screenPixel(page, canvas, 8, 8);
      return r > b && r > g;
    })
    .toBe(true);
  expect(await screenPixel(page, canvas, 8, 8)).not.toEqual(before);

  // The ghost is not part of the picture: exporting shows only the active frame.
  expect(pixelAt(await exportPng(page), 8, 8)).toEqual([0, 0, 0, 0]);

  await frameButton(page, 1).click();
  await page.getByRole('button', { name: 'Show the next frame' }).click();
  await expect
    .poll(async () => {
      const [r, g, b] = await screenPixel(page, canvas, 8, 8);
      return b > r && b > g;
    })
    .toBe(true);
});

test('playing loops the frames without changing the document', async ({ page }) => {
  await page.getByRole('button', { name: 'New frame' }).click();
  await page.getByRole('button', { name: 'New frame' }).click();
  await frameButton(page, 1).click();
  await page.getByLabel('FPS').fill('25');
  await page.getByLabel('FPS').press('Enter');
  await expect(durationField(page, 2)).toHaveValue('40');

  const seen = new Set<string>();
  await page.getByRole('button', { name: 'Play' }).click();
  await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible();
  await expect
    .poll(
      async () => {
        const playing = await page
          .locator('[data-playing="true"] [data-frame]')
          .getAttribute('data-frame');
        if (playing !== null) seen.add(playing);
        return seen.size;
      },
      { intervals: [10] },
    )
    .toBe(3);

  await page.keyboard.press('p');
  await expect(page.getByRole('button', { name: 'Play' })).toBeVisible();
  await expect(frameButton(page, 1)).toHaveAttribute('aria-current', 'true');
  // Playing and pausing are not undo steps: undo takes back the frame rate change before them.
  await page.keyboard.press('ControlOrMeta+z');
  await expect(durationField(page, 2)).toHaveValue('100');
  await expect(page.getByRole('list', { name: 'Frames' }).getByRole('listitem')).toHaveCount(3);
});

test('an animated GIF keeps each frame, its duration and its transparency', async ({
  page,
  browserName,
}) => {
  await paint(page, 1, 1, '#FF0000');
  await page.getByRole('button', { name: 'New frame' }).click();
  await paint(page, 2, 1, '#00FF00');
  await page.getByRole('button', { name: 'New frame' }).click();
  await paint(page, 3, 1, '#0000FF');
  await durationField(page, 1).fill('60');
  await durationField(page, 1).press('Enter');
  await durationField(page, 2).fill('250');
  await durationField(page, 2).press('Enter');
  await durationField(page, 3).fill('40');
  await durationField(page, 3).press('Enter');
  await expect(durationField(page, 2)).toHaveValue('250');

  const dialog = await openExport(page, 'Animated GIF');
  await expect(dialog.getByText(/3 frames/)).toBeVisible();
  const downloadPromise = page.waitForEvent('download');
  await dialog.getByRole('button', { name: 'Export' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('Untitled.gif');
  const gif = await decodeGif(page, download);

  expect([gif.width, gif.height]).toEqual([32, 32]);
  expect(gif.frames).toHaveLength(3);
  expect(gif.frames.map((f) => Math.round(f.durationMs))).toEqual([60, 250, 40]);
  // Engines report "loops forever" differently: Chromium says Infinity (or 0), WebKit says -1.
  expect([0, -1, Infinity]).toContain(gif.repetitionCount);

  // WebKit's ImageDecoder hands back frames without an alpha channel, although the same GIF shown
  // in an <img> or decoded to an ImageBitmap is transparent there. Pixels are checked where it works.
  if (browserName !== 'chromium') return;

  const at = (frame: number, x: number, y: number) => {
    const data = gif.frames[frame]?.data ?? [];
    const index = (y * gif.width + x) * 4;
    return [data[index], data[index + 1], data[index + 2], data[index + 3]];
  };
  // Each frame has only its own pixel; everything else is transparent, not black or white.
  expect(at(0, 1, 1)).toEqual([255, 0, 0, 255]);
  expect(at(1, 2, 1)).toEqual([0, 255, 0, 255]);
  expect(at(2, 3, 1)).toEqual([0, 0, 255, 255]);
  expect(at(0, 2, 1)[3]).toBe(0);
  expect(at(1, 1, 1)[3]).toBe(0);
  expect(at(2, 0, 0)[3]).toBe(0);
});

test('a spritesheet and its JSON agree with each other', async ({ page }) => {
  await paint(page, 0, 0, '#FF0000');
  await page.getByRole('button', { name: 'New frame' }).click();
  await paint(page, 1, 0, '#00FF00');
  await page.getByRole('button', { name: 'New frame' }).click();
  await paint(page, 2, 0, '#0000FF');
  await durationField(page, 2).fill('300');
  await durationField(page, 2).press('Enter');

  const dialog = await openExport(page, 'Spritesheet (PNG + JSON)');
  await dialog.getByLabel('Columns').fill('2');
  const downloads: Download[] = [];
  page.on('download', (download) => downloads.push(download));
  await dialog.getByRole('button', { name: 'Export' }).click();
  await expect.poll(() => downloads.length).toBe(2);
  await expect(dialog).toBeHidden();

  expect(downloads.map((d) => d.suggestedFilename()).sort()).toEqual([
    'Untitled.json',
    'Untitled.png',
  ]);
  const jsonDownload = downloads.find((d) => d.suggestedFilename().endsWith('.json'));
  const pngDownload = downloads.find((d) => d.suggestedFilename().endsWith('.png'));
  if (!jsonDownload || !pngDownload) throw new Error('missing download');
  const json = JSON.parse(await readFile(await jsonDownload.path(), 'utf8')) as {
    meta: { image: string; size: { w: number; h: number }; frameCount: number };
    frames: { x: number; y: number; w: number; h: number; duration: number }[];
  };

  expect(json.meta).toMatchObject({ image: 'Untitled.png', size: { w: 64, h: 64 }, frameCount: 3 });
  expect(json.frames.map((f) => f.duration)).toEqual([100, 300, 100]);
  expect(json.frames.map((f) => [f.x, f.y])).toEqual([
    [0, 0],
    [32, 0],
    [0, 32],
  ]);

  const base64 = (await readFile(await pngDownload.path())).toString('base64');
  const sheet = await page.evaluate(async (encoded) => {
    const bytes = Uint8Array.from(atob(encoded), (char) => char.charCodeAt(0));
    const bitmap = await createImageBitmap(new Blob([bytes], { type: 'image/png' }));
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const context = canvas.getContext('2d');
    if (!context) throw new Error('no 2d context');
    context.drawImage(bitmap, 0, 0);
    return {
      width: bitmap.width,
      height: bitmap.height,
      data: Array.from(context.getImageData(0, 0, bitmap.width, bitmap.height).data),
    };
  }, base64);
  expect([sheet.width, sheet.height]).toEqual([json.meta.size.w, json.meta.size.h]);

  const colors = [
    [255, 0, 0, 255],
    [0, 255, 0, 255],
    [0, 0, 255, 255],
  ];
  json.frames.forEach((frame, index) => {
    // Frame i has one pixel at (i, 0) of its own rectangle, and nothing else.
    expect(pixelAt(sheet, frame.x + index, frame.y)).toEqual(colors[index]);
    let painted = 0;
    for (let y = 0; y < frame.h; y++) {
      for (let x = 0; x < frame.w; x++) {
        if (pixelAt(sheet, frame.x + x, frame.y + y)[3] !== 0) painted++;
      }
    }
    expect(painted).toBe(1);
  });
});

test('a project with frames saves and opens again', async ({ page }) => {
  await paint(page, 3, 3, '#FF0000');
  await page.getByRole('button', { name: 'New frame' }).click();
  await paint(page, 6, 6, '#00FF00');
  await durationField(page, 2).fill('170');
  await durationField(page, 2).press('Enter');

  const downloadPromise = page.waitForEvent('download');
  await page.keyboard.press('ControlOrMeta+s');
  const download = await downloadPromise;
  const text = await readFile(await download.path(), 'utf8');
  const saved = JSON.parse(text) as { sprite: { frames: { duration: number }[] } };
  expect(saved.sprite.frames.map((f) => f.duration)).toEqual([100, 170]);

  await page.keyboard.press('ControlOrMeta+n');
  await page
    .getByRole('dialog', { name: 'New sprite' })
    .getByRole('button', { name: 'Create' })
    .click();
  await expect(page.getByRole('list', { name: 'Frames' }).getByRole('listitem')).toHaveCount(1);

  const chooser = page.waitForEvent('filechooser');
  await page.keyboard.press('ControlOrMeta+o');
  await (
    await chooser
  ).setFiles({
    name: 'anim.vidopix',
    mimeType: 'application/json',
    buffer: Buffer.from(text),
  });
  await expect(page.getByRole('list', { name: 'Frames' }).getByRole('listitem')).toHaveCount(2);
  await expect(durationField(page, 2)).toHaveValue('170');
});
