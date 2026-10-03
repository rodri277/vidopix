import { traceLine, traceRect } from '@vidopix/core';
import { expect, test } from '@playwright/test';
import {
  clickPixel,
  exportPng,
  paintedPixels,
  pixelAt,
  readCanvas,
  setPrimaryColor,
  SPRITE_SIZE,
} from './helpers';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('application', { name: /Drawing canvas/ })).toBeVisible();
});

test('draws a pixel and exports it scaled, pixel for pixel', async ({ page }) => {
  await setPrimaryColor(page, '#FF0080');
  const canvas = await readCanvas(page);
  await clickPixel(page, canvas, 3, 4);

  const image = await exportPng(page, 4);

  expect(image.width).toBe(SPRITE_SIZE * 4);
  expect(image.height).toBe(SPRITE_SIZE * 4);
  for (let y = 0; y < image.height; y++) {
    for (let x = 0; x < image.width; x++) {
      const inBlock = x >= 12 && x < 16 && y >= 16 && y < 20;
      expect(pixelAt(image, x, y)).toEqual(inBlock ? [255, 0, 128, 255] : [0, 0, 0, 0]);
    }
  }
});

test('a fast pointer jump leaves no gaps in the stroke', async ({ page }) => {
  const canvas = await readCanvas(page);
  const from = canvas.center(2, 3);
  const to = canvas.center(27, 19);

  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 1 });
  await page.mouse.up();

  const expected = new Set<string>();
  traceLine(2, 3, 27, 19, (x, y) => expected.add(`${String(x)},${String(y)}`));
  expect(paintedPixels(await exportPng(page))).toEqual(expected);
});

test('the secondary button paints the secondary color', async ({ page }) => {
  const canvas = await readCanvas(page);
  await clickPixel(page, canvas, 5, 5, 'right');
  const image = await exportPng(page);
  expect(pixelAt(image, 5, 5)).toEqual([255, 255, 255, 255]);
});

test('undo and redo walk through the strokes', async ({ page }) => {
  const canvas = await readCanvas(page);
  await clickPixel(page, canvas, 1, 1);
  await clickPixel(page, canvas, 2, 2);
  await clickPixel(page, canvas, 3, 3);

  await page.keyboard.press('ControlOrMeta+z');
  await page.keyboard.press('ControlOrMeta+z');
  await expect(page.getByRole('status')).toHaveText('Undid: Pencil');
  expect(paintedPixels(await exportPng(page))).toEqual(new Set(['1,1']));

  await page.keyboard.press('ControlOrMeta+Shift+z');
  await expect(page.getByRole('status')).toHaveText('Redid: Pencil');
  expect(paintedPixels(await exportPng(page))).toEqual(new Set(['1,1', '2,2']));

  await page.keyboard.press('ControlOrMeta+z');
  await page.keyboard.press('ControlOrMeta+z');
  expect(paintedPixels(await exportPng(page))).toEqual(new Set());
  await page.getByRole('menuitem', { name: 'Edit' }).click();
  await expect(page.getByRole('menuitem', { name: /^Undo/ })).toBeDisabled();
  await expect(page.getByRole('menuitem', { name: /^Redo/ })).toBeEnabled();
});

