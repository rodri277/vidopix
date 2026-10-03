import type { Color } from '../domain/color.js';
import type { PixelBuffer } from '../domain/pixel-buffer.js';
import type { Rect } from '../domain/rect.js';
import type { FillMode } from '../algorithms/flood-fill.js';
import type { PixelPatch } from '../history/pixel-patch.js';

export type ToolId = 'pencil' | 'eraser' | 'fill' | 'eyedropper' | 'line' | 'rectangle' | 'ellipse';

export const TOOL_IDS: readonly ToolId[] = [
  'pencil',
  'eraser',
  'fill',
  'eyedropper',
  'line',
  'rectangle',
  'ellipse',
];

export const MIN_BRUSH_SIZE = 1;
export const MAX_BRUSH_SIZE = 16;

export interface ToolOptions {
  /** Side of the square brush, from 1 to 16 pixels. */
  readonly brushSize: number;
  readonly fillMode: FillMode;
  /** Fill tolerance per channel, 0 to 255. */
  readonly tolerance: number;
  /** Rectangle and ellipse: filled or outline only. */
  readonly shapeFilled: boolean;
}

export const DEFAULT_TOOL_OPTIONS: ToolOptions = {
  brushSize: 1,
  fillMode: 'contiguous',
  tolerance: 0,
  shapeFilled: false,
};

export type ColorSlot = 'primary' | 'secondary';

/** A pointer position already converted to document pixels. */
export interface PointerInput {
  readonly x: number;
  readonly y: number;
  /** Primary paints with the primary color, secondary with the secondary one. */
  readonly button: ColorSlot;
  /** Constrains shapes to squares/circles and lines to 0, 45 or 90 degrees. */
  readonly shift: boolean;
}

/** Pixels a tool is about to draw, shown on the overlay until the stroke is confirmed. */
export interface Preview {
  /** Indices into the active layer buffer (y * width + x). */
  readonly pixels: readonly number[];
  readonly color: Color;
}

/** What a tool may see and do. Provided by the session. */
export interface ToolContext {
  readonly buffer: PixelBuffer;
  readonly options: ToolOptions;
  colorFor(slot: ColorSlot): Color;
  setColor(slot: ColorSlot, color: Color): void;
  /** Adds a finished edit to the history. Pass null if nothing changed. */
  commit(label: string, patch: PixelPatch | null): void;
  /** Tells the renderer that this area of the document changed. */
  markDirty(rect: Rect | null): void;
  setPreview(preview: Preview | null): void;
}

export interface Tool {
  readonly id: ToolId;
  pointerDown(context: ToolContext, input: PointerInput): void;
  pointerMove(context: ToolContext, input: PointerInput): void;
  pointerUp(context: ToolContext, input: PointerInput): void;
  /** Abandons the current stroke and restores the document to how it was before it. */
  cancel(context: ToolContext): void;
}
