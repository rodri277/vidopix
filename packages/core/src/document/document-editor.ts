import { blendPixel, compositeFrame, compositePixel, scaleAlpha } from '../domain/compositing.js';
import type { Color } from '../domain/color.js';
import { PixelBuffer } from '../domain/pixel-buffer.js';
import { intersectRects, rectContains, rectsEqual, unionRects, type Rect } from '../domain/rect.js';
import { cleanName, type Palette, type PaletteColor } from '../domain/palette.js';
import { MAX_FRAMES, type Frame, type Layer, type Sprite } from '../domain/sprite.js';
import { PixelPatchCommand, type Command } from '../history/command.js';
import { DEFAULT_HISTORY_BUDGET_BYTES, HistoryManager } from '../history/history-manager.js';
import { PatchRecorder } from '../history/patch-recorder.js';
import { revertPatch, type PixelPatch } from '../history/pixel-patch.js';
import {
  CompoundCommand,
  FrameScopedCommand,
  StateCommand,
  type DocumentHolder,
} from '../history/state-commands.js';
import type { IdGenerator } from '../ports/id-generator.js';
import { Emitter } from '../session/emitter.js';
import { activeLayerOf, findLayer, type DocumentState } from './document-state.js';
import {
  addFrame,
  canGrow,
  deleteFrame,
  duplicateFrame,
  moveFrame,
  setActiveFrame,
  setAllFrameDurations,
  setFrameDuration,
} from './frame-ops.js';
import {
  addPaletteColor,
  appendPaletteColors,
  movePaletteColor,
  removePaletteColor,
  renamePalette,
  renamePaletteColor,
  replacePalette,
  setPaletteColor,
  whyCannotAdd,
} from './palette-ops.js';
import {
  addLayer,
  deleteLayer,
  duplicateLayer,
  moveLayer,
  renameLayer,
  setActiveLayer,
  setLayerProps,
} from './layer-ops.js';

/** Longest sprite name. */
export const MAX_SPRITE_NAME_LENGTH = 60;

export type HistoryCause = 'record' | 'undo' | 'redo' | 'clear';

export type BlockReason =
  | 'layer-locked'
  | 'layer-hidden'
  | 'nothing-selected'
  | 'single-layer'
  | 'color-in-palette'
  | 'palette-full'
  | 'sprite-too-large'
  | 'frame-limit'
  | 'single-frame';

/** Pixels lifted from a layer or pasted, held above the document until they are dropped. */
export interface Floating {
  readonly pixels: PixelBuffer;
  /** Top-left corner in document pixels. May lie partly or fully outside the canvas. */
  readonly x: number;
  readonly y: number;
}

export interface DocumentEvents {
  /** An area of the composited document changed and needs to be redrawn. */
  documentChanged: { dirty: Rect };
  /** Layers were added, removed, reordered or edited, or the active layer changed. */
  layersChanged: { sprite: Sprite; activeLayerId: string };
  selectionChanged: { selection: Rect | null };
  paletteChanged: { palette: Palette };
  nameChanged: { name: string };
  /** Frames were added, removed, reordered or retimed, or the active frame changed. */
  framesChanged: { frames: readonly Frame[]; activeFrame: number };
  floatingChanged: { floating: Floating | null };
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
  /** An action could not run, with the reason, so the interface can say so. */
  actionBlocked: { reason: BlockReason };
}

interface FloatState {
  readonly floating: Floating;
  readonly label: string;
  /** Records the pixels erased from the source when the content was lifted; null for pastes. */
  readonly recorder: PatchRecorder | null;
  readonly buffer: PixelBuffer;
  readonly selectionBefore: Rect | null;
  /** Moving a layer without a selection: the selection stays empty. */
  readonly wholeLayer: boolean;
}

const BYTES_PER_PIXEL = 4;

function fullRect(sprite: Sprite): Rect {
  return { x: 0, y: 0, width: sprite.width, height: sprite.height };
}

