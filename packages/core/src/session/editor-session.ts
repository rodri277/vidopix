import type { Color } from '../domain/color.js';
import type { Rect } from '../domain/rect.js';
import { createSprite, type InvalidSizeError, type Layer, type Sprite } from '../domain/sprite.js';
import { PixelPatchCommand } from '../history/command.js';
import { DEFAULT_HISTORY_BUDGET_BYTES, HistoryManager } from '../history/history-manager.js';
import type { PixelPatch } from '../history/pixel-patch.js';
import {
  exportSprite,
  type ExportError,
  type ExportImage,
  type ExportOptions,
} from '../io/export.js';
import type { IdGenerator } from '../ports/id-generator.js';
import type { Result } from '../result.js';
import { EyedropperTool } from '../tools/eyedropper-tool.js';
import { FillTool } from '../tools/fill-tool.js';
import { FreehandTool } from '../tools/freehand-tool.js';
import { ShapeTool } from '../tools/shape-tool.js';
import {
  DEFAULT_TOOL_OPTIONS,
  MAX_BRUSH_SIZE,
  MIN_BRUSH_SIZE,
  type ColorSlot,
  type PointerInput,
  type Preview,
  type Tool,
  type ToolContext,
  type ToolId,
  type ToolOptions,
} from '../tools/tool.js';
import { Emitter } from './emitter.js';

export type HistoryCause = 'record' | 'undo' | 'redo' | 'clear';

export interface SessionEvents {
  /** An area of the active document changed and needs to be redrawn. */
  documentChanged: { dirty: Rect };
  /** The whole document was replaced (new sprite). */
  spriteReplaced: { sprite: Sprite };
  historyChanged: {
    canUndo: boolean;
    canRedo: boolean;
    undoLabel: string | null;
    redoLabel: string | null;
    cause: HistoryCause;
    /** Label of the command that was recorded, undone or redone. */
    label: string | null;
  };
  toolChanged: { tool: ToolId };
  colorsChanged: { primary: Color; secondary: Color };
  optionsChanged: { options: ToolOptions };
  previewChanged: { preview: Preview | null };
}

export interface SessionConfig {
  readonly ids: IdGenerator;
  readonly historyBudgetBytes?: number;
}

const OPAQUE_BLACK: Color = 0xff000000;
const OPAQUE_WHITE: Color = 0xffffffff;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(value)));
}

/**
 * The only door between the UI and the editing engine. Owns the document, the tools and the
 * history; the UI sends pointer input and commands, and listens to events to know what to redraw.
 */
export class EditorSession {
  private readonly events = new Emitter<SessionEvents>();
  private readonly tools: Readonly<Record<ToolId, Tool>> = {
    pencil: new FreehandTool('pencil', 'Pencil'),
    eraser: new FreehandTool('eraser', 'Eraser'),
    fill: new FillTool(),
    eyedropper: new EyedropperTool(),
    line: new ShapeTool('line', 'Line'),
    rectangle: new ShapeTool('rectangle', 'Rectangle'),
    ellipse: new ShapeTool('ellipse', 'Ellipse'),
  };

  private history: HistoryManager;
  private currentSprite: Sprite;
  private currentTool: ToolId = 'pencil';
  private primary: Color = OPAQUE_BLACK;
  private secondary: Color = OPAQUE_WHITE;
  private currentOptions: ToolOptions = DEFAULT_TOOL_OPTIONS;
  private currentPreview: Preview | null = null;
  private stroking = false;
  private readonly context: ToolContext;

  private constructor(
    sprite: Sprite,
    private readonly config: SessionConfig,
  ) {
    this.currentSprite = sprite;
    this.history = new HistoryManager(config.historyBudgetBytes ?? DEFAULT_HISTORY_BUDGET_BYTES);
    this.context = this.createContext();
  }

  static create(
    spriteOptions: { width: number; height: number; name?: string },
    config: SessionConfig,
  ): Result<EditorSession, InvalidSizeError> {
    const sprite = createSprite(spriteOptions, config.ids);
    if (!sprite.ok) return sprite;
    return { ok: true, value: new EditorSession(sprite.value, config) };
  }

  // ---- State ----

  get sprite(): Sprite {
    return this.currentSprite;
  }

  get activeLayer(): Layer {
    const layer = this.currentSprite.layers[0];
    if (!layer) throw new Error('A sprite always has at least one layer');
    return layer;
  }

  get activeTool(): ToolId {
    return this.currentTool;
  }

  get primaryColor(): Color {
    return this.primary;
  }

  get secondaryColor(): Color {
    return this.secondary;
  }

  get toolOptions(): ToolOptions {
    return this.currentOptions;
  }

  get preview(): Preview | null {
    return this.currentPreview;
  }

  get canUndo(): boolean {
    return this.history.canUndo;
  }

  get canRedo(): boolean {
    return this.history.canRedo;
  }

  get historyBytes(): number {
    return this.history.usedBytes;
  }

