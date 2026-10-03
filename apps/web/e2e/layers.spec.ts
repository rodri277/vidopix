import { traceRect } from '@vidopix/core';
import { expect, test, type Page } from '@playwright/test';
import {
  clickPixel,
  exportPng,
  paintedPixels,
  pixelAt,
  readCanvas,
  setPrimaryColor,
} from './helpers';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('application', { name: /Drawing canvas/ })).toBeVisible();
});

const layerButton = (page: Page, name: string | RegExp) =>
  page.getByRole('list', { name: 'Layer list' }).getByRole('button', { name });

test('layers stack, hide and export together', async ({ page }) => {
  const canvas = await readCanvas(page);
  await setPrimaryColor(page, '#FF0000');
  await clickPixel(page, canvas, 4, 4);

  await page.keyboard.press('ControlOrMeta+Shift+n');
  await expect(layerButton(page, /^Layer 2/)).toHaveAttribute('aria-current', 'true');
  await setPrimaryColor(page, '#0000FF');
  await clickPixel(page, canvas, 5, 4);

  const both = await exportPng(page);
  expect(pixelAt(both, 4, 4)).toEqual([255, 0, 0, 255]);
  expect(pixelAt(both, 5, 4)).toEqual([0, 0, 255, 255]);

  await page.getByRole('button', { name: 'Hide Layer 2' }).click();
  const hidden = await exportPng(page);
  expect(pixelAt(hidden, 5, 4)).toEqual([0, 0, 0, 0]);
  expect(pixelAt(hidden, 4, 4)).toEqual([255, 0, 0, 255]);

  await page.keyboard.press('ControlOrMeta+z');
  expect(pixelAt(await exportPng(page), 5, 4)).toEqual([0, 0, 255, 255]);
});

test('a locked layer refuses to be drawn on and says so', async ({ page }) => {
  await page.getByRole('button', { name: 'Lock Layer 1' }).click();
  const canvas = await readCanvas(page);
  await clickPixel(page, canvas, 3, 3);
  await expect(page.getByRole('contentinfo')).toContainText('The active layer is locked');
  expect(paintedPixels(await exportPng(page)).size).toBe(0);
});

test('layers can be reordered, renamed and merged from the keyboard', async ({ page }) => {
  await setPrimaryColor(page, '#FF0000');
  const canvas = await readCanvas(page);
  await clickPixel(page, canvas, 1, 1);
  await page.getByRole('button', { name: 'New layer' }).click();
  await setPrimaryColor(page, '#00FF00');
  await clickPixel(page, canvas, 1, 1);

  // Rename the active layer with F2.
  await layerButton(page, /^Layer 2/).focus();
  await page.keyboard.press('F2');
  await page.getByRole('textbox', { name: /Rename Layer 2/ }).fill('Paint');
  await page.keyboard.press('Enter');
  await expect(layerButton(page, /^Paint/)).toBeVisible();

  // Alt+ArrowDown moves it below Layer 1, so the red pixel is now on top.
  await layerButton(page, /^Paint/).focus();
  await page.keyboard.press('Alt+ArrowDown');
  expect(pixelAt(await exportPng(page), 1, 1)).toEqual([255, 0, 0, 255]);

  // With "Paint" at the bottom, merge Layer 1 (above) down into it.
  await layerButton(page, /^Layer 1/).click();
  await page.getByRole('button', { name: 'Merge down' }).click();
  await expect(page.getByRole('list', { name: 'Layer list' }).getByRole('listitem')).toHaveCount(1);
  expect(pixelAt(await exportPng(page), 1, 1)).toEqual([255, 0, 0, 255]);

  await page.keyboard.press('ControlOrMeta+z');
  await expect(page.getByRole('list', { name: 'Layer list' }).getByRole('listitem')).toHaveCount(2);
});

test('drag and drop reorders layers', async ({ page }) => {
  await page.getByRole('button', { name: 'New layer' }).click();
  const list = page.getByRole('list', { name: 'Layer list' });
  await expect(list.getByRole('listitem').first()).toContainText('Layer 2');

  await list.getByRole('listitem').first().dragTo(list.getByRole('listitem').last());
  await expect(list.getByRole('listitem').first()).toContainText('Layer 1');
});

