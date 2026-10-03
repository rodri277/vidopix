import type { Color } from '../domain/color.js';
import type { PixelBuffer } from '../domain/pixel-buffer.js';
import { rectContains, type Rect } from '../domain/rect.js';
import { createPatch, type PixelPatch } from './pixel-patch.js';

const INITIAL_CAPACITY = 256;

/**
 * Writes pixels into a buffer while remembering what each one looked like before the first
 * edit, so a whole stroke can later become a single undoable patch.
 *
 * Hot path: a flood fill calls `setPixel` once per pixel, so it allocates nothing per call.
 */
export class PatchRecorder {
  private readonly seen: Uint8Array;
  private touched = new Uint32Array(INITIAL_CAPACITY);
  private previous = new Uint32Array(INITIAL_CAPACITY);
  private count = 0;

  private dirtyMinX = Infinity;
  private dirtyMinY = Infinity;
  private dirtyMaxX = -1;
  private dirtyMaxY = -1;

  /** `clip` limits where pixels may change (the active selection); null means the whole buffer. */
  constructor(
    private readonly buffer: PixelBuffer,
    private readonly clip: Rect | null = null,
  ) {
    this.seen = new Uint8Array(buffer.width * buffer.height);
  }

  setPixel(x: number, y: number, color: Color): void {
    const { width, height, data } = this.buffer;
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    if (this.clip && !rectContains(this.clip, x, y)) return;
    const index = y * width + x;
    const current = data[index] ?? 0;
    if (current === color) return;
    if (this.seen[index] === 0) {
      this.seen[index] = 1;
      this.remember(index, current);
    }
    data[index] = color;
    if (x < this.dirtyMinX) this.dirtyMinX = x;
    if (x > this.dirtyMaxX) this.dirtyMaxX = x;
    if (y < this.dirtyMinY) this.dirtyMinY = y;
    if (y > this.dirtyMaxY) this.dirtyMaxY = y;
  }

  /** Area modified since the last call, for incremental redraws. */
  takeDirty(): Rect | null {
    if (this.dirtyMaxX < 0) return null;
    const rect: Rect = {
      x: this.dirtyMinX,
      y: this.dirtyMinY,
      width: this.dirtyMaxX - this.dirtyMinX + 1,
      height: this.dirtyMaxY - this.dirtyMinY + 1,
    };
    this.dirtyMinX = Infinity;
    this.dirtyMinY = Infinity;
    this.dirtyMaxX = -1;
    this.dirtyMaxY = -1;
    return rect;
  }

  /** Closes the recording. Returns null if the net result is no change. */
  finish(): PixelPatch | null {
    const patch = createPatch(
      this.buffer,
      this.touched.subarray(0, this.count),
      this.previous.subarray(0, this.count),
    );
    this.count = 0;
    return patch;
  }

  private remember(index: number, color: Color): void {
    if (this.count === this.touched.length) {
      const grownTouched = new Uint32Array(this.touched.length * 2);
      grownTouched.set(this.touched);
      this.touched = grownTouched;
      const grownPrevious = new Uint32Array(this.previous.length * 2);
      grownPrevious.set(this.previous);
      this.previous = grownPrevious;
    }
    this.touched[this.count] = index;
    this.previous[this.count] = color;
    this.count++;
  }
}
