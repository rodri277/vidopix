import { DocumentEditor, type DocumentEvents } from '../document/document-editor.js';
import type { Color } from '../domain/color.js';
import type { PixelBuffer } from '../domain/pixel-buffer.js';
import type { Rect } from '../domain/rect.js';
import { createSprite, type InvalidSizeError, type Layer, type Sprite } from '../domain/sprite.js';
import { DEFAULT_HISTORY_BUDGET_BYTES } from '../history/history-manager.js';
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
import { MoveTool } from '../tools/move-tool.js';
import { SelectTool } from '../tools/select-tool.js';
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
import { MAX_DITHER } from '../tools/painter.js';
import { Emitter } from './emitter.js';

export type { HistoryCause } from '../document/document-editor.js';

interface ToolEvents {
  toolChanged: { tool: ToolId };
  colorsChanged: { primary: Color; secondary: Color };
  optionsChanged: { options: ToolOptions };
  previewChanged: { preview: Preview | null };
}

export type SessionEvents = DocumentEvents & ToolEvents;

export interface SessionConfig {
  readonly ids: IdGenerator;
  readonly historyBudgetBytes?: number;
}

const OPAQUE_BLACK: Color = 0xff000000;
const OPAQUE_WHITE: Color = 0xffffffff;

/** Tools that change pixels, so they need a visible, unlocked layer. */
const EDITING_TOOLS: ReadonlySet<ToolId> = new Set([
  'pencil',
  'eraser',
  'fill',
  'line',
  'rectangle',
  'ellipse',
  'move',
]);

const DOCUMENT_EVENTS: ReadonlySet<string> = new Set([
  'documentChanged',
  'layersChanged',
  'selectionChanged',
  'paletteChanged',
  'nameChanged',
  'floatingChanged',
  'spriteReplaced',
  'historyChanged',
  'actionBlocked',
]);

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(value)));
}

/**
 * The only door between the UI and the editing engine. Owns the tools and their settings and wraps
 * the document; the UI sends pointer input and commands, and listens to events to know what to
 * redraw. Everything about layers, selection, clipboard and history is on `document`.
 */
export class EditorSession {
  /** Layers, selection, floating content, clipboard and history. */
  readonly document: DocumentEditor;

