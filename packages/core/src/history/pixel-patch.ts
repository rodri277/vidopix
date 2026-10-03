import type { Color } from '../domain/color.js';
import type { PixelBuffer } from '../domain/pixel-buffer.js';
import type { Rect } from '../domain/rect.js';

const BYTES_PER_PIXEL = 4;

/** Only the changed pixels: their positions plus the colors before and after. */
export interface SparsePatch {
  readonly kind: 'sparse';
  readonly bounds: Rect;
  readonly indices: Uint32Array;
  readonly before: Uint32Array;
  readonly after: Uint32Array;
}

/** The whole bounding box before and after. Cheaper when most of the box changed. */
export interface RectPatch {
  readonly kind: 'rect';
  readonly bounds: Rect;
  readonly before: Uint32Array;
  readonly after: Uint32Array;
}

export type PixelPatch = SparsePatch | RectPatch;

export function patchSizeBytes(patch: PixelPatch): number {
  const arrays = patch.kind === 'sparse' ? 3 : 2;
  const length = patch.kind === 'sparse' ? patch.indices.length : patch.before.length;
  return length * arrays * BYTES_PER_PIXEL;
}

/**
 * Builds a patch for edits that have already been written to `buffer`.
 * `touched[i]` is the buffer index of a modified pixel and `previous[i]` the color it had
 * before the first edit. Returns null if the net result is no change.
 */
export function createPatch(
  buffer: PixelBuffer,
  touched: ArrayLike<number>,
  previous: ArrayLike<Color>,
): PixelPatch | null {
  const { width, data } = buffer;
  const indices: number[] = [];
  const before: number[] = [];
  const after: number[] = [];
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -1;
  let maxY = -1;

  for (let i = 0; i < touched.length; i++) {
    const index = touched[i] ?? 0;
    const old = previous[i] ?? 0;
    const current = data[index] ?? 0;
    if (old === current) continue;
    indices.push(index);
    before.push(old);
    after.push(current);
    const x = index % width;
    const y = (index - x) / width;
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }

  if (indices.length === 0) return null;

  const bounds: Rect = { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
  const area = bounds.width * bounds.height;
  const sparseBytes = indices.length * 3 * BYTES_PER_PIXEL;
  const rectBytes = area * 2 * BYTES_PER_PIXEL;

  if (sparseBytes <= rectBytes) {
    return {
      kind: 'sparse',
      bounds,
      indices: Uint32Array.from(indices),
      before: Uint32Array.from(before),
      after: Uint32Array.from(after),
    };
  }

  const afterRect = new Uint32Array(area);
  for (let row = 0; row < bounds.height; row++) {
    const start = (bounds.y + row) * width + bounds.x;
    afterRect.set(data.subarray(start, start + bounds.width), row * bounds.width);
  }
  const beforeRect = afterRect.slice();
  for (let i = 0; i < indices.length; i++) {
    const index = indices[i] ?? 0;
    const x = (index % width) - bounds.x;
    const y = Math.floor(index / width) - bounds.y;
    beforeRect[y * bounds.width + x] = before[i] ?? 0;
  }
  return { kind: 'rect', bounds, before: beforeRect, after: afterRect };
}

function writeRect(buffer: PixelBuffer, bounds: Rect, pixels: Uint32Array): void {
  for (let row = 0; row < bounds.height; row++) {
    const start = (bounds.y + row) * buffer.width + bounds.x;
    buffer.data.set(pixels.subarray(row * bounds.width, (row + 1) * bounds.width), start);
  }
}

function writeSparse(buffer: PixelBuffer, indices: Uint32Array, pixels: Uint32Array): void {
  for (let i = 0; i < indices.length; i++) {
    buffer.data[indices[i] ?? 0] = pixels[i] ?? 0;
  }
}

export function applyPatch(buffer: PixelBuffer, patch: PixelPatch): void {
  if (patch.kind === 'sparse') writeSparse(buffer, patch.indices, patch.after);
  else writeRect(buffer, patch.bounds, patch.after);
}

export function revertPatch(buffer: PixelBuffer, patch: PixelPatch): void {
  if (patch.kind === 'sparse') writeSparse(buffer, patch.indices, patch.before);
  else writeRect(buffer, patch.bounds, patch.before);
}
