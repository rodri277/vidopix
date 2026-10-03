import type { Color } from '../domain/color.js';
import type { PixelBuffer } from '../domain/pixel-buffer.js';
import { intersectRects, rectContains, type Rect } from '../domain/rect.js';

export type FillMode = 'contiguous' | 'global';

export interface FillOptions {
  readonly mode: FillMode;
  /** Largest allowed difference, per channel (0 to 255), from the clicked color. */
  readonly tolerance: number;
  /** Pixels outside this rectangle are treated as walls. Omit to use the whole buffer. */
  readonly bounds?: Rect | null;
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
  const { width, height, data } = buffer;
  const area = intersectRects(
    { x: 0, y: 0, width, height },
    options.bounds ?? { x: 0, y: 0, width, height },
  );
  if (!area || !rectContains(area, startX, startY)) return;
  const target = data[startY * width + startX] ?? 0;
  const matches = (index: number): boolean =>
    colorsWithinTolerance(data[index] ?? 0, target, options.tolerance);

  if (options.mode === 'global') {
    for (let y = area.y; y < area.y + area.height; y++) {
      let runStart = -1;
      for (let x = area.x; x < area.x + area.width; x++) {
        if (matches(y * width + x)) {
          if (runStart < 0) runStart = x;
        } else if (runStart >= 0) {
          onSpan(y, runStart, x - 1);
          runStart = -1;
        }
      }
      if (runStart >= 0) onSpan(y, runStart, area.x + area.width - 1);
    }
    return;
  }

  const visited = new Uint8Array(width * height);
  const stack: number[] = [startX, startY];

  // Plain numbers rather than a rectangle object: this check runs for every pixel.
  const minX = area.x;
  const minY = area.y;
  const maxX = area.x + area.width;
  const maxY = area.y + area.height;
  const open = (x: number, y: number): boolean => {
    if (x < minX || y < minY || x >= maxX || y >= maxY) return false;
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
    while (open(left - 1, y)) left--;
    let right = x;
    while (open(right + 1, y)) right++;

    visited.fill(1, y * width + left, y * width + right + 1);
    onSpan(y, left, right);

    queueRuns(y - 1, left, right);
    queueRuns(y + 1, left, right);
  }
}