  private readonly events = new Emitter<ToolEvents>();
  private readonly tools: Readonly<Record<ToolId, Tool>> = {
    pencil: new FreehandTool('pencil', 'Pencil'),
    eraser: new FreehandTool('eraser', 'Eraser'),
    fill: new FillTool(),
    eyedropper: new EyedropperTool(),
    line: new ShapeTool('line', 'Line'),
    rectangle: new ShapeTool('rectangle', 'Rectangle'),
    ellipse: new ShapeTool('ellipse', 'Ellipse'),
    select: new SelectTool(),
    move: new MoveTool(),
  };

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
    this.document = new DocumentEditor(
      sprite,
      config.ids,
      config.historyBudgetBytes ?? DEFAULT_HISTORY_BUDGET_BYTES,
    );
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
    return this.document.sprite;
  }

  get activeLayer(): Layer {
    return this.document.activeLayer;
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
    return this.document.canUndo;
  }

  get canRedo(): boolean {
    return this.document.canRedo;
  }

  get historyBytes(): number {
    return this.document.historyBytes;
  }

  on<K extends keyof SessionEvents>(
    event: K,
    listener: (payload: SessionEvents[K]) => void,
  ): () => void {
    if (DOCUMENT_EVENTS.has(event)) {
      return this.document.events.on(
        event as keyof DocumentEvents,
        listener as (payload: DocumentEvents[keyof DocumentEvents]) => void,
      );
    }
    return this.events.on(
      event as keyof ToolEvents,
      listener as (payload: ToolEvents[keyof ToolEvents]) => void,
    );
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
    this.document.replaceSprite(result.value);
    return result;
  }

  /** Replaces the document with an existing sprite, for example one opened from a file. */
  openSprite(sprite: Sprite): void {
    this.cancelStroke();
    this.document.replaceSprite(sprite);
  }

  /** Flattens the document into pixels at a whole-number scale, ready to be encoded as PNG. */
  exportImage(options: ExportOptions): Result<ExportImage, ExportError> {
    this.document.commitFloating();
    return exportSprite(this.document.sprite, options);
  }

  /** Pastes pixels from outside the app as floating content and switches to the Move tool. */
  pasteBuffer(pixels: PixelBuffer, center: { x: number; y: number }): boolean {
    this.cancelStroke();
    const pasted = this.document.pasteBuffer(pixels, center);
    if (pasted) this.selectTool('move');
    return pasted;
  }

  /** Pastes the app's own clipboard as floating content and switches to the Move tool. */
  paste(center: { x: number; y: number }): boolean {
    this.cancelStroke();
    const pasted = this.document.paste(center);
    if (pasted) this.selectTool('move');
    return pasted;
  }

  // ---- Tools and colors ----

  setActiveTool(tool: ToolId): void {
    if (tool === this.currentTool) return;
    this.cancelStroke();
    if (tool !== 'move') this.document.commitFloating();
    this.selectTool(tool);
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
      mirrorX: changes.mirrorX ?? this.currentOptions.mirrorX,
      mirrorY: changes.mirrorY ?? this.currentOptions.mirrorY,
      dither: clamp(changes.dither ?? this.currentOptions.dither, 1, MAX_DITHER),
      pixelPerfect: changes.pixelPerfect ?? this.currentOptions.pixelPerfect,
      pressure: changes.pressure ?? this.currentOptions.pressure,
    };
    this.currentOptions = next;
    this.events.emit('optionsChanged', { options: next });
  }

  // ---- Pointer input ----

  pointerDown(input: PointerInput): void {
    if (this.stroking) return;
    if (EDITING_TOOLS.has(this.currentTool)) {
      const layer = this.document.activeLayer;
      if (layer.locked || !layer.visible) {
        this.document.events.emit('actionBlocked', {
          reason: layer.locked ? 'layer-locked' : 'layer-hidden',
        });
        return;
      }
    }
    if (this.currentTool !== 'move') this.document.commitFloating();
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

  /** Escape: cancels the stroke in progress, or else drops floating content without applying it. */
  cancelAction(): void {
    if (this.stroking) this.cancelStroke();
    else this.document.cancelFloating();
  }

  // ---- History ----

  undo(): void {
    this.cancelStroke();
    this.document.undo();
  }

  redo(): void {
    this.cancelStroke();
    this.document.redo();
  }

  // ---- Internals ----

  private selectTool(tool: ToolId): void {
    if (tool === this.currentTool) return;
    this.currentTool = tool;
    this.events.emit('toolChanged', { tool });
  }

  private emitColors(): void {
    this.events.emit('colorsChanged', { primary: this.primary, secondary: this.secondary });
  }

  private createContext(): ToolContext {
    // eslint-disable-next-line @typescript-eslint/no-this-alias -- the context reads live session state
    const session = this;
    return {
      get buffer() {
        return session.document.activeLayer.buffer;
      },
      get options() {
        return session.currentOptions;
      },
      get selection() {
        return session.document.selection;
      },
      editor: session.document,
      colorFor: (slot) => (slot === 'primary' ? session.primary : session.secondary),
      setColor: (slot, color) => {
        session.setColor(slot, color);
      },
      sampleColor: (x, y) => session.document.sampleColor(x, y),
      commit: (label: string, patch: PixelPatch | null) => {
        session.document.commitPixels(label, patch);
      },
      markDirty: (rect: Rect | null) => {
        session.document.markDirty(rect);
      },
      setPreview: (preview) => {
        session.currentPreview = preview;
        session.events.emit('previewChanged', { preview });
      },
    };
  }
}
