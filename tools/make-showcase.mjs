// Draws the showcase animation in the real editor (layers, frames, tools) and exports it with the
// editor's own GIF export. Usage: pnpm build && pnpm --filter @vidopix/web preview & pnpm showcase
import { copyFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';

const { chromium } = createRequire(new URL('../apps/web/', import.meta.url))('@playwright/test');
const OUT = new URL('../docs/media/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1280, height: 800 },
  locale: 'en-US',
  acceptDownloads: true,
  // A first visit opens a size dialog; these scripts start as someone who has seen it.
  storageState: {
    cookies: [],
    origins: [
      { origin: 'http://localhost:4173', localStorage: [{ name: 'vidopix.welcomed', value: '1' }] },
    ],
  },
});
const page = await context.newPage();
await page.goto('http://localhost:4173/');
const surface = page.getByRole('application');
await surface.waitFor();

// A 64x64 sprite.
await page.keyboard.press('ControlOrMeta+n');
const created = page.getByRole('dialog', { name: 'New sprite' });
await created.getByRole('button', { name: '64×64' }).click();
await created.getByRole('button', { name: 'Create' }).click();
await page.getByRole('contentinfo').getByText('64×64 px').waitFor();

const box = await surface.boundingBox();
const zoom = Number(/(\d+)%/.exec(await page.getByRole('contentinfo').innerText())?.[1]) / 100;
const panX = Math.round((box.width - 64 * zoom) / 2);
const panY = Math.round((box.height - 64 * zoom) / 2);
const at = (x, y) => ({ x: box.x + panX + (x + 0.5) * zoom, y: box.y + panY + (y + 0.5) * zoom });
const color = async (hex) => {
  const field = page.getByLabel('Hex');
  await field.fill(hex);
  await field.press('Enter');
};
const click = async (x, y) => {
  const p = at(x, y);
  await page.mouse.click(p.x, p.y);
};
const drag = async (x0, y0, x1, y1) => {
  const a = at(x0, y0);
  const b = at(x1, y1);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(b.x, b.y, { steps: 5 });
  await page.mouse.up();
};
const layerButton = (name) =>
  page
    .getByRole('list', { name: 'Layer list' })
    .getByRole('button', { name: new RegExp(`^${name}`) });
const rename = async (from, to) => {
  await layerButton(from).click();
  await layerButton(from).press('F2');
  const field = page.getByRole('textbox', { name: new RegExp(`Rename ${from}`) });
  await field.fill(to);
  await field.press('Enter');
};
const fillShapes = async () => {
  await page.getByRole('button', { name: 'Filled' }).click();
};

// ---- Layer 1: the sky, a moon and the ground ----
await rename('Layer 1', 'Sky');
await page.keyboard.press('u');
await fillShapes();
const bands = ['#0B1026', '#121940', '#1B2352', '#262C66', '#333778', '#46408A', '#5B4A99'];
for (const [index, band] of bands.entries()) {
  await color(band);
  await drag(0, index * 8, 63, index * 8 + 8);
}
await page.keyboard.press('o');
await color('#F4F1BB');
await drag(47, 4, 58, 15);
await color('#262C66');
await drag(50, 2, 61, 13);
await page.keyboard.press('u');
await color('#16213E');
await drag(0, 56, 63, 63);
await color('#2E4A62');
await drag(0, 56, 63, 56);

// ---- Layer 2: stars ----
await page.getByRole('button', { name: 'New layer' }).click();
await rename('Layer 2', 'Stars');
await page.keyboard.press('b');
const stars = [
  [5, 5],
  [14, 14],
  [26, 3],
  [9, 27],
  [37, 15],
  [60, 24],
  [3, 40],
  [31, 30],
  [54, 38],
];
await color('#9AA0D8');
for (const [x, y] of stars) await click(x, y);

// ---- Layer 3: the title in a pixel font ----
await page.getByRole('button', { name: 'New layer' }).click();
await rename('Layer 3', 'Title');
const font = {
  V: ['101', '101', '101', '101', '010'],
  I: ['111', '010', '010', '010', '111'],
  D: ['110', '101', '101', '101', '110'],
  O: ['010', '101', '101', '101', '010'],
  P: ['110', '101', '110', '100', '100'],
  X: ['101', '101', '010', '101', '101'],
};
// Every cell of the font is a 2x2 block so the letters read clearly at this size.
const write = async (text, x0, y0) => {
  for (const [index, letter] of [...text].entries()) {
    for (const [dy, row] of font[letter].entries()) {
      for (const [dx, cell] of [...row].entries()) {
        if (cell !== '1') continue;
        const x = x0 + index * 8 + dx * 2;
        const y = y0 + dy * 2;
        for (const [ox, oy] of [
          [0, 0],
          [1, 0],
          [0, 1],
          [1, 1],
        ])
          await click(x + ox, y + oy);
      }
    }
  }
};
await color('#FFE066');
await write('VIDOPIX', 5, 19);

