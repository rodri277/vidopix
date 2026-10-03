import { floodFillSpans } from '../algorithms/flood-fill.js';
import { PatchRecorder } from '../history/patch-recorder.js';
import type { PointerInput, Tool, ToolContext } from './tool.js';

/** Paint bucket. Acts on pointer down and is a single history step. */
export class FillTool implements Tool {
  readonly id = 'fill';

  pointerDown(context: ToolContext, input: PointerInput): void {
    const color = context.colorFor(input.button);
    const recorder = new PatchRecorder(context.buffer);
    const { fillMode, tolerance } = context.options;
    floodFillSpans(context.buffer, input.x, input.y, { mode: fillMode, tolerance }, (y, x0, x1) => {
      for (let x = x0; x <= x1; x++) recorder.setPixel(x, y, color);
    });
    context.markDirty(recorder.takeDirty());
    context.commit('Fill', recorder.finish());
  }

  pointerMove(): void {
    // The fill happens on press only.
  }

  pointerUp(): void {
    // Nothing to finish: the press already committed the fill.
  }

  cancel(): void {
    // Nothing in progress to cancel.
  }
}
