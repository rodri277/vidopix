import { err, ok, type Result } from '../result.js';
import type { IdGenerator } from '../ports/id-generator.js';
import { createPalette, type Palette } from './palette.js';
import { MAX_CANVAS_SIZE, PixelBuffer } from './pixel-buffer.js';

export type BlendMode = 'normal';

export interface Layer {
  readonly id: string;
  readonly name: string;
  readonly visible: boolean;
  readonly locked: boolean;
  /** From 0 (transparent) to 1 (opaque). */
  readonly opacity: number;
  readonly blendMode: BlendMode;
  readonly buffer: PixelBuffer;
}

export interface Sprite {
  readonly id: string;
  readonly name: string;
  readonly width: number;
  readonly height: number;
  readonly layers: readonly Layer[];
  readonly palette: Palette;
}

export interface SpriteOptions {
  readonly width: number;
  readonly height: number;
  readonly name?: string;
}

export interface InvalidSizeError {
  readonly kind: 'invalid-size';
  readonly width: number;
  readonly height: number;
  readonly max: number;
}

const isValidDimension = (n: number): boolean =>
  Number.isInteger(n) && n >= 1 && n <= MAX_CANVAS_SIZE;

export function createSprite(
  options: SpriteOptions,
  ids: IdGenerator,
): Result<Sprite, InvalidSizeError> {
  const { width, height } = options;
  if (!isValidDimension(width) || !isValidDimension(height)) {
    return err({ kind: 'invalid-size', width, height, max: MAX_CANVAS_SIZE });
  }

  const id = ids.next();
  const layer: Layer = {
    id: ids.next(),
    name: 'Layer 1',
    visible: true,
    locked: false,
    opacity: 1,
    blendMode: 'normal',
    buffer: PixelBuffer.create(width, height),
  };
  const palette = createPalette(ids.next());
  return ok({
    id,
    name: options.name ?? 'Untitled',
    width,
    height,
    layers: [layer],
    palette,
  });
}