// ---- Layer 4: the slime, one hop per frame ----
await page.getByRole('button', { name: 'New layer' }).click();
await rename('Layer 4', 'Slime');
const hops = [
  { lift: 0, width: 18, height: 8 },
  { lift: 3, width: 14, height: 12 },
  { lift: 9, width: 12, height: 15 },
  { lift: 13, width: 12, height: 14 },
  { lift: 12, width: 13, height: 13 },
  { lift: 7, width: 14, height: 12 },
  { lift: 2, width: 15, height: 11 },
  { lift: 0, width: 19, height: 7 },
];
const GROUND = 55;
const cx = 32;
const drawSlime = async ({ lift, width, height }) => {
  const bottom = GROUND - lift;
  const left = cx - Math.floor(width / 2);
  const top = bottom - height;
  // A shadow on the ground that shrinks while the slime is in the air.
  const shade = Math.max(4, 16 - lift);
  await page.keyboard.press('o');
  await color('#0A1428');
  await drag(cx - Math.floor(shade / 2), GROUND + 1, cx + Math.floor(shade / 2), GROUND + 3);
  await color('#2D7A3A');
  await drag(left, top, left + width, bottom);
  await page.keyboard.press('g');
  await color('#3FA34D');
  await click(cx, bottom - 2);
  await page.keyboard.press('b');
  await color('#8FE388');
  await click(left + 3, top + 2);
  await click(left + 4, top + 2);
  await click(left + 3, top + 3);
  const eyeY = top + Math.max(3, Math.round(height / 2) - 1);
  await color('#FFFFFF');
  for (const ex of [cx - 3, cx + 2]) {
    await click(ex, eyeY);
    await click(ex + 1, eyeY);
    await click(ex, eyeY + 1);
  }
  await color('#101820');
  await click(cx - 2, eyeY + 1);
  await click(cx + 3, eyeY + 1);
};
await drawSlime(hops[0]);

// ---- Frames 2 to 8: copy the previous frame, clear the slime and draw it again; twinkle a star ----
const twinkle = async (index, on) => {
  const [x, y] = stars[index];
  await page.keyboard.press('b');
  if (on) {
    await color('#FFFFFF');
    for (const [dx, dy] of [
      [0, 0],
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ])
      await click(x + dx, y + dy);
  } else {
    await page.keyboard.press('e');
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ])
      await click(x + dx, y + dy);
    await page.keyboard.press('b');
    await color('#9AA0D8');
    await click(x, y);
  }
};
await layerButton('Stars').click();
await twinkle(0, true);
for (let frame = 1; frame < hops.length; frame++) {
  await layerButton('Slime').click();
  await page.getByRole('button', { name: 'Duplicate frame' }).click();
  await page.keyboard.press('m');
  await drag(cx - 12, 30, cx + 12, 60);
  await page.keyboard.press('Delete');
  await drawSlime(hops[frame]);
  await layerButton('Stars').click();
  await twinkle(frame - 1, false);
  await twinkle(frame, true);
}
await page.getByLabel('FPS').fill('11');
await page.getByLabel('FPS').press('Enter');

// ---- Export with the editor's own GIF export ----
await page.keyboard.press('ControlOrMeta+e');
const dialog = page.getByRole('dialog', { name: 'Export' });
await dialog.getByLabel('Format').selectOption({ label: 'Animated GIF' });
await dialog.getByLabel('Scale').fill('6');
const download = page.waitForEvent('download');
await dialog.getByRole('button', { name: 'Export' }).click();
copyFileSync(await (await download).path(), join(OUT, 'showcase.gif'));
await dialog.waitFor({ state: 'hidden' });
await page.keyboard.press('ControlOrMeta+d');
await page.screenshot({ path: join(OUT, 'showcase-editor.png') });

await browser.close();
console.warn(`Wrote ${join(OUT, 'showcase.gif')}`);
