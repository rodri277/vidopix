import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { packRgba } from '../domain/color.js';
import { PixelBuffer } from '../domain/pixel-buffer.js';
import type { Layer, Sprite } from '../domain/sprite.js';
import { exportSprite, MAX_EXPORT_DIMENSION } from './export.js';

const RED = packRgba(255, 0, 0, 255);
const BLUE = packRgba(0, 0, 255, 255);

function layer(buffer: PixelBuffer, overrides: Partial<Layer> = {}): Layer {
  return {
    id: 'l',
    name: 'Layer',
    visible: true,
    locked: false,
    opacity: 1,
    blendMode: 'normal',
    buffer,
    ...overrides,
  };
}

function spriteOf(width: number, height: number, ...layers: Layer[]): Sprite {
  return { id: 's', name: 'Test', width, height, layers };
}

describe('exportSprite', () => {
  it('scales by whole numbers so every source pixel becomes a block', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 6 }),
        fc.array(fc.constantFrom(0, RED, BLUE), { minLength: 12, maxLength: 12 }),
        (scale, cells) => {
          const buffer = PixelBuffer.create(4, 3);
          cells.forEach((color, index) => {
            buffer.data[index] = color;
          });
          const result = exportSprite(spriteOf(4, 3, layer(buffer)), { scale });
          expect(result.ok).toBe(true);
          if (!result.ok) return;
          const image = result.value;
          expect(image.width).toBe(4 * scale);
          expect(image.height).toBe(3 * scale);
          for (let y = 0; y < image.height; y++) {
            for (let x = 0; x < image.width; x++) {
              expect(image.pixels[y * image.width + x]).toBe(
                buffer.get(Math.floor(x / scale), Math.floor(y / scale)),
              );
            }
          }
        },
      ),
    );
  });

  it('keeps transparency by default', () => {
    const buffer = PixelBuffer.create(2, 1);
    buffer.set(0, 0, RED);
    const result = exportSprite(spriteOf(2, 1, layer(buffer)), { scale: 1 });
    expect(result.ok && result.value.pixels[1]).toBe(0);
  });

  it('paints the background behind transparent pixels when one is given', () => {
    const buffer = PixelBuffer.create(2, 1);
    buffer.set(0, 0, RED);
    const white = packRgba(255, 255, 255, 255);
    const result = exportSprite(spriteOf(2, 1, layer(buffer)), { scale: 1, background: white });
    expect(result.ok && [...result.value.pixels]).toEqual([RED, white]);
  });

  it('lays the pixels out as R, G, B, A bytes for ImageData', () => {
    const buffer = PixelBuffer.create(1, 1);
    buffer.set(0, 0, packRgba(1, 2, 3, 4));
    const result = exportSprite(spriteOf(1, 1, layer(buffer)), { scale: 1 });
    expect(result.ok && [...result.value.toBytes()]).toEqual([1, 2, 3, 4]);
  });

  it.each([0, -1, 1.5, 33, Number.NaN])('rejects scale %d', (scale) => {
    const buffer = PixelBuffer.create(1, 1);
    expect(exportSprite(spriteOf(1, 1, layer(buffer)), { scale })).toEqual({
      ok: false,
      error: { kind: 'invalid-scale', scale },
    });
  });

  it('refuses images larger than the browser can handle', () => {
    const buffer = PixelBuffer.create(1024, 1024);
    const result = exportSprite(spriteOf(1024, 1024, layer(buffer)), { scale: 32 });
    expect(result).toEqual({
      ok: false,
      error: {
        kind: 'too-large',
        width: 32768,
        height: 32768,
        max: MAX_EXPORT_DIMENSION,
      },
    });
  });
});
