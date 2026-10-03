import type { PointerInput, Tool, ToolContext } from './tool.js';

/** Picks the color under the pointer into the primary (or, with the secondary button, secondary) slot. */
export class EyedropperTool implements Tool {
  readonly id = 'eyedropper';
  private picking = false;

  pointerDown(context: ToolContext, input: PointerInput): void {
    this.picking = true;
    this.pick(context, input);
  }

  pointerMove(context: ToolContext, input: PointerInput): void {
    if (this.picking) this.pick(context, input);
  }

  pointerUp(): void {
    this.picking = false;
  }

  cancel(): void {
    this.picking = false;
  }

  private pick(context: ToolContext, input: PointerInput): void {
    if (!context.buffer.contains(input.x, input.y)) return;
    context.setColor(input.button, context.buffer.get(input.x, input.y));
  }
}