  on<K extends keyof SessionEvents>(
    event: K,
    listener: (payload: SessionEvents[K]) => void,
  ): () => void {
    return this.events.on(event, listener);
  }

  // ---- Document ----

  /** Replaces the document with a new empty sprite and clears the history. */
  newSprite(options: {
    width: number;
    height: number;
    name?: string;
  }): Result<Sprite, InvalidSizeError> {
    const result = createSprite(options, this.config.ids);
    if (!result.ok) return result;
    this.cancelStroke();
    this.currentSprite = result.value;
    this.history = new HistoryManager(
      this.config.historyBudgetBytes ?? DEFAULT_HISTORY_BUDGET_BYTES,
    );
    this.events.emit('spriteReplaced', { sprite: this.currentSprite });
    this.emitHistory('clear', null);
    return result;
  }

  /** Flattens the document into pixels at a whole-number scale, ready to be encoded as PNG. */
  exportImage(options: ExportOptions): Result<ExportImage, ExportError> {
    return exportSprite(this.currentSprite, options);
  }

  // ---- Tools and colors ----

  setActiveTool(tool: ToolId): void {
    if (tool === this.currentTool) return;
    this.cancelStroke();
    this.currentTool = tool;
    this.events.emit('toolChanged', { tool });
  }

  setColor(slot: ColorSlot, color: Color): void {
    if (slot === 'primary') this.primary = color;
    else this.secondary = color;
    this.emitColors();
  }

  swapColors(): void {
    [this.primary, this.secondary] = [this.secondary, this.primary];
    this.emitColors();
  }

  setToolOptions(changes: Partial<ToolOptions>): void {
    const next: ToolOptions = {
      brushSize: clamp(
        changes.brushSize ?? this.currentOptions.brushSize,
        MIN_BRUSH_SIZE,
        MAX_BRUSH_SIZE,
      ),
      fillMode: changes.fillMode ?? this.currentOptions.fillMode,
      tolerance: clamp(changes.tolerance ?? this.currentOptions.tolerance, 0, 255),
      shapeFilled: changes.shapeFilled ?? this.currentOptions.shapeFilled,
    };
    this.currentOptions = next;
    this.events.emit('optionsChanged', { options: next });
  }

  // ---- Pointer input ----

  pointerDown(input: PointerInput): void {
    const layer = this.activeLayer;
    if (this.stroking || layer.locked || !layer.visible) return;
    this.stroking = true;
    this.tools[this.currentTool].pointerDown(this.context, input);
  }

  pointerMove(input: PointerInput): void {
    if (!this.stroking) return;
    this.tools[this.currentTool].pointerMove(this.context, input);
  }

  pointerUp(input: PointerInput): void {
    if (!this.stroking) return;
    this.stroking = false;
    this.tools[this.currentTool].pointerUp(this.context, input);
  }

  /** Abandons the stroke in progress (for example on Escape) and restores the document. */
  cancelStroke(): void {
    if (!this.stroking) return;
    this.stroking = false;
    this.tools[this.currentTool].cancel(this.context);
  }

  // ---- History ----

  undo(): void {
    this.cancelStroke();
    const step = this.history.undo();
    if (!step) return;
    this.afterHistoryStep('undo', step.label, step.dirty);
  }

  redo(): void {
    this.cancelStroke();
    const step = this.history.redo();
    if (!step) return;
    this.afterHistoryStep('redo', step.label, step.dirty);
  }

  // ---- Internals ----

  private afterHistoryStep(cause: 'undo' | 'redo', label: string, dirty: Rect | null): void {
    if (dirty) this.events.emit('documentChanged', { dirty });
    this.emitHistory(cause, label);
  }

  private emitHistory(cause: HistoryCause, label: string | null): void {
    this.events.emit('historyChanged', {
      canUndo: this.history.canUndo,
      canRedo: this.history.canRedo,
      undoLabel: this.history.undoLabel,
      redoLabel: this.history.redoLabel,
      cause,
      label,
    });
  }

  private emitColors(): void {
    this.events.emit('colorsChanged', { primary: this.primary, secondary: this.secondary });
  }

  private createContext(): ToolContext {
    // eslint-disable-next-line @typescript-eslint/no-this-alias -- the context reads live session state
    const session = this;
    return {
      get buffer() {
        return session.activeLayer.buffer;
      },
      get options() {
        return session.currentOptions;
      },
      colorFor: (slot) => (slot === 'primary' ? session.primary : session.secondary),
      setColor: (slot, color) => {
        session.setColor(slot, color);
      },
      commit: (label: string, patch: PixelPatch | null) => {
        if (!patch) return;
        session.history.record(new PixelPatchCommand(label, session.activeLayer.buffer, patch));
        session.emitHistory('record', label);
      },
      markDirty: (rect) => {
        if (rect) session.events.emit('documentChanged', { dirty: rect });
      },
      setPreview: (preview) => {
        session.currentPreview = preview;
        session.events.emit('previewChanged', { preview });
      },
    };
  }
}
