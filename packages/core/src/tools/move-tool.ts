import { rectContains } from '../domain/rect.js';
import type { PointerInput, Tool, ToolContext } from './tool.js';

interface Drag {
  readonly startX: number;
  readonly startY: number;
  readonly originX: number;
  readonly originY: number;
}

/**
 * Moves the selected pixels, or the whole layer when nothing is selected. The content stays
 * floating after the mouse is released so it can be adjusted; Enter or any other action drops it.
 */
export class MoveTool implements Tool {
  readonly id = 'move';
  private drag: Drag | null = null;

  pointerDown(context: ToolContext, input: PointerInput): void {
    const { editor } = context;
    let floating = editor.floating;

    if (floating) {
      const inside = rectContains(
        {
          x: floating.x,
          y: floating.y,
          width: floating.pixels.width,
          height: floating.pixels.height,
        },
        input.x,
        input.y,
      );
      if (!inside) {
        editor.commitFloating();
        floating = null;
      }
    }

    if (!floating) {
      const selection = editor.selection;
      if (selection && !rectContains(selection, input.x, input.y)) return;
      if (!editor.liftSelection()) return;
      floating = editor.floating;
    }
    if (!floating) return;

    this.drag = { startX: input.x, startY: input.y, originX: floating.x, originY: floating.y };
  }

  pointerMove(context: ToolContext, input: PointerInput): void {
    const drag = this.drag;
    if (!drag) return;
    context.editor.moveFloatingTo(
      drag.originX + input.x - drag.startX,
      drag.originY + input.y - drag.startY,
    );
  }

  pointerUp(): void {
    this.drag = null;
  }

  /** Escape during a drag puts the content back where the drag started. */
  cancel(context: ToolContext): void {
    const drag = this.drag;
    if (!drag) return;
    this.drag = null;
    context.editor.moveFloatingTo(drag.originX, drag.originY);
  }
}