/** Memory of one layer across all frames. */
function bufferBytes(sprite: Sprite): number {
  return sprite.width * sprite.height * BYTES_PER_PIXEL * sprite.frames.length;
}

/** Memory of one frame across all layers. */
function frameBytes(sprite: Sprite): number {
  return sprite.width * sprite.height * BYTES_PER_PIXEL * sprite.layers.length;
}

/**
 * The document and everything that edits it apart from tools and pointer input: layers, the
 * selection, the floating (lifted or pasted) content, the clipboard and the history.
 */
export class DocumentEditor {
  readonly events = new Emitter<DocumentEvents>();
  private readonly holder: DocumentHolder;
  private history: HistoryManager;
  private float: FloatState | null = null;
  private clipboard: PixelBuffer | null = null;
  private opacityBaseline: { layerId: string; opacity: number } | null = null;

  constructor(
    sprite: Sprite,
    private readonly ids: IdGenerator,
    private readonly budgetBytes: number = DEFAULT_HISTORY_BUDGET_BYTES,
  ) {
    const first = sprite.layers[0];
    if (!first) throw new Error('A sprite needs at least one layer');
    this.holder = { state: { sprite, activeLayerId: first.id, activeFrame: 0, selection: null } };
    this.history = new HistoryManager(budgetBytes);
  }

  // ---- State ----

  get state(): DocumentState {
    return this.holder.state;
  }

  get sprite(): Sprite {
    return this.holder.state.sprite;
  }

  get activeLayer(): Layer {
    return activeLayerOf(this.holder.state);
  }

  get selection(): Rect | null {
    return this.holder.state.selection;
  }

  get floating(): Floating | null {
    return this.float?.floating ?? null;
  }

  get hasClipboard(): boolean {
    return this.clipboard !== null;
  }

  get canUndo(): boolean {
    return this.float !== null || this.history.canUndo;
  }

  get canRedo(): boolean {
    return this.history.canRedo;
  }

  get historyBytes(): number {
    return this.history.usedBytes;
  }

  /** True when pixels on the active layer may be changed. */
  get isActiveLayerEditable(): boolean {
    const layer = this.activeLayer;
    return layer.visible && !layer.locked;
  }

  sampleColor(x: number, y: number): Color {
    return compositePixel(this.sprite, x, y);
  }

  // ---- Document ----

  replaceSprite(sprite: Sprite): void {
    this.float = null;
    this.opacityBaseline = null;
    const first = sprite.layers[0];
    if (!first) throw new Error('A sprite needs at least one layer');
    this.holder.state = setActiveFrame(
      { sprite, activeLayerId: first.id, activeFrame: 0, selection: null },
      0,
    );
    this.history = new HistoryManager(this.budgetBytes);
    this.events.emit('spriteReplaced', { sprite });
    this.emitLayers();
    this.emitFrames();
    this.events.emit('selectionChanged', { selection: null });
    this.events.emit('paletteChanged', { palette: sprite.palette });
    this.events.emit('nameChanged', { name: sprite.name });
    this.events.emit('floatingChanged', { floating: null });
    this.emitHistory('clear', null);
  }

  // ---- Pixel edits from tools ----

  /** Records a finished pixel edit on the active layer. */
  commitPixels(label: string, patch: PixelPatch | null): void {
    if (!patch) return;
    this.history.record(this.pixelCommand(label, this.activeLayer.buffer, patch));
    this.emitHistory('record', label);
  }

  markDirty(rect: Rect | null): void {
    if (rect) this.events.emit('documentChanged', { dirty: rect });
  }

  // ---- Layers ----

  setActiveLayer(id: string): void {
    this.commitFloating();
    const next = setActiveLayer(this.state, id);
    if (next === this.state) return;
    this.holder.state = next;
    this.emitLayers();
  }

  addLayer(): void {
    if (!this.requireRoom(1, 0)) return;
    this.structural('Add layer', (state) => addLayer(state, this.ids), bufferBytes(this.sprite));
  }

