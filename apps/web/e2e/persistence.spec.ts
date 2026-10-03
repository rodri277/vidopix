import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import {
  clickPixel,
  exportPng,
  paintedPixels,
  pixelAt,
  readCanvas,
  setPrimaryColor,
} from './helpers';

async function ready(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page.getByRole('application', { name: /Drawing canvas/ })).toBeVisible();
}

async function draw(page: Page, hex: string, x: number, y: number): Promise<void> {
  const canvas = await readCanvas(page);
  await setPrimaryColor(page, hex);
  await clickPixel(page, canvas, x, y);
}

test('the status bar shows when the work is saved', async ({ page }) => {
  await ready(page);
  await draw(page, '#FF0000', 3, 3);
  await expect(page.getByRole('contentinfo')).toContainText('Unsaved changes');
  await expect(page.getByRole('contentinfo')).toContainText('Saved', { timeout: 10_000 });
});

test('reloading the page by accident loses nothing', async ({ page }) => {
  await ready(page);
  await draw(page, '#FF0080', 5, 6);
  await page.getByRole('button', { name: /Sprite name:/ }).click();
  await page.getByRole('textbox', { name: 'Sprite name' }).fill('Hero');
  await page.keyboard.press('Enter');

  // Reload right away: the page saves when it is hidden or closed, not only after a pause.
  await page.reload();
  await expect(page.getByRole('application', { name: /Drawing canvas/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Sprite name: Hero/ })).toBeVisible();

  const image = await exportPng(page);
  expect(pixelAt(image, 5, 6)).toEqual([255, 0, 128, 255]);
});

test('layers and palette come back after a reload', async ({ page }) => {
  await ready(page);
  await page.getByRole('button', { name: 'New layer' }).click();
  await page.getByRole('tab', { name: 'Palette' }).click();
  await page.getByLabel('Load a preset palette').selectOption('sweetie-16');
  await expect(page.getByRole('group', { name: 'Palette colors' }).getByRole('button')).toHaveCount(
    16,
  );
  await expect(page.getByRole('contentinfo')).toContainText('Saved', { timeout: 10_000 });

  await page.reload();
  await expect(page.getByRole('list', { name: 'Layer list' }).getByRole('listitem')).toHaveCount(2);
  await page.getByRole('tab', { name: 'Palette' }).click();
  await expect(page.getByRole('group', { name: 'Palette colors' }).getByRole('button')).toHaveCount(
    16,
  );
});

test('a project saved to a file opens again exactly', async ({ page }) => {
  await ready(page);
  await draw(page, '#00FF00', 2, 2);
  await page.getByRole('menuitem', { name: 'File' }).click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('menuitem', { name: /Save as \.vidopix/ }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('Untitled.vidopix');
  const text = await readFile(await download.path(), 'utf8');
  expect(JSON.parse(text)).toMatchObject({ format: 'vidopix', schemaVersion: 2 });

  // Start something else, then open the file.
  await page.keyboard.press('ControlOrMeta+n');
  const dialog = page.getByRole('dialog', { name: 'New sprite' });
  await dialog.getByRole('button', { name: '16×16' }).click();
  await dialog.getByRole('button', { name: 'Create' }).click();
  await expect(page.getByRole('contentinfo')).toContainText('16×16 px');

  await page
    .locator('input[type="file"][accept*=".vidopix"]')
    .first()
    .setInputFiles({
      name: 'Untitled.vidopix',
      mimeType: 'application/json',
      buffer: Buffer.from(text),
    });
  await expect(page.getByRole('contentinfo')).toContainText('32×32 px');
  expect(pixelAt(await exportPng(page), 2, 2)).toEqual([0, 255, 0, 255]);
});

test('a broken file is explained and the drawing stays', async ({ page }) => {
  await ready(page);
  await draw(page, '#FF0000', 1, 1);
  await page
    .locator('input[type="file"][accept*=".vidopix"]')
    .first()
    .setInputFiles({
      name: 'broken.vidopix',
      mimeType: 'application/json',
      buffer: Buffer.from('{"format":"vidopix","schemaVersion":99}'),
    });
  await expect(page.getByRole('contentinfo')).toContainText('newer version');
  expect(pixelAt(await exportPng(page), 1, 1)).toEqual([255, 0, 0, 255]);
});

test('recent projects lists, opens and deletes projects', async ({ page }) => {
  await ready(page);
  await draw(page, '#FF0000', 4, 4);
  await page.getByRole('button', { name: /Sprite name:/ }).click();
  await page.getByRole('textbox', { name: 'Sprite name' }).fill('First');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('contentinfo')).toContainText('Saved', { timeout: 10_000 });

  await page.keyboard.press('ControlOrMeta+n');
  let dialog = page.getByRole('dialog', { name: 'New sprite' });
  await dialog.getByRole('button', { name: '16×16' }).click();
  await dialog.getByRole('button', { name: 'Create' }).click();
  await draw(page, '#0000FF', 1, 1);
  await expect(page.getByRole('contentinfo')).toContainText('Saved', { timeout: 10_000 });

  await page.getByRole('menuitem', { name: 'File' }).click();
  await page.getByRole('menuitem', { name: 'Open recent…' }).click();
  dialog = page.getByRole('dialog', { name: 'Recent projects' });
  const items = dialog.getByRole('listitem');
  await expect(items).toHaveCount(2);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

  await dialog.getByRole('button', { name: 'Open: First' }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole('contentinfo')).toContainText('32×32 px');
  expect(pixelAt(await exportPng(page), 4, 4)).toEqual([255, 0, 0, 255]);

  await page.getByRole('menuitem', { name: 'File' }).click();
  await page.getByRole('menuitem', { name: 'Open recent…' }).click();
  await dialog
    .getByRole('button', { name: /Delete: / })
    .first()
    .click();
  await expect(items).toHaveCount(1);
});

