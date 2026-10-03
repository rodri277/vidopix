import type { Color } from '../domain/color.js';
import type { PixelBuffer } from '../domain/pixel-buffer.js';
import { unionRects, type Rect } from '../domain/rect.js';
import { createPatch, type PixelPatch } from './pixel-patch.js';

/**
 * Writes pixels into a buffer while remembering what each one looked like before the first
 * edit, so a whole stroke can later become a single undoable patch.
 */
export class PatchRecorder {
  private readonly seen: Uint8Array;
  private touched: number[] = [];
  private previous: Color[] = [];
  private pendingDirty: Rect | null = null;

  constructor(private readonly buffer: PixelBuffer) {
    this.seen = new Uint8Array(buffer.width * buffer.height);
  }

  setPixel(x: number, y: number, color: Color): void {
    if (!this.buffer.contains(x, y)) return;
    const index = y * this.buffer.width + x;
    const current = this.buffer.data[index] ?? 0;
    if (current === color) return;
    if (this.seen[index] === 0) {
      this.seen[index] = 1;
      this.touched.push(index);
      this.previous.push(current);
    }
    this.buffer.data[index] = color;
    this.pendingDirty = unionRects(this.pendingDirty, { x, y, width: 1, height: 1 });
  }

  /** Area modified since the last call, for incremental redraws. */
  takeDirty(): Rect | null {
    const dirty = this.pendingDirty;
    this.pendingDirty = null;
    return dirty;
  }

  /** Closes the recording. Returns null if the net result is no change. */
  finish(): PixelPatch | null {
    const patch = createPatch(this.buffer, this.touched, this.previous);
    this.touched = [];
    this.previous = [];
    return patch;
  }
}