  duplicateLayer(id: string = this.state.activeLayerId): void {
    if (!this.requireRoom(1, 0)) return;
    this.structural(
      'Duplicate layer',
      (state) => duplicateLayer(state, id, this.ids),
      bufferBytes(this.sprite),
    );
  }

  deleteLayer(id: string = this.state.activeLayerId): void {
    if (this.sprite.layers.length <= 1) {
      this.events.emit('actionBlocked', { reason: 'single-layer' });
      return;
    }
    this.structural('Delete layer', (state) => deleteLayer(state, id), bufferBytes(this.sprite));
  }

  renameLayer(id: string, name: string): void {
    this.structural('Rename layer', (state) => renameLayer(state, id, name));
  }

  moveLayer(id: string, toIndex: number): void {
    this.structural('Reorder layers', (state) => moveLayer(state, id, toIndex));
  }

  setLayerVisible(id: string, visible: boolean): void {
    this.structural(visible ? 'Show layer' : 'Hide layer', (state) =>
      setLayerProps(state, id, { visible }),
    );
  }

  setLayerLocked(id: string, locked: boolean): void {
    this.structural(locked ? 'Lock layer' : 'Unlock layer', (state) =>
      setLayerProps(state, id, { locked }),
    );
  }

  /** Live opacity change while a slider is dragged. Not added to the history. */
  previewLayerOpacity(id: string, opacity: number): void {
    const layer = findLayer(this.state, id);
    if (!layer) return;
    this.commitFloating();
    if (this.opacityBaseline?.layerId !== id) {
      this.opacityBaseline = { layerId: id, opacity: layer.opacity };
    }
    this.applyState(setLayerProps(this.state, id, { opacity }));
  }

  /** Final opacity: one history step from the value before the preview started. */
  setLayerOpacity(id: string, opacity: number): void {
    const baseline = this.opacityBaseline?.layerId === id ? this.opacityBaseline.opacity : null;
    this.opacityBaseline = null;
    if (baseline === null) {
      this.structural('Layer opacity', (state) => setLayerProps(state, id, { opacity }));
      return;
    }
    const after = setLayerProps(this.state, id, { opacity });
    const before = setLayerProps(after, id, { opacity: baseline });
    if (before === after) {
      this.applyState(after);
      return;
    }
    this.applyState(after);
    this.history.record(new StateCommand('Layer opacity', this.holder, before, after, true));
    this.emitHistory('record', 'Layer opacity');
  }

  mergeDown(): void {
    this.commitFloating();
    const { layers } = this.sprite;
    const index = layers.findIndex((layer) => layer.id === this.state.activeLayerId);
    const upper = layers[index];
    const lower = layers[index - 1];
    if (!upper || !lower) {
      this.events.emit('actionBlocked', { reason: 'single-layer' });
      return;
    }
    if (lower.locked || !lower.visible) {
      this.events.emit('actionBlocked', { reason: lower.locked ? 'layer-locked' : 'layer-hidden' });
      return;
    }

    const before = this.state;
    const commands: Command[] = [];
    if (upper.visible) {
      this.sprite.frames.forEach((frame, index) => {
        const source = upper.cels[index];
        const target = lower.cels[index];
        if (!source || !target) return;
        const recorder = new PatchRecorder(target);
        for (let y = 0; y < source.height; y++) {
          for (let x = 0; x < source.width; x++) {
            const pixel = scaleAlpha(source.get(x, y), upper.opacity);
            if (pixel >>> 24 !== 0) recorder.setPixel(x, y, blendPixel(pixel, target.get(x, y)));
          }
        }
        this.markDirty(recorder.takeDirty());
        const patch = recorder.finish();
        if (patch)
          commands.push(
            new FrameScopedCommand(
              new PixelPatchCommand('Merge down', target, patch),
              this.holder,
              frame.id,
            ),
          );
      });
    }

    const after = deleteLayer(before, upper.id);
    const next = setActiveLayer(after, lower.id);
    this.holder.state = next;
    commands.push(
      new StateCommand('Merge down', this.holder, before, next, true, bufferBytes(this.sprite)),
    );
    this.history.record(new CompoundCommand('Merge down', commands));
    this.emitLayers();
    this.markDirty(fullRect(this.sprite));
    this.emitHistory('record', 'Merge down');
  }

