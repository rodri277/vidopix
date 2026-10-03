import type { Color } from '../domain/color.js';
import type { PixelBuffer } from '../domain/pixel-buffer.js';

export type FillMode = 'contiguous' | 'global';

export interface FillOptions {
  readonly mode: FillMode;
  /** Largest allowed difference, per channel (0 to 255), from the clicked color. */
  readonly tolerance: number;
}

/** Called once per horizontal run of pixels to paint: row `y`, from `xStart` to `xEnd` inclusive. */
export type SpanFn = (y: number, xStart: number, xEnd: number) => void;

export function colorsWithinTolerance(a: Color, b: Color, tolerance: number): boolean {
  if (a === b) return true;
  if (tolerance <= 0) return false;
  return (
    Math.abs((a & 0xff) - (b & 0xff)) <= tolerance &&
    Math.abs(((a >>> 8) & 0xff) - ((b >>> 8) & 0xff)) <= tolerance &&
    Math.abs(((a >>> 16) & 0xff) - ((b >>> 16) & 0xff)) <= tolerance &&
    Math.abs(((a >>> 24) & 0xff) - ((b >>> 24) & 0xff)) <= tolerance
  );
}

/**
 * Iterative scanline flood fill: no recursion, so large canvases cannot overflow the stack.
 * The region is decided from the colors at the moment of the call and a visited map, so the
 * caller may paint inside `onSpan` while the fill is running.
 */
export function floodFillSpans(
  buffer: PixelBuffer,
  startX: number,
  startY: number,
  options: FillOptions,
  onSpan: SpanFn,
): void {
  if (!buffer.contains(startX, startY)) return;

  const { width, height, data } = buffer;
  const target = data[startY * width + startX] ?? 0;
  const matches = (index: number): boolean =>
    colorsWithinTolerance(data[index] ?? 0, target, options.tolerance);

  if (options.mode === 'global') {
    for (let y = 0; y < height; y++) {
      let runStart = -1;
      for (let x = 0; x < width; x++) {
        if (matches(y * width + x)) {
          if (runStart < 0) runStart = x;
        } else if (runStart >= 0) {
          onSpan(y, runStart, x - 1);
          runStart = -1;
        }
      }
      if (runStart >= 0) onSpan(y, runStart, width - 1);
    }
    return;
  }

  const visited = new Uint8Array(width * height);
  const stack: number[] = [startX, startY];

  const open = (x: number, y: number): boolean => {
    const index = y * width + x;
    return visited[index] === 0 && matches(index);
  };

  const queueRuns = (y: number, xStart: number, xEnd: number): void => {
    let inRun = false;
    for (let x = xStart; x <= xEnd; x++) {
      if (open(x, y)) {
        if (!inRun) {
          stack.push(x, y);
          inRun = true;
        }
      } else {
        inRun = false;
      }
    }
  };

  while (stack.length > 0) {
    const y = stack.pop() ?? 0;
    const x = stack.pop() ?? 0;
    if (!open(x, y)) continue;

    let left = x;
    while (left > 0 && open(left - 1, y)) left--;
    let right = x;
    while (right < width - 1 && open(right + 1, y)) right++;

    visited.fill(1, y * width + left, y * width + right + 1);
    onSpan(y, left, right);

    if (y > 0) queueRuns(y - 1, left, right);
    if (y < height - 1) queueRuns(y + 1, left, right);
  }
}