test('selecting limits drawing, and the selection can be moved and dropped', async ({ page }) => {
  await setPrimaryColor(page, '#FF0000');
  const canvas = await readCanvas(page);

  // Select 4..7 x 4..7 and paint a line across the whole canvas: only the part inside shows.
  await page.keyboard.press('m');
  const from = canvas.center(4, 4);
  const to = canvas.center(7, 7);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 3 });
  await page.mouse.up();
  await expect(page.getByRole('contentinfo')).toContainText('Selection 4×4');

  await page.keyboard.press('b');
  const left = canvas.center(0, 5);
  const right = canvas.center(15, 5);
  await page.mouse.move(left.x, left.y);
  await page.mouse.down();
  await page.mouse.move(right.x, right.y, { steps: 2 });
  await page.mouse.up();
  expect(paintedPixels(await exportPng(page))).toEqual(new Set(['4,5', '5,5', '6,5', '7,5']));

  // Move the selection 8 pixels to the right with the keyboard, then drop it with Enter.
  await page.keyboard.press('v');
  await page.getByRole('application', { name: /Drawing canvas/ }).focus();
  for (let i = 0; i < 8; i++) await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  expect(paintedPixels(await exportPng(page))).toEqual(new Set(['12,5', '13,5', '14,5', '15,5']));

  // One undo takes the whole move back.
  await page.keyboard.press('ControlOrMeta+z');
  expect(paintedPixels(await exportPng(page))).toEqual(new Set(['4,5', '5,5', '6,5', '7,5']));
});

test('copy and paste float the content until it is dropped', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await setPrimaryColor(page, '#FF0000');
  const canvas = await readCanvas(page);
  await clickPixel(page, canvas, 2, 2);

  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.press('ControlOrMeta+c');
  await page.getByRole('menuitem', { name: 'Edit' }).click();
  await page.getByRole('menuitem', { name: 'Paste' }).click();
  await expect(page.getByRole('button', { name: 'Move', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );

  await page.keyboard.press('Enter');
  const image = await exportPng(page);
  expect(pixelAt(image, 2, 2)).toEqual([255, 0, 0, 255]);

  // Pasting twice and canceling the second one leaves no trace.
  await page.getByRole('menuitem', { name: 'Edit' }).click();
  await page.getByRole('menuitem', { name: 'Paste' }).click();
  await page.keyboard.press('Escape');
  expect(paintedPixels(await exportPng(page))).toEqual(paintedPixels(image));
});

test('delete clears the selection and deselect removes it', async ({ page }) => {
  await setPrimaryColor(page, '#FF0000');
  await page.keyboard.press('g');
  const canvas = await readCanvas(page);
  await clickPixel(page, canvas, 0, 0);
  expect(paintedPixels(await exportPng(page)).size).toBe(32 * 32);

  await page.keyboard.press('m');
  const a = canvas.center(0, 0);
  const b = canvas.center(3, 3);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(b.x, b.y, { steps: 2 });
  await page.mouse.up();
  await page.keyboard.press('Delete');

  const cleared = paintedPixels(await exportPng(page));
  expect(cleared.size).toBe(32 * 32 - 16);
  expect(cleared.has('2,2')).toBe(false);

  await page.keyboard.press('ControlOrMeta+d');
  await expect(page.getByRole('contentinfo')).not.toContainText('Selection');
});

test('shift squares the selection tool', async ({ page }) => {
  const canvas = await readCanvas(page);
  await page.keyboard.press('m');
  const start = canvas.center(3, 3);
  const end = canvas.center(9, 5);
  await page.mouse.move(start.x, start.y);
  await page.keyboard.down('Shift');
  await page.mouse.down();
  await page.mouse.move(end.x, end.y, { steps: 3 });
  await page.mouse.up();
  await page.keyboard.up('Shift');
  await expect(page.getByRole('contentinfo')).toContainText('Selection 7×7');

  // Filling inside the selection shows its exact shape: a 7x7 square from (3,3).
  await page.keyboard.press('g');
  await clickPixel(page, canvas, 5, 5);
  const expected = new Set<string>();
  traceRect(3, 3, 9, 9, true, (x, y) => expected.add(`${String(x)},${String(y)}`));
  expect(paintedPixels(await exportPng(page))).toEqual(expected);
});

test('the layers panel is accessible', async ({ page }) => {
  await page.getByRole('button', { name: 'New layer' }).click();
  const { default: AxeBuilder } = await import('@axe-core/playwright');
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});