  /** Merges every visible layer into one. Hidden layers are discarded. */
  flatten(): void {
    this.commitFloating();
    const { sprite } = this.state;
    if (sprite.layers.length <= 1) return;
    const bottom = sprite.layers.find((layer) => layer.visible) ?? sprite.layers[0];
    if (!bottom) return;
    const state0 = this.state;
    const cels = sprite.frames.map((_, index) => compositeFrame(sprite, index));
    const merged: Layer = {
      id: this.ids.next(),
      name: bottom.name,
      visible: true,
      locked: false,
      opacity: 1,
      blendMode: 'normal',
      buffer: cels[state0.activeFrame] ?? PixelBuffer.create(sprite.width, sprite.height),
      cels,
    };
    this.structural(
      'Flatten image',
      (state) => ({
        ...state,
        sprite: { ...state.sprite, layers: [merged] },
        activeLayerId: merged.id,
      }),
      bufferBytes(sprite) * (sprite.layers.length + 1),
    );
  }

  // ---- Frames ----

  get activeFrame(): number {
    return this.state.activeFrame;
  }

  /** Shows another frame. Not a history step; drops any floating content first. */
  setActiveFrame(index: number): void {
    this.commitFloating();
    const next = setActiveFrame(this.state, index);
    if (next === this.state) return;
    this.applyState(next);
  }

  addFrame(afterIndex?: number): void {
    if (!this.requireRoom(0, 1)) return;
    this.structural(
      'Add frame',
      (state) => addFrame(state, this.ids, afterIndex),
      frameBytes(this.sprite),
    );
  }

  duplicateFrame(index: number = this.state.activeFrame): void {
    if (!this.requireRoom(0, 1)) return;
    this.structural(
      'Duplicate frame',
      (state) => duplicateFrame(state, this.ids, index),
      frameBytes(this.sprite),
    );
  }

  deleteFrame(index: number = this.state.activeFrame): void {
    if (this.sprite.frames.length <= 1) {
      this.events.emit('actionBlocked', { reason: 'single-frame' });
      return;
    }
    this.structural('Delete frame', (state) => deleteFrame(state, index), frameBytes(this.sprite));
  }

  moveFrame(from: number, to: number): void {
    this.structural('Reorder frames', (state) => moveFrame(state, from, to));
  }

  setFrameDuration(index: number, milliseconds: number): void {
    this.structural(
      'Frame duration',
      (state) => setFrameDuration(state, index, milliseconds),
      0,
      false,
    );
  }

  /** Gives every frame the same duration, for example from a frames-per-second field. */
  setAllFrameDurations(milliseconds: number): void {
    this.structural('Frame rate', (state) => setAllFrameDurations(state, milliseconds), 0, false);
  }

  // ---- Sprite name ----

  renameSprite(name: string): void {
    this.structural(
      'Rename sprite',
      (state) => {
        const cleaned = cleanName(name, MAX_SPRITE_NAME_LENGTH);
        if (cleaned === undefined || cleaned === state.sprite.name) return state;
        return { ...state, sprite: { ...state.sprite, name: cleaned } };
      },
      0,
      false,
    );
  }

  // ---- Palette ----

  get palette(): Palette {
    return this.sprite.palette;
  }

