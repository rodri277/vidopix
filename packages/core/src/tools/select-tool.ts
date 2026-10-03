import { rectFromCorners, type Rect } from '../domain/rect.js';
import { constrainSquare, type Point } from './constrain.js';
import type { PointerInput, Tool, ToolContext } from './tool.js';

interface Drag {
  readonly start: Point;
  readonly before: Rect | null;
  moved: boolean;
}

/** Rectangular selection. A plain click on the canvas clears it. */
export class SelectTool implements Tool {
  readonly id = 'select';
  private drag: Drag | null = null;

  pointerDown(context: ToolContext, input: PointerInput): void {
    this.drag = {
      start: this.clamp(context, input),
      before: context.editor.selection,
      moved: false,
    };
  }

  pointerMove(context: ToolContext, input: PointerInput): void {
    const drag = this.drag;
    if (!drag) return;
    const end = this.clamp(context, input);
    const target = input.shift ? this.clampPoint(context, constrainSquare(drag.start, end)) : end;
    if (!drag.moved && target.x === drag.start.x && target.y === drag.start.y) return;
    drag.moved = true;
    context.editor.previewSelection(
      rectFromCorners(drag.start.x, drag.start.y, target.x, target.y),
    );
  }

  pointerUp(context: ToolContext, input: PointerInput): void {
    const drag = this.drag;
    if (!drag) return;
    this.pointerMove(context, input);
    this.drag = null;
    if (!drag.moved) context.editor.previewSelection(null);
    context.editor.commitSelection(drag.before);
  }

  cancel(context: ToolContext): void {
    const drag = this.drag;
    if (!drag) return;
    this.drag = null;
    context.editor.previewSelection(drag.before);
  }

  private clamp(context: ToolContext, point: Point): Point {
    return this.clampPoint(context, point);
  }

  private clampPoint(context: ToolContext, point: Point): Point {
    const { width, height } = context.buffer;
    return {
      x: Math.min(width - 1, Math.max(0, point.x)),
      y: Math.min(height - 1, Math.max(0, point.y)),
    };
  }
}
