// Regenerates the screenshots and the header GIF used by the README, by driving the production
// build like a person would. Usage: pnpm build && pnpm --filter @vidopix/web preview & pnpm media
import { mkdirSync, copyFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';

const { chromium } = createRequire(new URL('../apps/web/', import.meta.url))('@playwright/test');

const URL_ = 'http://localhost:4173/';
const OUT = new URL('../docs/media/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1280, height: 800 },
  locale: 'en-US',
  acceptDownloads: true,
});
const page = await context.newPage();
await page.goto(URL_);
const surface = page.getByRole('application');
await surface.waitFor();

async function geometry() {
  const box = await surface.boundingBox();
  const status = await page.getByRole('contentinfo').innerText();
  const zoom = Number(/(\d+)%/.exec(status)?.[1]) / 100;
  const [, w, h] = /(\d+)×(\d+) px/.exec(status) ?? [];
  const panX = Math.round((box.width - Number(w) * zoom) / 2);
  const panY = Math.round((box.height - Number(h) * zoom) / 2);
  return (x, y) => ({ x: box.x + panX + (x + 0.5) * zoom, y: box.y + panY + (y + 0.5) * zoom });
}
const at = await geometry();
const color = async (hex) => {
  const field = page.getByLabel('Hex');
  await field.fill(hex);
  await field.press('Enter');
};
const click = async (x, y) => {
  const p = at(x, y);
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  await page.mouse.up();
};
const drag = async (x0, y0, x1, y1) => {
  const a = at(x0, y0);
  const b = at(x1, y1);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(b.x, b.y, { steps: 6 });
  await page.mouse.up();
};
const shot = (name) => page.screenshot({ path: join(OUT, `${name}.png`) });

// A slime that squashes and stretches, drawn with the ellipse and fill tools, one frame each.
const poses = [
  { box: [8, 9, 23, 26], eyes: [13, 16, 18, 16] },
  { box: [6, 13, 25, 26], eyes: [11, 19, 20, 19] },
  { box: [9, 6, 22, 26], eyes: [14, 13, 17, 13] },
  { box: [7, 11, 24, 26], eyes: [12, 17, 19, 17] },
  { box: [6, 13, 25, 26], eyes: [11, 19, 20, 19] },
];
for (const [index, pose] of poses.entries()) {
  if (index > 0) await page.getByRole('button', { name: 'New frame' }).click();
  const [x0, y0, x1, y1] = pose.box;
  await page.keyboard.press('o');
  await color('#2D7A3A');
  await drag(x0, y0, x1, y1);
  await page.keyboard.press('g');
  await color('#3FA34D');
  await click(Math.round((x0 + x1) / 2), y1 - 3);
  await page.keyboard.press('b');
  await color('#8FE388');
  await click(x0 + 3, y0 + 3);
  await click(x0 + 4, y0 + 3);
  await click(x0 + 3, y0 + 4);
  const [ax, ay, bx, by] = pose.eyes;
  await color('#FFFFFF');
  for (const [ex, ey] of [
    [ax, ay],
    [bx, by],
  ]) {
    await click(ex, ey);
    await click(ex + 1, ey);
    await click(ex, ey + 1);
  }
  await color('#101820');
  await click(ax + 1, ay + 1);
  await click(bx + 1, by + 1);
}
await page.getByLabel('FPS').fill('8');
await page.getByLabel('FPS').press('Enter');
await page.getByRole('list', { name: 'Frames' }).getByRole('button').nth(2).click();
await page.getByRole('button', { name: 'Show the previous frame' }).click();
await page.getByRole('button', { name: 'Show the next frame' }).click();
await shot('animation');

await page.getByRole('button', { name: 'Show the previous frame' }).click();
await page.getByRole('button', { name: 'Show the next frame' }).click();
await page.getByRole('list', { name: 'Frames' }).getByRole('button').nth(1).click();
await page.getByRole('button', { name: 'New layer' }).click();
await color('#FF4D6D');
await click(15, 22);
await click(16, 22);
await shot('editor');

await page.getByRole('tab', { name: 'Palette' }).click();
await page
  .getByRole('combobox', { name: 'Load a preset palette' })
  .selectOption({ label: 'PICO-8 (16)' });
await shot('palette');
await page.getByRole('tab', { name: 'Generate' }).click();
await shot('generate');
await page.getByRole('tab', { name: 'Color' }).click();

// The header GIF is the app's own export of the animation.
await page.keyboard.press('ControlOrMeta+e');
const dialog = page.getByRole('dialog', { name: 'Export' });
await dialog.getByLabel('Format').selectOption({ label: 'Animated GIF' });
await dialog.getByLabel('Scale').fill('8');
await dialog.getByLabel('Transparent background').uncheck();
await shot('export');
const download = page.waitForEvent('download');
await dialog.getByRole('button', { name: 'Export' }).click();
copyFileSync(await (await download).path(), join(OUT, 'header.gif'));
await dialog.waitFor({ state: 'hidden' });

// Saved work and the Spanish interface (Phase 4).
await page.getByRole('menuitem', { name: 'Help' }).click();
await page.getByRole('menuitemradio', { name: /Español/ }).click();
// Autosave writes shortly after the last change; give it time so the list has the project.
await page.waitForTimeout(2500);
await page.getByRole('menuitem', { name: 'Archivo' }).click();
await page.getByRole('menuitem', { name: /Abrir reciente/ }).click();
await page.getByRole('dialog').getByRole('listitem').first().waitFor();
await shot('recent-es');

await browser.close();
console.warn(`Wrote the media to ${OUT}`);
