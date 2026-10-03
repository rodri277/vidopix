import type { Color } from '../domain/color.js';
import { blendOnto, compositeSprite } from '../domain/compositing.js';
import { PixelBuffer } from '../domain/pixel-buffer.js';
import type { Sprite } from '../domain/sprite.js';
import { err, ok, type Result } from '../result.js';

export const MIN_EXPORT_SCALE = 1;
export const MAX_EXPORT_SCALE = 32;
/** Largest side browsers reliably allow for a canvas. */
export const MAX_EXPORT_DIMENSION = 16384;

export interface ExportOptions {
  /** Whole-number zoom, 1 to 32. */
  readonly scale: number;
  /** Color painted behind transparent pixels. Omit to keep transparency. */
  readonly background?: Color;
}

export type ExportError =
  | { readonly kind: 'invalid-scale'; readonly scale: number }
  | {
      readonly kind: 'too-large';
      readonly width: number;
      readonly height: number;
      readonly max: number;
    };

export interface ExportImage {
  readonly width: number;
  readonly height: number;
  /** Packed RGBA pixels, row-major. */
  readonly pixels: Uint32Array;
  /** The same memory as R, G, B, A bytes, ready for `new ImageData(...)`. */
  toBytes(): Uint8ClampedArray<ArrayBuffer>;
}

export function exportSprite(
  sprite: Sprite,
  options: ExportOptions,
): Result<ExportImage, ExportError> {
  const { scale } = options;
  if (!Number.isInteger(scale) || scale < MIN_EXPORT_SCALE || scale > MAX_EXPORT_SCALE) {
    return err({ kind: 'invalid-scale', scale });
  }
  const width = sprite.width * scale;
  const height = sprite.height * scale;
  if (width > MAX_EXPORT_DIMENSION || height > MAX_EXPORT_DIMENSION) {
    return err({ kind: 'too-large', width, height, max: MAX_EXPORT_DIMENSION });
  }

  const flat = compositeSprite(sprite);
  if (options.background !== undefined) blendUnder(flat, options.background);

  const pixels = new Uint32Array(width * height);
  for (let y = 0; y < height; y++) {
    const sourceRow = Math.floor(y / scale) * sprite.width;
    const targetRow = y * width;
    for (let x = 0; x < width; x++) {
      pixels[targetRow + x] = flat.data[sourceRow + Math.floor(x / scale)] ?? 0;
    }
  }

  return ok({
    width,
    height,
    pixels,
    toBytes: () => new Uint8ClampedArray(pixels.buffer),
  });
}

function blendUnder(buffer: PixelBuffer, background: Color): void {
  const backdrop = PixelBuffer.create(buffer.width, buffer.height);
  backdrop.fill(background);
  blendOnto(backdrop, buffer, 1);
  buffer.data.set(backdrop.data);
}