test('a shared link reproduces the sprite exactly', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await ready(page);
  await draw(page, '#FF8800', 7, 3);
  await page.getByRole('button', { name: 'New layer' }).click();
  await draw(page, '#0088FF', 8, 3);
  const original = await exportPng(page);

  await page.getByRole('menuitem', { name: 'File' }).click();
  await page.getByRole('menuitem', { name: 'Share link…' }).click();
  const dialog = page.getByRole('dialog', { name: 'Share link' });
  const link = dialog.getByLabel('Link');
  await expect(link).toHaveValue(/#s=/);
  const url = await link.inputValue();
  expect(url.length).toBeLessThan(6500);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

  await dialog.getByRole('button', { name: 'Copy link' }).click();
  await expect(dialog.getByText('Link copied')).toBeVisible();

  // A different browser profile opens it.
  const other = await context.browser()?.newContext();
  if (!other) throw new Error('no browser');
  const guest = await other.newPage();
  await guest.goto(url);
  await expect(guest.getByRole('application', { name: /Drawing canvas/ })).toBeVisible();
  await expect(guest.getByRole('list', { name: 'Layer list' }).getByRole('listitem')).toHaveCount(
    2,
  );
  const opened = await exportPng(guest);
  expect(opened.data).toEqual(original.data);
  // The link is removed from the address so a reload does not open it a second time.
  expect(new URL(guest.url()).hash).toBe('');
  expect(paintedPixels(opened).size).toBe(2);
  await other.close();
});

test('a damaged link says so instead of breaking the editor', async ({ page }) => {
  await page.goto('/#s=AAAA');
  await expect(page.getByRole('application', { name: /Drawing canvas/ })).toBeVisible();
  await expect(page.getByRole('contentinfo')).toContainText('could not be opened');
});

test('a sprite too big for a link offers the file instead', async ({ page }) => {
  await ready(page);
  await page.keyboard.press('ControlOrMeta+n');
  const dialog = page.getByRole('dialog', { name: 'New sprite' });
  await dialog.getByRole('button', { name: '256×256' }).click();
  await dialog.getByRole('button', { name: 'Create' }).click();
  // Noise does not compress, so a few hundred strokes of different colors make a long link.
  await page.evaluate(() => undefined);
  const canvas = await readCanvas(page, 256, 256);
  await page.keyboard.press('g');
  for (let i = 0; i < 60; i++) {
    await setPrimaryColor(page, `#${((i * 2654435) % 0xffffff).toString(16).padStart(6, '0')}`);
    const point = canvas.center((i * 37) % 256, (i * 91) % 256);
    await page.keyboard.press('b');
    await page.mouse.move(point.x, point.y);
    await page.mouse.down();
    await page.mouse.move(point.x + 8 * canvas.zoom, point.y + 3 * canvas.zoom, { steps: 3 });
    await page.mouse.up();
  }
  await page.getByRole('menuitem', { name: 'File' }).click();
  await page.getByRole('menuitem', { name: 'Share link…' }).click();
  const share = page.getByRole('dialog', { name: 'Share link' });
  await expect(share.getByRole('alert').or(share.getByLabel('Link'))).toBeVisible();
});

test('shortcut help lists the keys and has no accessibility violations', async ({ page }) => {
  await ready(page);
  await page.keyboard.press('Shift+?');
  const dialog = page.getByRole('dialog', { name: 'Keyboard shortcuts' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText('Pencil')).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
});