  /** Adds a color to the palette. Returns false (and says why) if it could not be added. */
  addPaletteColor(color: Color, name?: string): boolean {
    const outcome = whyCannotAdd(this.state, color);
    if (outcome !== 'added') {
      this.events.emit('actionBlocked', {
        reason: outcome === 'duplicate' ? 'color-in-palette' : 'palette-full',
      });
      return false;
    }
    this.paletteEdit('Add color', (state) => addPaletteColor(state, color, name));
    return true;
  }

  appendPaletteColors(colors: readonly PaletteColor[]): void {
    this.paletteEdit('Add colors to palette', (state) => appendPaletteColors(state, colors));
  }

  removePaletteColor(index: number): void {
    this.paletteEdit('Remove color', (state) => removePaletteColor(state, index));
  }

  movePaletteColor(from: number, to: number): void {
    this.paletteEdit('Reorder palette', (state) => movePaletteColor(state, from, to));
  }

  renamePaletteColor(index: number, name: string | undefined): void {
    this.paletteEdit('Rename color', (state) => renamePaletteColor(state, index, name));
  }

  setPaletteColor(index: number, color: Color): void {
    this.paletteEdit('Edit palette color', (state) => setPaletteColor(state, index, color));
  }

  renamePalette(name: string): void {
    this.paletteEdit('Rename palette', (state) => renamePalette(state, name));
  }

  /** Replaces the palette's name and colors, for example when loading a preset. */
  loadPalette(name: string, colors: readonly PaletteColor[]): void {
    this.paletteEdit('Load palette', (state) => replacePalette(state, name, colors));
  }

  private paletteEdit(label: string, compute: (state: DocumentState) => DocumentState): void {
    this.structural(label, compute, 0, false);
  }

  /**
   * Replaces every pixel of exactly `from` with `to` on all layers that are not locked, hidden
   * ones included, in every frame, inside the selection when there is one. One undo step. Returns how many
   * pixels changed.
   */
  replaceColor(from: Color, to: Color): number {
    this.commitFloating();
    if (from === to) return 0;
    const clip = this.selection;
    const commands: Command[] = [];
    let changed = 0;
    let dirty: Rect | null = null;

    for (const layer of this.sprite.layers) {
      if (layer.locked) continue;
      this.sprite.frames.forEach((frame, index) => {
        const buffer = layer.cels[index];
        if (!buffer) return;
        const recorder = new PatchRecorder(buffer, clip);
        for (let y = 0; y < buffer.height; y++) {
          for (let x = 0; x < buffer.width; x++) {
            if (buffer.data[y * buffer.width + x] !== from) continue;
            if (clip && !rectContains(clip, x, y)) continue;
            recorder.setPixel(x, y, to);
            changed++;
          }
        }
        dirty = unionRects(dirty, recorder.takeDirty());
        const patch = recorder.finish();
        if (patch) {
          commands.push(this.pixelCommand('Replace color', buffer, patch, frame.id));
        }
      });
    }

    if (commands.length === 0) return 0;
    this.markDirty(dirty);
    this.history.record(new CompoundCommand('Replace color', commands));
    this.emitHistory('record', 'Replace color');
    return changed;
  }

  // ---- Selection ----

  /** Changes the selection without recording it; call `commitSelection` when the gesture ends. */
  previewSelection(rect: Rect | null): void {
    this.commitFloating();
    const clipped = rect ? intersectRects(rect, fullRect(this.sprite)) : null;
    if (rectsEqual(clipped, this.selection)) return;
    this.holder.state = { ...this.state, selection: clipped };
    this.events.emit('selectionChanged', { selection: clipped });
  }

  /** Records the selection change since `before` as one undoable step. */
  commitSelection(before: Rect | null): void {
    const current = this.selection;
    if (rectsEqual(before, current)) return;
    const label = current ? 'Select' : 'Deselect';
    this.history.record(
      new StateCommand(label, this.holder, { ...this.state, selection: before }, this.state, false),
    );
    this.emitHistory('record', label);
  }

  selectAll(): void {
    const before = this.selection;
    this.previewSelection(fullRect(this.sprite));
    this.commitSelection(before);
  }

