import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { clickPixel, exportPng, pixelAt, readCanvas, setPrimaryColor } from './helpers';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('application', { name: /Drawing canvas/ })).toBeVisible();
});

async function openPaletteTab(page: Page): Promise<void> {
  await page.getByRole('tab', { name: 'Palette' }).click();
  await expect(page.getByRole('group', { name: 'Loading a palette' })).toBeVisible();
}

const swatches = (page: Page) =>
  page.getByRole('group', { name: 'Palette colors' }).getByRole('button');

test('a preset loads, a swatch becomes the drawing color and the pixel keeps it', async ({
  page,
}) => {
  await openPaletteTab(page);
  await page.getByLabel('Load a preset palette').selectOption('pico-8');
  await expect(swatches(page)).toHaveCount(16);

  // PICO-8's red is #FF004D.
  await page.getByRole('button', { name: /#FF004D, 9 of 16/ }).click();
  const canvas = await readCanvas(page);
  await clickPixel(page, canvas, 3, 3);
  expect(pixelAt(await exportPng(page), 3, 3)).toEqual([255, 0, 77, 255]);

  await page.keyboard.press('ControlOrMeta+z');
  await page.keyboard.press('ControlOrMeta+z');
  await expect(swatches(page)).toHaveCount(0);
});

test('exporting a palette and importing it again changes nothing', async ({ page }) => {
  await openPaletteTab(page);
  await page.getByLabel('Load a preset palette').selectOption('endesga-32');
  await expect(swatches(page)).toHaveCount(32);
  const before = await swatches(page).evaluateAll((nodes) =>
    nodes.map((node) => node.getAttribute('aria-label')),
  );

  for (const [format, extension] of [
    ['GIMP (.gpl)', 'gpl'],
    ['Hex list (.hex)', 'hex'],
    ['JSON (.json)', 'json'],
  ] as const) {
    await page.getByLabel('Export format').selectOption({ label: format });
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export palette' }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe(`Endesga-32.${extension}`);
    const text = await readFile(await download.path(), 'utf8');
    if (extension === 'gpl') expect(text.startsWith('GIMP Palette\nName: Endesga 32\n')).toBe(true);

    // Clear the palette, then bring it back from the file we just exported.
    await page.getByLabel('Load a preset palette').selectOption('pico-8');
    await expect(swatches(page)).toHaveCount(16);
    await page.getByLabel('Palette file', { exact: true }).setInputFiles({
      name: download.suggestedFilename(),
      mimeType: 'text/plain',
      buffer: Buffer.from(text),
    });
    await expect(swatches(page)).toHaveCount(32);
    const after = await swatches(page).evaluateAll((nodes) =>
      nodes.map((node) => node.getAttribute('aria-label')),
    );
    expect(after).toEqual(before);
  }
});

test('a bad palette file is explained and leaves the palette alone', async ({ page }) => {
  await openPaletteTab(page);
  await page.getByLabel('Load a preset palette').selectOption('sweetie-16');
  await page.getByLabel('Palette file', { exact: true }).setInputFiles({
    name: 'broken.gpl',
    mimeType: 'text/plain',
    buffer: Buffer.from('GIMP Palette\nName: x\n10 20 999\n'),
  });
  await expect(page.getByRole('alert')).toContainText('Line 3');
  await expect(swatches(page)).toHaveCount(16);
});

test('replace color changes every matching pixel and one undo brings it back', async ({ page }) => {
  const canvas = await readCanvas(page);
  await setPrimaryColor(page, '#FF0000');
  await clickPixel(page, canvas, 2, 2);
  await clickPixel(page, canvas, 6, 6);

  // Keep the red in the palette, then switch the drawing color to blue.
  await openPaletteTab(page);
  await page.getByRole('button', { name: 'Add current color to the palette' }).click();
  await page.getByRole('tab', { name: 'Color' }).click();
  await setPrimaryColor(page, '#0000FF');

  await page.getByRole('tab', { name: 'Palette' }).click();
  await page.getByRole('button', { name: 'Replace a color in the drawing' }).click();
  const dialog = page.getByRole('dialog', { name: 'Replace color' });
  await dialog.getByLabel('Replace').selectOption({ label: '#FF0000' });
  await dialog.getByLabel('With').selectOption('primary');
  await dialog.getByRole('button', { name: 'Replace' }).click();
  await expect(page.getByRole('contentinfo')).toContainText('Replaced 2 pixels');

  const replaced = await exportPng(page);
  expect(pixelAt(replaced, 2, 2)).toEqual([0, 0, 255, 255]);
  expect(pixelAt(replaced, 6, 6)).toEqual([0, 0, 255, 255]);

  await page.keyboard.press('ControlOrMeta+z');
  const restored = await exportPng(page);
  expect(pixelAt(restored, 2, 2)).toEqual([255, 0, 0, 255]);
  expect(pixelAt(restored, 6, 6)).toEqual([255, 0, 0, 255]);
});

/** Puts a 4000x3000 image with four flat color quadrants into the file input. */
async function chooseBigImage(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const canvas = new OffscreenCanvas(4000, 3000);
    const context = canvas.getContext('2d');
    if (!context) throw new Error('no 2d context');
    const quadrants: [string, number, number][] = [
      ['#e63946', 0, 0],
      ['#2a9d8f', 2000, 0],
      ['#264653', 0, 1500],
      ['#f4a261', 2000, 1500],
    ];
    for (const [color, x, y] of quadrants) {
      context.fillStyle = color;
      context.fillRect(x, y, 2000, 1500);
    }
    const blob = await canvas.convertToBlob({ type: 'image/png' });
    const transfer = new DataTransfer();
    transfer.items.add(new File([blob], 'photo.png', { type: 'image/png' }));
    const input = document.querySelector<HTMLInputElement>('dialog input[type="file"]');
    if (!input) throw new Error('no file input');
    input.files = transfer.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

test('extracting a palette from a 4000x3000 photo keeps the page responsive', async ({ page }) => {
  await openPaletteTab(page);
  await page.getByRole('button', { name: 'Extract a palette from an image' }).click();
  const dialog = page.getByRole('dialog', { name: 'Extract palette from an image' });
  await expect(dialog).toBeVisible();
  await chooseBigImage(page);

  // Watch the main thread while the worker decodes and reduces the image.
  await page.evaluate(() => {
    const probe = { longest: 0, running: true };
    Object.assign(window, { __extractProbe: probe });
    let last = performance.now();
    const tick = (now: number): void => {
      probe.longest = Math.max(probe.longest, now - last);
      last = now;
      if (probe.running) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });

  await dialog.getByLabel('Colors').fill('4');
  const started = Date.now();
  await dialog.getByRole('button', { name: 'Extract' }).click();
  await expect(dialog.getByRole('img', { name: '4 extracted colors' })).toBeVisible({
    timeout: 20_000,
  });

  const elapsed = Date.now() - started;
  const longest = await page.evaluate(() => {
    const probe = (window as unknown as { __extractProbe: { longest: number; running: boolean } })
      .__extractProbe;
    probe.running = false;
    return probe.longest;
  });
  console.warn(
    `Extracting from 4000x3000 took ${String(elapsed)} ms; longest gap between frames: ${longest.toFixed(0)} ms`,
  );
  // A blocked main thread would show as a gap of a second or more; allow for slow machines.
  expect(longest).toBeLessThan(250);

  await dialog.getByRole('button', { name: 'Use as palette' }).click();
  await expect(dialog).toBeHidden();
  await expect(swatches(page)).toHaveCount(4);
  for (const hex of ['#E63946', '#2A9D8F', '#264653', '#F4A261']) {
    await expect(page.getByRole('button', { name: new RegExp(`${hex}, \\d of 4`) })).toBeVisible();
  }
});

test('extraction can be canceled while it is running', async ({ page }) => {
  // Hold the request back inside the worker call so there is always something to cancel.
  await page.addInitScript(() => {
    // eslint-disable-next-line @typescript-eslint/unbound-method -- called with the right `this` below
    const originalPostMessage = Worker.prototype.postMessage;
    Object.defineProperty(Worker.prototype, 'postMessage', {
      value(this: Worker, ...args: Parameters<typeof originalPostMessage>) {
        setTimeout(() => {
          originalPostMessage.apply(this, args);
        }, 3000);
      },
    });
  });
  await page.goto('/');
  await openPaletteTab(page);
  await page.getByRole('button', { name: 'Extract a palette from an image' }).click();
  const dialog = page.getByRole('dialog', { name: 'Extract palette from an image' });
  await chooseBigImage(page);
  await dialog.getByRole('button', { name: 'Extract' }).click();

  await expect(dialog.getByRole('progressbar')).toBeVisible();
  await dialog.getByRole('button', { name: 'Cancel extraction' }).click();
  await expect(dialog.getByText('Extraction canceled.')).toBeVisible();
  await expect(dialog.getByRole('progressbar')).toBeHidden();
  await expect(dialog.getByRole('button', { name: 'Extract' })).toBeEnabled();
  await dialog.getByRole('button', { name: 'Close' }).click();
  await expect(swatches(page)).toHaveCount(0);
});

test('the palette and generate tabs, and their dialogs, have no accessibility violations', async ({
  page,
}) => {
  await openPaletteTab(page);
  await page.getByLabel('Load a preset palette').selectOption('dawnbringer-16');
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

  await page.getByRole('tab', { name: 'Generate' }).click();
  await expect(page.getByRole('group', { name: 'Harmony colors' })).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

  await page.getByRole('tab', { name: 'Palette' }).click();
  await page.getByRole('button', { name: 'Replace a color in the drawing' }).click();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.keyboard.press('Escape');

  await page.getByRole('button', { name: 'Extract a palette from an image' }).click();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test('the tab bar works from the keyboard', async ({ page }) => {
  await page.getByRole('tab', { name: 'Color' }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('tab', { name: 'Palette' })).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('End');
  await expect(page.getByRole('tab', { name: 'Generate' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await expect(page.getByRole('tabpanel')).toContainText('Shade ramp');
});
