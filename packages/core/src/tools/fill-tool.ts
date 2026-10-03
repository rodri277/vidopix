import { floodFillSpans } from '../algorithms/flood-fill.js';
import { PatchRecorder } from '../history/patch-recorder.js';
import { Painter } from './painter.js';
import type { PointerInput, Tool, ToolContext } from './tool.js';

/** Paint bucket. Acts on pointer down and is a single history step. */
export class FillTool implements Tool {
  readonly id = 'fill';

  pointerDown(context: ToolContext, input: PointerInput): void {
    const color = context.colorFor(input.button);
    const recorder = new PatchRecorder(context.buffer, context.selection);
    const { fillMode, tolerance } = context.options;
    // Symmetry would paint a mirror image over whatever is on the other side, so a fill ignores it.
    const painter = new Painter(
      recorder,
      { ...context.options, mirrorX: false, mirrorY: false },
      context.buffer.width,
      context.buffer.height,
    );
    floodFillSpans(
      context.buffer,
      input.x,
      input.y,
      { mode: fillMode, tolerance, bounds: context.selection },
      (y, x0, x1) => {
        for (let x = x0; x <= x1; x++) painter.paint(x, y, color);
      },
    );
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
