import { expect, type Download, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';

export const SPRITE_SIZE = 32;

export interface Canvas {
  /** Screen position (page coordinates) of the center of a document pixel. */
  center(x: number, y: number): { x: number; y: number };
  zoom: number;
}

/** Locates the drawing surface and works out where each pixel is, from what the UI reports. */
export async function readCanvas(
  page: Page,
  spriteWidth = SPRITE_SIZE,
  spriteHeight = SPRITE_SIZE,
): Promise<Canvas> {
  const surface = page.getByRole('application');
  const box = await surface.boundingBox();
  if (!box) throw new Error('Canvas is not visible');
  const status = await page.getByRole('contentinfo').innerText();
  const match = /(\d+)%/.exec(status);
  if (!match?.[1]) throw new Error(`Zoom not found in status bar: ${status}`);
  const zoom = Number(match[1]) / 100;
  const panX = Math.round((box.width - spriteWidth * zoom) / 2);
  const panY = Math.round((box.height - spriteHeight * zoom) / 2);
  return {
    zoom,
    center: (x, y) => ({
      x: box.x + panX + (x + 0.5) * zoom,
      y: box.y + panY + (y + 0.5) * zoom,
    }),
  };
}

export async function clickPixel(
  page: Page,
  canvas: Canvas,
  x: number,
  y: number,
  button: 'left' | 'right' = 'left',
): Promise<void> {
  const point = canvas.center(x, y);
  await page.mouse.move(point.x, point.y);
  await page.mouse.down({ button });
  await page.mouse.up({ button });
}

export async function setPrimaryColor(page: Page, hex: string): Promise<void> {
  const field = page.getByLabel('Hex');
  await field.fill(hex);
  await field.press('Enter');
}

export interface DecodedImage {
  width: number;
  height: number;
  /** RGBA bytes. */
  data: number[];
}

/** Opens the export dialog, exports at the given scale and returns the decoded PNG. */
export async function exportPng(page: Page, scale = 1, transparent = true): Promise<DecodedImage> {
  await page.keyboard.press('ControlOrMeta+e');
  const dialog = page.getByRole('dialog', { name: 'Export' });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel('Scale').fill(String(scale));
  const checkbox = dialog.getByLabel('Transparent background');
  if ((await checkbox.isChecked()) !== transparent) await checkbox.click();
  const downloadPromise = page.waitForEvent('download');
  await dialog.getByRole('button', { name: 'Export' }).click();
  const download = await downloadPromise;
  await expect(dialog).toBeHidden();
  return decodeDownload(page, download);
}

async function decodeDownload(page: Page, download: Download): Promise<DecodedImage> {
  const path = await download.path();
  const base64 = (await readFile(path)).toString('base64');
  return page.evaluate(async (encoded) => {
    const bytes = Uint8Array.from(atob(encoded), (char) => char.charCodeAt(0));
    const bitmap = await createImageBitmap(new Blob([bytes], { type: 'image/png' }));
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const context = canvas.getContext('2d');
    if (!context) throw new Error('no 2d context');
    context.drawImage(bitmap, 0, 0);
    const image = context.getImageData(0, 0, bitmap.width, bitmap.height);
    return { width: bitmap.width, height: bitmap.height, data: Array.from(image.data) };
  }, base64);
}

export function pixelAt(
  image: DecodedImage,
  x: number,
  y: number,
): [number, number, number, number] {
  const index = (y * image.width + x) * 4;
  return [
    image.data[index] ?? -1,
    image.data[index + 1] ?? -1,
    image.data[index + 2] ?? -1,
    image.data[index + 3] ?? -1,
  ];
}

/** Set of "x,y" keys for every non-transparent pixel. */
export function paintedPixels(image: DecodedImage): Set<string> {
  const painted = new Set<string>();
  for (let y = 0; y < image.height; y++) {
    for (let x = 0; x < image.width; x++) {
      if (pixelAt(image, x, y)[3] !== 0) painted.add(`${String(x)},${String(y)}`);
    }
  }
  return painted;
}

/** Opens the export dialog and picks a format; returns the dialog. */
export async function openExport(
  page: Page,
  format: 'PNG image' | 'Animated GIF' | 'Spritesheet (PNG + JSON)',
) {
  await page.keyboard.press('ControlOrMeta+e');
  const dialog = page.getByRole('dialog', { name: 'Export' });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel('Format').selectOption({ label: format });
  return dialog;
}

export interface DecodedGif {
  /** Loops forever when 0 or Infinity. */
  repetitionCount: number;
  width: number;
  height: number;
  frames: { durationMs: number; data: number[] }[];
}

/** Decodes a GIF with the browser's own decoder, as any viewer would. */
export async function decodeGif(page: Page, download: Download): Promise<DecodedGif> {
  const base64 = (await readFile(await download.path())).toString('base64');
  return page.evaluate(async (encoded) => {
    const bytes = Uint8Array.from(atob(encoded), (char) => char.charCodeAt(0));
    const decoder = new ImageDecoder({ data: bytes, type: 'image/gif' });
    await decoder.tracks.ready;
    await decoder.completed;
    const track = decoder.tracks.selectedTrack;
    if (!track) throw new Error('GIF has no track');
    const frames: { durationMs: number; data: number[] }[] = [];
    let width = 0;
    let height = 0;
    for (let index = 0; index < track.frameCount; index++) {
      const { image } = await decoder.decode({ frameIndex: index });
      width = image.displayWidth;
      height = image.displayHeight;
      const canvas = new OffscreenCanvas(width, height);
      const context = canvas.getContext('2d');
      if (!context) throw new Error('no 2d context');
      context.drawImage(image, 0, 0);
      frames.push({
        durationMs: (image.duration ?? 0) / 1000,
        data: Array.from(context.getImageData(0, 0, width, height).data),
      });
      image.close();
    }
    return { repetitionCount: track.repetitionCount, width, height, frames };
  }, base64);
}

/** The colour of the document canvas under the middle of a sprite pixel, as the user sees it. */
export async function screenPixel(
  page: Page,
  canvas: Canvas,
  x: number,
  y: number,
): Promise<[number, number, number, number]> {
  const point = canvas.center(x, y);
  return page.evaluate(
    ({ px, py }) => {
      const surface = document.querySelector('[role="application"]');
      const element = surface?.querySelector('canvas');
      if (!surface || !element) throw new Error('no canvas');
      const box = surface.getBoundingClientRect();
      const context = element.getContext('2d');
      if (!context) throw new Error('no 2d context');
      const ratio = element.width / box.width;
      const data = context.getImageData(
        Math.round((px - box.left) * ratio),
        Math.round((py - box.top) * ratio),
        1,
        1,
      ).data;
      return [data[0] ?? 0, data[1] ?? 0, data[2] ?? 0, data[3] ?? 0] as [
        number,
        number,
        number,
        number,
      ];
    },
    { px: point.x, py: point.y },
  );
}
