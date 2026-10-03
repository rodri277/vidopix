import type { Color } from '../domain/color.js';
import type { PatchRecorder } from '../history/patch-recorder.js';
import type { ToolOptions } from './tool.js';

/** 4x4 ordered-dither thresholds, 0 to 15. A pixel is drawn when its threshold is below the density. */
export const BAYER_4X4: readonly number[] = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

/** Density 16 means solid (no dithering); lower values draw proportionally fewer pixels. */
export const MAX_DITHER = 16;

export function ditherAllows(x: number, y: number, density: number): boolean {
  if (density >= MAX_DITHER) return true;
  return (BAYER_4X4[(y & 3) * 4 + (x & 3)] ?? 0) < density;
}

/**
 * Turns one requested pixel into the pixels that are really drawn: its mirror images when
 * symmetry is on, minus the ones the dither pattern leaves out. Dithering is anchored to the
 * canvas, so strokes that overlap blend into one even pattern.
 */
export class Painter {
  constructor(
    private readonly recorder: PatchRecorder,
    private readonly options: ToolOptions,
    private readonly width: number,
    private readonly height: number,
  ) {}

  /** The pixels that painting (x, y) would change, without changing anything. */
  expand(x: number, y: number): [number, number][] {
    const xs = this.options.mirrorX && this.width - 1 - x !== x ? [x, this.width - 1 - x] : [x];
    const ys = this.options.mirrorY && this.height - 1 - y !== y ? [y, this.height - 1 - y] : [y];
    const points: [number, number][] = [];
    for (const px of xs) {
      for (const py of ys) {
        if (ditherAllows(px, py, this.options.dither)) points.push([px, py]);
      }
    }
    return points;
  }

  paint(x: number, y: number, color: Color): void {
    for (const [px, py] of this.expand(x, y)) this.recorder.setPixel(px, py, color);
  }

  /** Puts (x, y) and its mirror images back to the colors in `originals` (keyed by buffer index). */
  restore(x: number, y: number, originals: ReadonlyMap<number, Color>): void {
    for (const [px, py] of this.expand(x, y)) {
      const original = originals.get(py * this.width + px);
      if (original !== undefined) this.recorder.setPixel(px, py, original);
    }
  }
}