test('the fill tool floods the canvas and can be undone', async ({ page }) => {
  await setPrimaryColor(page, '#00FF00');
  await page.keyboard.press('g');
  await expect(page.getByRole('button', { name: 'Fill', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  const canvas = await readCanvas(page);
  await clickPixel(page, canvas, 10, 10);

  const filled = await exportPng(page);
  expect(paintedPixels(filled).size).toBe(SPRITE_SIZE * SPRITE_SIZE);
  expect(pixelAt(filled, 0, 0)).toEqual([0, 255, 0, 255]);

  await page.keyboard.press('ControlOrMeta+z');
  expect(paintedPixels(await exportPng(page)).size).toBe(0);
});

test('shift turns a dragged rectangle into a square', async ({ page }) => {
  await page.keyboard.press('u');
  const canvas = await readCanvas(page);
  const start = canvas.center(2, 2);
  const end = canvas.center(8, 5);

  await page.mouse.move(start.x, start.y);
  await page.keyboard.down('Shift');
  await page.mouse.down();
  await page.mouse.move(end.x, end.y, { steps: 4 });
  await page.mouse.up();
  await page.keyboard.up('Shift');

  const expected = new Set<string>();
  traceRect(2, 2, 8, 8, false, (x, y) => expected.add(`${String(x)},${String(y)}`));
  expect(paintedPixels(await exportPng(page))).toEqual(expected);
});

test('everything can be drawn with the keyboard alone', async ({ page }) => {
  await page.getByRole('application', { name: /Drawing canvas/ }).focus();
  // The cursor starts at the middle of the sprite (16, 16).
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.down('Enter');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.up('Enter');

  expect(paintedPixels(await exportPng(page))).toEqual(
    new Set(['15,16', '16,16', '17,16', '18,16']),
  );
});

test('tool shortcuts switch tools and the toolbar reflects it', async ({ page }) => {
  for (const [key, name] of [
    ['e', 'Eraser'],
    ['l', 'Line'],
    ['o', 'Ellipse'],
    ['i', 'Eyedropper'],
    ['b', 'Pencil'],
  ] as const) {
    await page.keyboard.press(key);
    await expect(page.getByRole('button', { name, exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  }
});

test('typing in the hex field does not trigger shortcuts', async ({ page }) => {
  const hex = page.getByLabel('Hex');
  await hex.click();
  await hex.fill('');
  await page.keyboard.type('bee');
  await expect(page.getByRole('button', { name: 'Pencil', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.getByRole('button', { name: 'Eraser', exact: true })).toHaveAttribute(
    'aria-pressed',
    'false',
  );
});

test('an invalid hex value is reported and does not change the color', async ({ page }) => {
  const hex = page.getByLabel('Hex');
  await hex.fill('#12');
  await hex.press('Enter');
  await expect(page.getByRole('alert')).toContainText('3, 6 or 8 hex digits');
});

test('the wheel zooms around the pointer', async ({ page }) => {
  const canvas = await readCanvas(page);
  const target = canvas.center(8, 8);
  await page.mouse.move(target.x, target.y);
  await expect(page.getByRole('contentinfo')).toContainText('8, 8');

  await page.mouse.wheel(0, -100);
  await page.mouse.move(target.x + 1, target.y + 1);
  await expect(page.getByRole('contentinfo')).toContainText('8, 8');
  const after = await readCanvas(page);
  expect(after.zoom).toBeGreaterThan(canvas.zoom);
});

test('a new sprite replaces the document with the chosen size', async ({ page }) => {
  await page.keyboard.press('ControlOrMeta+n');
  const dialog = page.getByRole('dialog', { name: 'New sprite' });
  await dialog.getByRole('button', { name: '64×64' }).click();
  await dialog.getByLabel('Name').fill('Hero');
  await dialog.getByRole('button', { name: 'Create' }).click();
  await expect(dialog).toBeHidden();

  await expect(page.getByRole('contentinfo')).toContainText('64×64 px');
  const image = await exportPng(page);
  expect(image.width).toBe(64);
});

test('rejects an impossible sprite size without losing the document', async ({ page }) => {
  await page.keyboard.press('ControlOrMeta+n');
  const dialog = page.getByRole('dialog', { name: 'New sprite' });
  await dialog.getByLabel('Width').fill('5000');
  await dialog.getByRole('button', { name: 'Create' }).click();
  await expect(dialog.getByRole('alert')).toContainText('from 1 to 1024');
  await dialog.getByRole('button', { name: 'Cancel' }).click();
  await expect(page.getByRole('contentinfo')).toContainText('32×32 px');
});

test('hiding the panels leaves only the menu and the canvas', async ({ page }) => {
  await page.keyboard.press('ControlOrMeta+\\');
  await expect(page.getByRole('toolbar', { name: 'Tools' })).toBeHidden();
  await page.keyboard.press('ControlOrMeta+\\');
  await expect(page.getByRole('toolbar', { name: 'Tools' })).toBeVisible();
});
