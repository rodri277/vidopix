import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { packRgba } from '../domain/color.js';
import { createPalette } from '../domain/palette.js';
import { PixelBuffer } from '../domain/pixel-buffer.js';
import type { Sprite } from '../domain/sprite.js';
import { exportFrame, MAX_EXPORT_DIMENSION } from './export.js';
import { buildSpritesheet, sheetGrid } from './spritesheet.js';

const RED = packRgba(255, 0, 0, 255);

/** A sprite whose frame `i` has a single pixel at (i % width, 0) so frames are all different. */
function animated(width: number, height: number, frames: number, durations?: number[]): Sprite {
  const cels = Array.from({ length: frames }, (_, index) => {
    const cel = PixelBuffer.create(width, height);
    cel.set(index % width, index % height, packRgba(index * 3, 255 - index, 40, 255));
    return cel;
  });
  const [first] = cels;
  if (!first) throw new Error('frames');
  return {
    id: 's',
    name: 'Anim',
    width,
    height,
    layers: [
      {
        id: 'l',
        name: 'L',
        visible: true,
        locked: false,
        opacity: 1,
        blendMode: 'normal',
        buffer: first,
        cels,
      },
    ],
    frames: cels.map((_, index) => ({
      id: `f${String(index)}`,
      duration: durations?.[index] ?? 100,
    })),
    palette: createPalette('p'),
  };
}

describe('sheetGrid', () => {
  it('uses at most the frames there are and as many rows as needed', () => {
    expect(sheetGrid(32, 8)).toEqual({ columns: 8, rows: 4 });
    expect(sheetGrid(3, 8)).toEqual({ columns: 3, rows: 1 });
    expect(sheetGrid(9, 4)).toEqual({ columns: 4, rows: 3 });
    expect(sheetGrid(1, 1)).toEqual({ columns: 1, rows: 1 });
  });
});

describe('buildSpritesheet', () => {
  it('puts every frame where the JSON says it is', () => {
    const sprite = animated(
      5,
      4,
      11,
      Array.from({ length: 11 }, (_, i) => 20 + i * 10),
    );
    const sheet = buildSpritesheet(sprite, { scale: 1, columns: 4, imageName: 'anim.png' });
    expect(sheet.ok).toBe(true);
    if (!sheet.ok) return;
    const { image, data } = sheet.value;
    expect([image.width, image.height]).toEqual([20, 12]);
    expect(data.meta).toEqual({
      image: 'anim.png',
      size: { w: 20, h: 12 },
      frameCount: 11,
      scale: 1,
    });
    expect(data.frames).toHaveLength(11);
    data.frames.forEach((entry, index) => {
      const frame = exportFrame(sprite, index, { scale: 1 });
      if (!frame.ok) throw new Error('frame');
      expect(entry.duration).toBe(20 + index * 10);
      expect([entry.w, entry.h]).toEqual([5, 4]);
      for (let y = 0; y < entry.h; y++) {
        for (let x = 0; x < entry.w; x++) {
          expect(image.pixels[(entry.y + y) * image.width + entry.x + x]).toBe(
            frame.value.pixels[y * entry.w + x],
          );
        }
      }
    });
  });

  it('never overlaps frames and keeps them inside the image, for any grid', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 6 }),
        fc.integer({ min: 1, max: 6 }),
        fc.integer({ min: 1, max: 20 }),
        fc.integer({ min: 1, max: 12 }),
        fc.integer({ min: 1, max: 3 }),
        (width, height, frames, columns, scale) => {
          const sheet = buildSpritesheet(animated(width, height, frames), {
            scale,
            columns,
            imageName: 'a.png',
          });
          expect(sheet.ok).toBe(true);
          if (!sheet.ok) return;
          const { image, data } = sheet.value;
          const taken = new Set<string>();
          for (const entry of data.frames) {
            expect(entry.x + entry.w).toBeLessThanOrEqual(image.width);
            expect(entry.y + entry.h).toBeLessThanOrEqual(image.height);
            for (let y = entry.y; y < entry.y + entry.h; y++) {
              for (let x = entry.x; x < entry.x + entry.w; x++) {
                const key = `${String(x)},${String(y)}`;
                expect(taken.has(key)).toBe(false);
                taken.add(key);
              }
            }
          }
          expect(image.width).toBe(Math.min(columns, frames) * width * scale);
        },
      ),
    );
  });

  it('gives the sheet as bytes ready for a canvas', () => {
    const sheet = buildSpritesheet(animated(2, 2, 2), { scale: 1, columns: 2, imageName: 'a' });
    expect(sheet.ok && sheet.value.image.toBytes()).toHaveLength(4 * 2 * 4);
  });

  it('scales every frame by whole numbers', () => {
    const sprite = animated(2, 2, 2);
    const sheet = buildSpritesheet(sprite, { scale: 3, columns: 2, imageName: 'a.png' });
    expect(sheet.ok && sheet.value.data.frames[1]).toMatchObject({ x: 6, y: 0, w: 6, h: 6 });
    expect(sheet.ok && sheet.value.data.meta.scale).toBe(3);
  });

  it('paints a background behind transparent pixels in every frame', () => {
    const sheet = buildSpritesheet(animated(2, 1, 2), {
      scale: 1,
      columns: 2,
      imageName: 'a.png',
      background: RED,
    });
    expect(sheet.ok && sheet.value.image.pixels[1]).toBe(RED);
    expect(sheet.ok && sheet.value.image.pixels[2]).toBe(RED);
  });

  it('fails clearly for bad columns, bad scales and sheets that are too large', () => {
    const sprite = animated(4, 4, 3);
    expect(buildSpritesheet(sprite, { scale: 1, columns: 0, imageName: 'a' })).toMatchObject({
      ok: false,
      error: { kind: 'invalid-columns' },
    });
    expect(buildSpritesheet(sprite, { scale: 1, columns: 1.5, imageName: 'a' })).toMatchObject({
      ok: false,
      error: { kind: 'invalid-columns' },
    });
    expect(buildSpritesheet(sprite, { scale: 0, columns: 2, imageName: 'a' })).toMatchObject({
      ok: false,
      error: { kind: 'invalid-scale' },
    });
    const wide = buildSpritesheet(animated(1024, 2, 20), {
      scale: 16,
      columns: 20,
      imageName: 'a',
    });
    expect(wide).toMatchObject({ ok: false, error: { kind: 'too-large' } });
    expect(MAX_EXPORT_DIMENSION).toBe(16384);
  });
});
