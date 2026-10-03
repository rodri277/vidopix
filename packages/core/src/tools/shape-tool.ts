import { traceLine } from '../algorithms/line.js';
import { traceEllipse, traceRect } from '../algorithms/shapes.js';
import { rectContains } from '../domain/rect.js';
import { PatchRecorder } from '../history/patch-recorder.js';
import { stampBrush } from './brush.js';
import { constrainLine, constrainSquare, type Point } from './constrain.js';
import type { PointerInput, Tool, ToolContext, ToolId } from './tool.js';

type ShapeId = Extract<ToolId, 'line' | 'rectangle' | 'ellipse'>;

interface Drag {
  readonly start: Point;
  readonly color: number;
  end: Point;
}

/** Line, rectangle and ellipse: dragged out, previewed on the overlay, committed on release. */
export class ShapeTool implements Tool {
  private drag: Drag | null = null;

  constructor(
    readonly id: ShapeId,
    private readonly label: string,
  ) {}

  pointerDown(context: ToolContext, input: PointerInput): void {
    const start = { x: input.x, y: input.y };
    this.drag = { start, end: start, color: context.colorFor(input.button) };
    this.showPreview(context, this.drag);
  }

  pointerMove(context: ToolContext, input: PointerInput): void {
    const drag = this.drag;
    if (!drag) return;
    drag.end = this.resolveEnd(drag.start, input);
    this.showPreview(context, drag);
  }

  pointerUp(context: ToolContext, input: PointerInput): void {
    const drag = this.drag;
    if (!drag) return;
    drag.end = this.resolveEnd(drag.start, input);
    this.drag = null;
    context.setPreview(null);

    const recorder = new PatchRecorder(context.buffer, context.selection);
    this.trace(context, drag, (x, y) => {
      recorder.setPixel(x, y, drag.color);
    });
    context.markDirty(recorder.takeDirty());
    context.commit(this.label, recorder.finish());
  }

  cancel(context: ToolContext): void {
    this.drag = null;
    context.setPreview(null);
  }

  private resolveEnd(start: Point, input: PointerInput): Point {
    const end = { x: input.x, y: input.y };
    if (!input.shift) return end;
    return this.id === 'line' ? constrainLine(start, end) : constrainSquare(start, end);
  }

  private showPreview(context: ToolContext, drag: Drag): void {
    const { width } = context.buffer;
    const { selection } = context;
    const pixels: number[] = [];
    this.trace(context, drag, (x, y) => {
      if (context.buffer.contains(x, y) && (!selection || rectContains(selection, x, y))) {
        pixels.push(y * width + x);
      }
    });
    context.setPreview({ pixels, color: drag.color });
  }

  private trace(context: ToolContext, drag: Drag, plot: (x: number, y: number) => void): void {
    const { start, end } = drag;
    const { brushSize, shapeFilled } = context.options;
    if (this.id === 'line') {
      traceLine(start.x, start.y, end.x, end.y, (x, y) => {
        stampBrush(x, y, brushSize, plot);
      });
    } else if (this.id === 'rectangle') {
      traceRect(start.x, start.y, end.x, end.y, shapeFilled, plot);
    } else {
      traceEllipse(start.x, start.y, end.x, end.y, shapeFilled, plot);
    }
  }
}