  deselect(): void {
    const before = this.selection;
    this.previewSelection(null);
    this.commitSelection(before);
  }

  // ---- Clipboard and deleting ----

  /** The selected pixels of the active layer (or the floating content), also kept for pasting. */
  copySelection(): PixelBuffer | null {
    const pixels = this.float ? this.float.floating.pixels.clone() : this.readSelection();
    if (!pixels) {
      this.events.emit('actionBlocked', { reason: 'nothing-selected' });
      return null;
    }
    this.clipboard = pixels;
    return pixels.clone();
  }

  cutSelection(): PixelBuffer | null {
    const copied = this.copySelection();
    if (copied) this.deleteSelection();
    return copied;
  }

  deleteSelection(): void {
    const float = this.float;
    if (float) {
      if (float.recorder) {
        // Dropping empty content leaves the erased source behind, as a Delete step.
        this.float = {
          ...float,
          label: 'Delete',
          floating: { ...float.floating, pixels: PixelBuffer.create(1, 1) },
        };
        this.commitFloating();
      } else {
        this.cancelFloating();
      }
      return;
    }
    const selection = this.selection;
    if (!selection) {
      this.events.emit('actionBlocked', { reason: 'nothing-selected' });
      return;
    }
    if (!this.requireEditable()) return;
    const recorder = new PatchRecorder(this.activeLayer.buffer, selection);
    for (let y = selection.y; y < selection.y + selection.height; y++) {
      for (let x = selection.x; x < selection.x + selection.width; x++) recorder.setPixel(x, y, 0);
    }
    this.markDirty(recorder.takeDirty());
    this.commitPixels('Delete', recorder.finish());
  }

  /** Pastes the internal clipboard, centered on `center`. */
  paste(center: { x: number; y: number }): boolean {
    if (!this.clipboard) return false;
    return this.pasteBuffer(this.clipboard, center);
  }

  /** Floats `pixels` over the active layer, centered on `center`, until committed or canceled. */
  pasteBuffer(pixels: PixelBuffer, center: { x: number; y: number }): boolean {
    this.commitFloating();
    if (!this.requireEditable()) return false;
    this.clipboard = pixels.clone();
    const floating: Floating = {
      pixels: pixels.clone(),
      x: Math.round(center.x - pixels.width / 2),
      y: Math.round(center.y - pixels.height / 2),
    };
    this.float = {
      floating,
      label: 'Paste',
      recorder: null,
      buffer: this.activeLayer.buffer,
      selectionBefore: this.selection,
      wholeLayer: false,
    };
    this.setLiveSelection(this.floatRect(floating));
    this.events.emit('floatingChanged', { floating });
    return true;
  }

  // ---- Floating content ----

  /** Lifts the selection (or the whole layer when nothing is selected) so it can be moved. */
  liftSelection(): boolean {
    if (this.float) return true;
    if (!this.requireEditable()) return false;
    const layer = this.activeLayer;
    const selection = this.selection;
    const rect = selection
      ? intersectRects(selection, fullRect(this.sprite))
      : fullRect(this.sprite);
    if (!rect) return false;

    const pixels = PixelBuffer.create(rect.width, rect.height);
    for (let y = 0; y < rect.height; y++) {
      for (let x = 0; x < rect.width; x++) {
        pixels.set(x, y, layer.buffer.get(rect.x + x, rect.y + y));
      }
    }
    const recorder = new PatchRecorder(layer.buffer);
    for (let y = rect.y; y < rect.y + rect.height; y++) {
      for (let x = rect.x; x < rect.x + rect.width; x++) recorder.setPixel(x, y, 0);
    }
    this.markDirty(recorder.takeDirty());

    const floating: Floating = { pixels, x: rect.x, y: rect.y };
    this.float = {
      floating,
      label: 'Move',
      recorder,
      buffer: layer.buffer,
      selectionBefore: selection,
      wholeLayer: selection === null,
    };
    this.events.emit('floatingChanged', { floating });
    return true;
  }

