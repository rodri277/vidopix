import type { PixelBuffer } from '../domain/pixel-buffer.js';
import type { Rect } from '../domain/rect.js';
import { applyPatch, patchSizeBytes, revertPatch, type PixelPatch } from './pixel-patch.js';

/** One undoable operation. `apply` and `revert` return the area that changed, if any. */
export interface Command {
  readonly label: string;
  readonly sizeBytes: number;
  apply(): Rect | null;
  revert(): Rect | null;
}

export class PixelPatchCommand implements Command {
  readonly sizeBytes: number;

  constructor(
    readonly label: string,
    private readonly buffer: PixelBuffer,
    private readonly patch: PixelPatch,
  ) {
    this.sizeBytes = patchSizeBytes(patch);
  }

  apply(): Rect {
    applyPatch(this.buffer, this.patch);
    return this.patch.bounds;
  }

  revert(): Rect {
    revertPatch(this.buffer, this.patch);
    return this.patch.bounds;
  }
}
