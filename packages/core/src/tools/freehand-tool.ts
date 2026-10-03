import { traceLine } from '../algorithms/line.js';
import type { Color } from '../domain/color.js';
import { PatchRecorder } from '../history/patch-recorder.js';
import { revertPatch } from '../history/pixel-patch.js';
import { stampBrush } from './brush.js';
import { Painter } from './painter.js';
import type { PointerInput, Tool, ToolContext, ToolId } from './tool.js';

interface Point {
  readonly x: number;
  readonly y: number;
}

interface Stroke {
  readonly recorder: PatchRecorder;
  readonly painter: Painter;
  readonly color: Color;
  readonly perfect: boolean;
  /** What each touched pixel looked like before this stroke, so a corner can be taken back. */
  readonly originals: Map<number, Color>;
  /** The single-pixel path so far, used by pixel-perfect mode. */
  readonly path: Point[];
  lastX: number;
  lastY: number;
}

function brushSizeFor(context: ToolContext, input: PointerInput): number {
  const { brushSize, pressure } = context.options;
  if (!pressure || input.pressure === undefined) return brushSize;
  return Math.max(1, Math.ceil(input.pressure * brushSize));
}

const isDiagonalNeighbor = (a: Point, c: Point): boolean =>
  Math.abs(a.x - c.x) === 1 && Math.abs(a.y - c.y) === 1;

const isOrthogonalNeighbor = (a: Point, b: Point): boolean =>
  Math.abs(a.x - b.x) + Math.abs(a.y - b.y) === 1;

/** Pencil and eraser: a brush dragged along the pointer path, with no gaps between samples. */
export class FreehandTool implements Tool {
  private stroke: Stroke | null = null;

  constructor(
    readonly id: Extract<ToolId, 'pencil' | 'eraser'>,
    private readonly label: string,
  ) {}

  pointerDown(context: ToolContext, input: PointerInput): void {
    const color = this.id === 'eraser' ? 0 : context.colorFor(input.button);
    const recorder = new PatchRecorder(context.buffer, context.selection);
    this.stroke = {
      recorder,
      painter: new Painter(recorder, context.options, context.buffer.width, context.buffer.height),
      color,
      perfect: this.id === 'pencil' && context.options.pixelPerfect,
      originals: new Map(),
      path: [],
      lastX: input.x,
      lastY: input.y,
    };
    this.paint(
      context,
      this.stroke,
      brushSizeFor(context, input),
      input.x,
      input.y,
      input.x,
      input.y,
    );
  }

  pointerMove(context: ToolContext, input: PointerInput): void {
    const stroke = this.stroke;
    if (!stroke) return;
    this.paint(
      context,
      stroke,
      brushSizeFor(context, input),
      stroke.lastX,
      stroke.lastY,
      input.x,
      input.y,
    );
    stroke.lastX = input.x;
    stroke.lastY = input.y;
  }

  pointerUp(context: ToolContext, input: PointerInput): void {
    const stroke = this.stroke;
    if (!stroke) return;
    this.paint(
      context,
      stroke,
      brushSizeFor(context, input),
      stroke.lastX,
      stroke.lastY,
      input.x,
      input.y,
    );
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
    size: number,
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
  ): void {
    traceLine(fromX, fromY, toX, toY, (x, y) => {
      if (stroke.perfect && size === 1) this.paintPerfect(context, stroke, x, y);
      else
        stampBrush(x, y, size, (px, py) => {
          stroke.painter.paint(px, py, stroke.color);
        });
    });
    context.markDirty(stroke.recorder.takeDirty());
  }

  /**
   * One pixel wide, with the corner of every "L" taken out: when the path goes right then down
   * (or any such turn), the middle pixel is redundant and makes the line look doubled.
   */
  private paintPerfect(context: ToolContext, stroke: Stroke, x: number, y: number): void {
    const { path, painter, originals } = stroke;
    const last = path[path.length - 1];
    if (last?.x === x && last.y === y) return;

    for (const [px, py] of painter.expand(x, y)) {
      const index = py * context.buffer.width + px;
      if (!originals.has(index)) originals.set(index, context.buffer.get(px, py));
    }
    painter.paint(x, y, stroke.color);
    path.push({ x, y });

    const count = path.length;
    const a = path[count - 3];
    const b = path[count - 2];
    const c = path[count - 1];
    if (!a || !b || !c) return;
    if (!isDiagonalNeighbor(a, c) || !isOrthogonalNeighbor(a, b) || !isOrthogonalNeighbor(b, c))
      return;

    const visitedAgain = path.some((p, i) => i !== count - 2 && p.x === b.x && p.y === b.y);
    if (!visitedAgain) painter.restore(b.x, b.y, originals);
    path.splice(count - 2, 1);
  }
}