  moveFloatingTo(x: number, y: number): void {
    const float = this.float;
    if (!float) return;
    if (float.floating.x === x && float.floating.y === y) return;
    const floating: Floating = { ...float.floating, x, y };
    this.float = { ...float, floating };
    if (!float.wholeLayer) this.setLiveSelection(this.floatRect(floating));
    this.events.emit('floatingChanged', { floating });
  }

  /** Moves the floating content by a distance, lifting the selection first if needed. */
  nudge(dx: number, dy: number): void {
    if (!this.float && !this.liftSelection()) return;
    const floating = this.floating;
    if (floating) this.moveFloatingTo(floating.x + dx, floating.y + dy);
  }

  /** Drops the floating content onto the layer as one undoable step. */
  commitFloating(): void {
    const float = this.float;
    if (!float) return;
    this.float = null;

    const { floating, buffer } = float;
    const recorder = float.recorder ?? new PatchRecorder(buffer);
    for (let y = 0; y < floating.pixels.height; y++) {
      for (let x = 0; x < floating.pixels.width; x++) {
        const source = floating.pixels.get(x, y);
        if (source >>> 24 === 0) continue;
        const targetX = floating.x + x;
        const targetY = floating.y + y;
        recorder.setPixel(targetX, targetY, blendPixel(source, buffer.get(targetX, targetY)));
      }
    }
    this.markDirty(recorder.takeDirty());
    const patch = recorder.finish();

    const finalSelection = float.wholeLayer
      ? null
      : intersectRects(this.floatRect(floating), fullRect(this.sprite));
    const commands: Command[] = [];
    if (patch) commands.push(this.pixelCommand(float.label, buffer, patch));
    if (!rectsEqual(float.selectionBefore, finalSelection)) {
      commands.push(
        new StateCommand(
          float.label,
          this.holder,
          { ...this.state, selection: float.selectionBefore },
          { ...this.state, selection: finalSelection },
          false,
        ),
      );
    }

    this.setLiveSelection(finalSelection);
    this.events.emit('floatingChanged', { floating: null });
    const [only] = commands;
    if (only && commands.length === 1) this.history.record(only);
    else if (commands.length > 1) this.history.record(new CompoundCommand(float.label, commands));
    if (commands.length > 0) this.emitHistory('record', float.label);
  }

  /** Throws the floating content away and puts everything back as it was before it was lifted. */
  cancelFloating(): void {
    const float = this.float;
    if (!float) return;
    this.float = null;
    if (float.recorder) {
      const patch = float.recorder.finish();
      if (patch) {
        revertPatch(float.buffer, patch);
        this.markDirty(patch.bounds);
      }
    }
    this.setLiveSelection(float.selectionBefore);
    this.events.emit('floatingChanged', { floating: null });
  }

  // ---- History ----

  undo(): void {
    if (this.float) {
      this.cancelFloating();
      return;
    }
    this.step('undo');
  }

  redo(): void {
    this.cancelFloating();
    this.step('redo');
  }

  // ---- Internals ----

  private step(direction: 'undo' | 'redo'): void {
    const previous = this.state;
    const step = direction === 'undo' ? this.history.undo() : this.history.redo();
    if (!step) return;
    this.publishChanges(previous);
    this.markDirty(step.dirty);
    this.emitHistory(direction, step.label);
  }

  private structural(
    label: string,
    compute: (state: DocumentState) => DocumentState,
    retainedBytes = 0,
    affectsPixels = true,
  ): void {
    this.commitFloating();
    const before = this.state;
    const next = compute(before);
    if (next === before) return;
    this.holder.state = next;
    this.history.record(
      new StateCommand(label, this.holder, before, next, affectsPixels, retainedBytes),
    );
    this.publishChanges(before);
    if (affectsPixels) this.markDirty(fullRect(next.sprite));
    this.emitHistory('record', label);
  }

