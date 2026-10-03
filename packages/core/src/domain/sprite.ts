import { err, ok, type Result } from '../result.js';
import type { IdGenerator } from '../ports/id-generator.js';
import { createPalette, type Palette } from './palette.js';
import { MAX_CANVAS_SIZE, PixelBuffer } from './pixel-buffer.js';

export type BlendMode = 'normal';

/** Shortest and longest time a frame may be shown, in milliseconds. */
export const MIN_FRAME_DURATION = 20;
export const MAX_FRAME_DURATION = 10_000;
export const DEFAULT_FRAME_DURATION = 100;
export const MAX_FRAMES = 128;

export interface Frame {
  readonly id: string;
  /** How long the frame is shown during playback, in milliseconds. */
  readonly duration: number;
}

export interface Layer {
  readonly id: string;
  readonly name: string;
  readonly visible: boolean;
  readonly locked: boolean;
  /** From 0 (transparent) to 1 (opaque). */
  readonly opacity: number;
  readonly blendMode: BlendMode;
  /** The layer's pixels in the active frame. Always the same object as `cels[activeFrame]`. */
  readonly buffer: PixelBuffer;
  /** The layer's pixels in every frame, in frame order. */
  readonly cels: readonly PixelBuffer[];
}

export interface Sprite {
  readonly id: string;
  readonly name: string;
  readonly width: number;
  readonly height: number;
  readonly layers: readonly Layer[];
  readonly palette: Palette;
  /** The animation. A sprite always has at least one frame. */
  readonly frames: readonly Frame[];
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
  const buffer = PixelBuffer.create(width, height);
  const layer: Layer = {
    id: ids.next(),
    name: 'Layer 1',
    visible: true,
    locked: false,
    opacity: 1,
    blendMode: 'normal',
    buffer,
    cels: [buffer],
  };
  const palette = createPalette(ids.next());
  const frames: Frame[] = [{ id: ids.next(), duration: DEFAULT_FRAME_DURATION }];
  return ok({
    id,
    name: options.name ?? 'Untitled',
    width,
    height,
    layers: [layer],
    palette,
    frames,
  });
}
