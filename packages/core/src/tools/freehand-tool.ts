import { traceLine } from '../algorithms/line.js';
import { PatchRecorder } from '../history/patch-recorder.js';
import { revertPatch } from '../history/pixel-patch.js';
import { stampBrush } from './brush.js';
import type { PointerInput, Tool, ToolContext, ToolId } from './tool.js';

interface Stroke {
  readonly recorder: PatchRecorder;
  readonly color: number;
  lastX: number;
  lastY: number;
}

/** Pencil and eraser: a brush dragged along the pointer path, with no gaps between samples. */
export class FreehandTool implements Tool {
  private stroke: Stroke | null = null;

  constructor(
    readonly id: Extract<ToolId, 'pencil' | 'eraser'>,
    private readonly label: string,
  ) {}

  pointerDown(context: ToolContext, input: PointerInput): void {
    const color = this.id === 'eraser' ? 0 : context.colorFor(input.button);
    this.stroke = {
      recorder: new PatchRecorder(context.buffer, context.selection),
      color,
      lastX: input.x,
      lastY: input.y,
    };
    this.paint(context, this.stroke, input.x, input.y, input.x, input.y);
  }

  pointerMove(context: ToolContext, input: PointerInput): void {
    const stroke = this.stroke;
    if (!stroke) return;
    this.paint(context, stroke, stroke.lastX, stroke.lastY, input.x, input.y);
    stroke.lastX = input.x;
    stroke.lastY = input.y;
  }

  pointerUp(context: ToolContext, input: PointerInput): void {
    const stroke = this.stroke;
    if (!stroke) return;
    this.paint(context, stroke, stroke.lastX, stroke.lastY, input.x, input.y);
    this.stroke = null;
    context.commit(this.label, stroke.recorder.finish());
  }

  cancel(context: ToolContext): void {
    const stroke = this.stroke;
    if (!stroke) return;
    this.stroke = null;
    const patch = stroke.recorder.finish();
    if (patch) {
      context.markDirty(patch.bounds);
      // The partial stroke never reached the history, so put the pixels back directly.
      revertPatch(context.buffer, patch);
    }
  }

  private paint(
    context: ToolContext,
    stroke: Stroke,
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
  ): void {
    const size = context.options.brushSize;
    traceLine(fromX, fromY, toX, toY, (x, y) => {
      stampBrush(x, y, size, (px, py) => {
        stroke.recorder.setPixel(px, py, stroke.color);
      });
    });
    context.markDirty(stroke.recorder.takeDirty());
  }
}