  private applyState(next: DocumentState): void {
    if (next === this.state) return;
    const previous = this.state;
    this.holder.state = next;
    this.publishChanges(previous);
    this.markDirty(fullRect(next.sprite));
  }

  private publishChanges(previous: DocumentState): void {
    const current = this.state;
    if (
      current.sprite.layers !== previous.sprite.layers ||
      current.sprite.width !== previous.sprite.width ||
      current.activeLayerId !== previous.activeLayerId
    ) {
      this.emitLayers();
    }
    if (
      current.sprite.frames !== previous.sprite.frames ||
      current.activeFrame !== previous.activeFrame
    ) {
      this.emitFrames();
    }
    if (current.sprite.name !== previous.sprite.name) {
      this.events.emit('nameChanged', { name: current.sprite.name });
    }
    if (current.sprite.palette !== previous.sprite.palette) {
      this.events.emit('paletteChanged', { palette: current.sprite.palette });
    }
    if (!rectsEqual(current.selection, previous.selection)) {
      this.events.emit('selectionChanged', { selection: current.selection });
    }
  }

  private setLiveSelection(selection: Rect | null): void {
    if (rectsEqual(selection, this.selection)) return;
    this.holder.state = { ...this.state, selection };
    this.events.emit('selectionChanged', { selection });
  }

  private floatRect(floating: Floating): Rect {
    return {
      x: floating.x,
      y: floating.y,
      width: floating.pixels.width,
      height: floating.pixels.height,
    };
  }

  private readSelection(): PixelBuffer | null {
    const selection = this.selection;
    const rect = selection ? intersectRects(selection, fullRect(this.sprite)) : null;
    if (!rect) return null;
    const pixels = PixelBuffer.create(rect.width, rect.height);
    const source = this.activeLayer.buffer;
    for (let y = 0; y < rect.height; y++) {
      for (let x = 0; x < rect.width; x++) pixels.set(x, y, source.get(rect.x + x, rect.y + y));
    }
    return pixels;
  }

  /** A pixel patch bound to a frame, so undoing it shows the frame it belongs to. */
  private pixelCommand(
    label: string,
    buffer: PixelBuffer,
    patch: PixelPatch,
    frameId: string | undefined = this.sprite.frames[this.state.activeFrame]?.id,
  ): Command {
    return new FrameScopedCommand(
      new PixelPatchCommand(label, buffer, patch),
      this.holder,
      frameId,
    );
  }

  /** Whether `layers` more layers and `frames` more frames fit in memory and in the frame limit. */
  private requireRoom(layers: number, frames: number): boolean {
    if (frames > 0 && this.sprite.frames.length >= MAX_FRAMES) {
      this.events.emit('actionBlocked', { reason: 'frame-limit' });
      return false;
    }
    if (!canGrow(this.state, layers, frames)) {
      this.events.emit('actionBlocked', { reason: 'sprite-too-large' });
      return false;
    }
    return true;
  }

  private requireEditable(): boolean {
    const layer = this.activeLayer;
    if (layer.locked) {
      this.events.emit('actionBlocked', { reason: 'layer-locked' });
      return false;
    }
    if (!layer.visible) {
      this.events.emit('actionBlocked', { reason: 'layer-hidden' });
      return false;
    }
    return true;
  }

  private emitLayers(): void {
    this.events.emit('layersChanged', {
      sprite: this.sprite,
      activeLayerId: this.state.activeLayerId,
    });
  }

  private emitFrames(): void {
    this.events.emit('framesChanged', {
      frames: this.sprite.frames,
      activeFrame: this.state.activeFrame,
    });
  }

  private emitHistory(cause: HistoryCause, label: string | null): void {
    this.events.emit('historyChanged', {
      canUndo: this.canUndo,
      canRedo: this.history.canRedo,
      undoLabel: this.history.undoLabel,
      redoLabel: this.history.redoLabel,
      cause,
      label,
    });
  }
}
