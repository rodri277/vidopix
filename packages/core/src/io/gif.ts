// gifenc ships no types; every project that reads this file needs to see ours.
// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="../types/gifenc.d.ts" />
import { GIFEncoder } from 'gifenc';
import type { Sprite } from '../domain/sprite.js';
import { ok, type Result } from '../result.js';
import { checkExportSize, exportFrame, type ExportError, type ExportOptions } from './export.js';
import { indexFrames } from './gif-palette.js';

export type GifOptions = ExportOptions;

export type GifProgress = (done: number, total: number) => void;

/**
 * Encodes the sprite as an animated GIF that loops forever. Each frame lasts as long as its
 * duration says. Pixels that are mostly transparent stay transparent (a GIF has no partial
 * transparency) unless a background color is given.
 */
export function encodeGif(
  sprite: Sprite,
  options: GifOptions,
  onProgress?: GifProgress,
): Result<Uint8Array, ExportError> {
  const size = checkExportSize(sprite, options.scale);
  if (!size.ok) return size;
  const { width, height } = size.value;
  // MAX_EXPORT_DIMENSION is below the 65535 pixels a GIF can hold, so the size check is enough.

  const total = sprite.frames.length;
  const images: Uint32Array[] = [];
  for (let index = 0; index < total; index++) {
    const image = exportFrame(sprite, index, options);
    if (!image.ok) return image;
    images.push(image.value.pixels);
    onProgress?.(index + 1, total * 2);
  }

  const indexed = indexFrames(images);
  const encoder = GIFEncoder();
  indexed.frames.forEach((pixels, index) => {
    encoder.writeFrame(pixels, width, height, {
      // The palette is global: only the first frame carries it.
      palette: index === 0 ? indexed.palette : undefined,
      delay: sprite.frames[index]?.duration ?? 100,
      transparent: indexed.transparentIndex !== null,
      transparentIndex: indexed.transparentIndex ?? 0,
      repeat: 0,
    });
    onProgress?.(total + index + 1, total * 2);
  });
  encoder.finish();
  return ok(encoder.bytes());
}
