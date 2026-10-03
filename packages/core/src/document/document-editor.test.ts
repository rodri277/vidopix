import { describe, expect, it } from 'vitest';
import { packRgba } from '../domain/color.js';
import { PixelBuffer } from '../domain/pixel-buffer.js';
import { createSprite } from '../domain/sprite.js';
import { createSequentialIdGenerator } from '../ports/id-generator.js';
import { DocumentEditor, type DocumentEvents } from './document-editor.js';

const RED = packRgba(255, 0, 0, 255);
const BLUE = packRgba(0, 0, 255, 255);

function createEditor(size = 8): DocumentEditor {
  const ids = createSequentialIdGenerator();
  const sprite = createSprite({ width: size, height: size }, ids);
  if (!sprite.ok) throw new Error('sprite');
  return new DocumentEditor(sprite.value, ids);
}

const layerNames = (editor: DocumentEditor): string[] => editor.sprite.layers.map((l) => l.name);

function paint(editor: DocumentEditor, x: number, y: number, color = RED): void {
  editor.activeLayer.buffer.set(x, y, color);
}

function record<K extends keyof DocumentEvents>(
  editor: DocumentEditor,
  event: K,
): DocumentEvents[K][] {
  const log: DocumentEvents[K][] = [];
  editor.events.on(event, (payload) => log.push(payload));
  return log;
}

describe('layers with history', () => {
  it('adds, duplicates and deletes layers and undoes each step', () => {
    const editor = createEditor();
    paint(editor, 1, 1);
    editor.addLayer();
    expect(layerNames(editor)).toEqual(['Layer 1', 'Layer 2']);
    expect(editor.activeLayer.name).toBe('Layer 2');

    editor.duplicateLayer();
    expect(layerNames(editor)).toEqual(['Layer 1', 'Layer 2', 'Layer 2 copy']);

    editor.deleteLayer();
    expect(layerNames(editor)).toEqual(['Layer 1', 'Layer 2']);

    editor.undo();
    expect(layerNames(editor)).toEqual(['Layer 1', 'Layer 2', 'Layer 2 copy']);
    editor.undo();
    editor.undo();
    expect(layerNames(editor)).toEqual(['Layer 1']);
    expect(editor.sprite.layers[0]?.buffer.get(1, 1)).toBe(RED);
    editor.redo();
    editor.redo();
    editor.redo();
    expect(layerNames(editor)).toEqual(['Layer 1', 'Layer 2']);
  });

  it('refuses to delete the last layer and says why', () => {
    const editor = createEditor();
    const blocked = record(editor, 'actionBlocked');
    editor.deleteLayer();
    expect(editor.sprite.layers).toHaveLength(1);
    expect(blocked).toEqual([{ reason: 'single-layer' }]);
    expect(editor.canUndo).toBe(false);
  });

  it('restores a deleted layer with its pixels', () => {
    const editor = createEditor();
    editor.addLayer();
    paint(editor, 3, 3, BLUE);
    const id = editor.activeLayer.id;
    editor.deleteLayer(id);
    editor.undo();
    expect(editor.activeLayer.id).toBe(id);
    expect(editor.activeLayer.buffer.get(3, 3)).toBe(BLUE);
  });

  it('renames, reorders, hides and locks layers', () => {
    const editor = createEditor();
    editor.addLayer();
    const [bottom, top] = editor.sprite.layers;
    if (!bottom || !top) throw new Error('layers');

    editor.renameLayer(bottom.id, 'Background');
    editor.moveLayer(bottom.id, 1);
    editor.setLayerVisible(top.id, false);
    editor.setLayerLocked(top.id, true);
    expect(layerNames(editor)).toEqual(['Layer 2', 'Background']);
    const changed = editor.sprite.layers[0];
    expect(changed).toMatchObject({ visible: false, locked: true });

    editor.undo();
    editor.undo();
    editor.undo();
    editor.undo();
    expect(layerNames(editor)).toEqual(['Layer 1', 'Layer 2']);
    expect(editor.sprite.layers[1]).toMatchObject({ visible: true, locked: false });
  });

  it('does not record a step when nothing changes', () => {
    const editor = createEditor();
    editor.renameLayer(editor.activeLayer.id, 'Layer 1');
    editor.setLayerVisible(editor.activeLayer.id, true);
    editor.moveLayer(editor.activeLayer.id, 0);
    expect(editor.canUndo).toBe(false);
  });

  it('keeps the active layer selection out of the history', () => {
    const editor = createEditor();
    const firstId = editor.activeLayer.id;
    editor.addLayer();
    editor.setActiveLayer(firstId);
    expect(editor.activeLayer.id).toBe(firstId);
    editor.undo();
    expect(layerNames(editor)).toEqual(['Layer 1']);
  });

  it('announces layer and dirty-area changes', () => {
    const editor = createEditor();
    const layers = record(editor, 'layersChanged');
    const dirty = record(editor, 'documentChanged');
    editor.addLayer();
    expect(layers).toHaveLength(1);
    expect(layers[0]?.sprite.layers).toHaveLength(2);
    expect(dirty.at(-1)).toEqual({ dirty: { x: 0, y: 0, width: 8, height: 8 } });
    editor.undo();
    expect(layers).toHaveLength(2);
  });
});

describe('layer opacity', () => {
  it('previews live and records a single step from the starting value', () => {
    const editor = createEditor();
    const id = editor.activeLayer.id;
    editor.previewLayerOpacity(id, 0.8);
    editor.previewLayerOpacity(id, 0.5);
    editor.previewLayerOpacity(id, 0.3);
    expect(editor.activeLayer.opacity).toBe(0.3);
    expect(editor.canUndo).toBe(false);

    editor.setLayerOpacity(id, 0.3);
    expect(editor.canUndo).toBe(true);
    editor.undo();
    expect(editor.activeLayer.opacity).toBe(1);
    expect(editor.canUndo).toBe(false);
    editor.redo();
    expect(editor.activeLayer.opacity).toBe(0.3);
  });

  it('records a step for a direct change without preview', () => {
    const editor = createEditor();
    editor.setLayerOpacity(editor.activeLayer.id, 0.4);
    expect(editor.activeLayer.opacity).toBe(0.4);
    editor.undo();
    expect(editor.activeLayer.opacity).toBe(1);
  });

  it('records nothing when the preview ends where it started', () => {
    const editor = createEditor();
    const id = editor.activeLayer.id;
    editor.previewLayerOpacity(id, 0.5);
    editor.previewLayerOpacity(id, 1);
    editor.setLayerOpacity(id, 1);
    expect(editor.canUndo).toBe(false);
    editor.previewLayerOpacity('nope', 0.5);
  });
});

describe('merge down and flatten', () => {
  it('merges the active layer into the one below and undoes pixels and structure together', () => {
    const editor = createEditor();
    paint(editor, 0, 0, RED);
    editor.addLayer();
    paint(editor, 1, 0, BLUE);
    paint(editor, 0, 0, BLUE);

    editor.mergeDown();
    expect(editor.sprite.layers).toHaveLength(1);
    expect(editor.activeLayer.buffer.get(0, 0)).toBe(BLUE);
    expect(editor.activeLayer.buffer.get(1, 0)).toBe(BLUE);

    editor.undo();
    expect(editor.sprite.layers).toHaveLength(2);
    expect(editor.sprite.layers[0]?.buffer.get(0, 0)).toBe(RED);
    expect(editor.sprite.layers[0]?.buffer.get(1, 0)).toBe(0);
    editor.redo();
    expect(editor.activeLayer.buffer.get(1, 0)).toBe(BLUE);
  });

  it('applies the upper layer opacity when merging', () => {
    const editor = createEditor();
    editor.addLayer();
    paint(editor, 2, 2, RED);
    editor.setLayerOpacity(editor.activeLayer.id, 0.5);
    editor.mergeDown();
    expect(editor.activeLayer.buffer.get(2, 2) >>> 24).toBe(128);
  });

  it('just removes a hidden upper layer and blocks merging into locked or hidden ones', () => {
    const editor = createEditor();
    editor.addLayer();
    paint(editor, 2, 2, RED);
    editor.setLayerVisible(editor.activeLayer.id, false);
    editor.mergeDown();
    expect(editor.activeLayer.buffer.get(2, 2)).toBe(0);
    expect(editor.sprite.layers).toHaveLength(1);

    editor.addLayer();
    const lowerId = editor.sprite.layers[0]?.id ?? '';
    editor.setLayerLocked(lowerId, true);
    const blocked = record(editor, 'actionBlocked');
    editor.mergeDown();
    expect(blocked).toEqual([{ reason: 'layer-locked' }]);
    expect(editor.sprite.layers).toHaveLength(2);

    editor.setLayerLocked(lowerId, false);
    editor.setLayerVisible(lowerId, false);
    editor.mergeDown();
    expect(blocked.at(-1)).toEqual({ reason: 'layer-hidden' });
  });

  it('cannot merge the bottom layer', () => {
    const editor = createEditor();
    const blocked = record(editor, 'actionBlocked');
    editor.mergeDown();
    expect(blocked).toEqual([{ reason: 'single-layer' }]);
  });

  it('flattens visible layers into one and brings everything back on undo', () => {
    const editor = createEditor();
    paint(editor, 0, 0, RED);
    editor.addLayer();
    paint(editor, 1, 1, BLUE);
    editor.addLayer();
    paint(editor, 2, 2, RED);
    editor.setLayerVisible(editor.activeLayer.id, false);

    editor.flatten();
    expect(editor.sprite.layers).toHaveLength(1);
    expect(editor.activeLayer.buffer.get(0, 0)).toBe(RED);
    expect(editor.activeLayer.buffer.get(1, 1)).toBe(BLUE);
    expect(editor.activeLayer.buffer.get(2, 2)).toBe(0);

    editor.undo();
    expect(editor.sprite.layers).toHaveLength(3);
    expect(editor.sprite.layers[2]?.buffer.get(2, 2)).toBe(RED);
  });

  it('does nothing to a single layer', () => {
    const editor = createEditor();
    editor.flatten();
    expect(editor.canUndo).toBe(false);
  });
});

describe('selection', () => {
  it('previews live, records on commit and undoes', () => {
    const editor = createEditor();
    const events = record(editor, 'selectionChanged');
    editor.previewSelection({ x: 1, y: 1, width: 2, height: 2 });
    editor.previewSelection({ x: 1, y: 1, width: 4, height: 3 });
    expect(editor.canUndo).toBe(false);
    editor.commitSelection(null);

    expect(editor.selection).toEqual({ x: 1, y: 1, width: 4, height: 3 });
    expect(events).toHaveLength(2);
    editor.undo();
    expect(editor.selection).toBeNull();
    editor.redo();
    expect(editor.selection).toEqual({ x: 1, y: 1, width: 4, height: 3 });
  });

  it('clips the selection to the canvas', () => {
    const editor = createEditor();
    editor.previewSelection({ x: -3, y: 6, width: 10, height: 10 });
    expect(editor.selection).toEqual({ x: 0, y: 6, width: 7, height: 2 });
    editor.previewSelection({ x: 20, y: 20, width: 2, height: 2 });
    expect(editor.selection).toBeNull();
  });

  it('selects all and deselects, each undoable, and ignores no-ops', () => {
    const editor = createEditor();
    editor.deselect();
    expect(editor.canUndo).toBe(false);
    editor.selectAll();
    expect(editor.selection).toEqual({ x: 0, y: 0, width: 8, height: 8 });
    editor.selectAll();
    editor.deselect();
    expect(editor.selection).toBeNull();
    editor.undo();
    expect(editor.selection).not.toBeNull();
    editor.undo();
    expect(editor.selection).toBeNull();
  });
});

describe('copy, cut, delete and paste', () => {
  function withSelection(): DocumentEditor {
    const editor = createEditor();
    paint(editor, 2, 2, RED);
    paint(editor, 3, 2, BLUE);
    editor.previewSelection({ x: 2, y: 2, width: 2, height: 2 });
    editor.commitSelection(null);
    return editor;
  }

  it('copies the selected pixels of the active layer without changing the document', () => {
    const editor = withSelection();
    const copied = editor.copySelection();
    expect(copied?.width).toBe(2);
    expect(copied?.get(0, 0)).toBe(RED);
    expect(copied?.get(1, 0)).toBe(BLUE);
    expect(editor.activeLayer.buffer.get(2, 2)).toBe(RED);
    expect(editor.hasClipboard).toBe(true);
  });

  it('reports when there is nothing to copy', () => {
    const editor = createEditor();
    const blocked = record(editor, 'actionBlocked');
    expect(editor.copySelection()).toBeNull();
    editor.deleteSelection();
    expect(blocked).toEqual([{ reason: 'nothing-selected' }, { reason: 'nothing-selected' }]);
  });

  it('deletes the selection as one undoable step', () => {
    const editor = withSelection();
    editor.deleteSelection();
    expect(editor.activeLayer.buffer.get(2, 2)).toBe(0);
    expect(editor.activeLayer.buffer.get(3, 2)).toBe(0);
    editor.undo();
    expect(editor.activeLayer.buffer.get(2, 2)).toBe(RED);
  });

  it('cuts: copies then deletes', () => {
    const editor = withSelection();
    const cut = editor.cutSelection();
    expect(cut?.get(0, 0)).toBe(RED);
    expect(editor.activeLayer.buffer.get(2, 2)).toBe(0);
  });

  it('refuses to edit a locked or hidden layer', () => {
    const editor = withSelection();
    const blocked = record(editor, 'actionBlocked');
    editor.setLayerLocked(editor.activeLayer.id, true);
    editor.deleteSelection();
    expect(blocked.at(-1)).toEqual({ reason: 'layer-locked' });
    expect(editor.activeLayer.buffer.get(2, 2)).toBe(RED);
    editor.setLayerLocked(editor.activeLayer.id, false);
    editor.setLayerVisible(editor.activeLayer.id, false);
    editor.deleteSelection();
    expect(blocked.at(-1)).toEqual({ reason: 'layer-hidden' });
    expect(editor.liftSelection()).toBe(false);
  });

  it('pastes the clipboard as floating content and drops it in one step', () => {
    const editor = withSelection();
    editor.copySelection();
    expect(editor.paste({ x: 6, y: 6 })).toBe(true);

    const floating = editor.floating;
    expect(floating).toMatchObject({ x: 5, y: 5 });
    expect(editor.selection).toEqual({ x: 5, y: 5, width: 2, height: 2 });
    expect(editor.activeLayer.buffer.get(5, 5)).toBe(0);

    editor.moveFloatingTo(0, 4);
    editor.commitFloating();
    expect(editor.floating).toBeNull();
    expect(editor.activeLayer.buffer.get(0, 4)).toBe(RED);
    expect(editor.activeLayer.buffer.get(1, 4)).toBe(BLUE);
    expect(editor.selection).toEqual({ x: 0, y: 4, width: 2, height: 2 });

    editor.undo();
    expect(editor.activeLayer.buffer.get(0, 4)).toBe(0);
    expect(editor.selection).toEqual({ x: 2, y: 2, width: 2, height: 2 });
    editor.redo();
    expect(editor.activeLayer.buffer.get(1, 4)).toBe(BLUE);
  });

  it('clips pasted content that hangs off the canvas', () => {
    const editor = withSelection();
    editor.copySelection();
    editor.paste({ x: 0, y: 0 });
    editor.moveFloatingTo(-1, -1);
    editor.commitFloating();
    expect(editor.activeLayer.buffer.get(0, 0)).toBe(0);
    expect(editor.selection).toEqual({ x: 0, y: 0, width: 1, height: 1 });
  });

  it('cancels a paste without a trace', () => {
    const editor = withSelection();
    editor.copySelection();
    editor.paste({ x: 6, y: 6 });
    editor.cancelFloating();
    expect(editor.floating).toBeNull();
    expect(editor.selection).toEqual({ x: 2, y: 2, width: 2, height: 2 });
    expect(editor.activeLayer.buffer.get(5, 5)).toBe(0);
  });

  it('pastes an external image', () => {
    const editor = createEditor();
    const image = PixelBuffer.create(2, 1);
    image.fill(BLUE);
    expect(editor.pasteBuffer(image, { x: 4, y: 4 })).toBe(true);
    editor.commitFloating();
    expect(editor.activeLayer.buffer.get(3, 4)).toBe(BLUE);
    expect(editor.paste({ x: 0, y: 0 })).toBe(true);
  });

  it('cannot paste with an empty clipboard', () => {
    expect(createEditor().paste({ x: 1, y: 1 })).toBe(false);
  });

  it('blends translucent pasted pixels over existing ones', () => {
    const editor = createEditor();
    paint(editor, 4, 4, RED);
    const image = PixelBuffer.create(1, 1);
    image.fill(packRgba(0, 0, 255, 128));
    editor.pasteBuffer(image, { x: 4.5, y: 4.5 });
    editor.commitFloating();
    const mixed = editor.activeLayer.buffer.get(4, 4);
    expect(mixed >>> 24).toBe(255);
    expect(mixed).not.toBe(RED);
  });
});

describe('moving content', () => {
  function setup(): DocumentEditor {
    const editor = createEditor();
    paint(editor, 1, 1, RED);
    paint(editor, 2, 1, BLUE);
    editor.previewSelection({ x: 1, y: 1, width: 2, height: 1 });
    editor.commitSelection(null);
    return editor;
  }

  it('lifts the selection, erasing the source, and drops it elsewhere in one step', () => {
    const editor = setup();
    expect(editor.liftSelection()).toBe(true);
    expect(editor.activeLayer.buffer.get(1, 1)).toBe(0);
    expect(editor.floating?.pixels.get(0, 0)).toBe(RED);

    editor.moveFloatingTo(4, 5);
    expect(editor.selection).toEqual({ x: 4, y: 5, width: 2, height: 1 });
    editor.commitFloating();

    expect(editor.activeLayer.buffer.get(4, 5)).toBe(RED);
    expect(editor.activeLayer.buffer.get(5, 5)).toBe(BLUE);
    expect(editor.activeLayer.buffer.get(1, 1)).toBe(0);

    editor.undo();
    expect(editor.activeLayer.buffer.get(1, 1)).toBe(RED);
    expect(editor.activeLayer.buffer.get(2, 1)).toBe(BLUE);
    expect(editor.activeLayer.buffer.get(4, 5)).toBe(0);
    expect(editor.selection).toEqual({ x: 1, y: 1, width: 2, height: 1 });
    // The earlier "select" step is still there; the whole move was a single step.
    editor.undo();
    expect(editor.selection).toBeNull();
    expect(editor.canUndo).toBe(false);
  });

  it('cancel puts the content back where it was', () => {
    const editor = setup();
    editor.liftSelection();
    editor.moveFloatingTo(5, 5);
    editor.cancelFloating();
    expect(editor.activeLayer.buffer.get(1, 1)).toBe(RED);
    expect(editor.selection).toEqual({ x: 1, y: 1, width: 2, height: 1 });
    expect(editor.floating).toBeNull();
  });

  it('undo while content is floating cancels the move instead of undoing earlier work', () => {
    const editor = setup();
    editor.liftSelection();
    editor.undo();
    expect(editor.floating).toBeNull();
    expect(editor.activeLayer.buffer.get(1, 1)).toBe(RED);
    expect(editor.canUndo).toBe(true);
  });

  it('nudges, lifting first when needed', () => {
    const editor = setup();
    editor.nudge(1, 0);
    editor.nudge(1, 1);
    expect(editor.floating).toMatchObject({ x: 3, y: 2 });
    editor.commitFloating();
    expect(editor.activeLayer.buffer.get(3, 2)).toBe(RED);
  });

  it('moves the whole layer when nothing is selected, and leaves no selection', () => {
    const editor = setup();
    editor.deselect();
    editor.nudge(2, 3);
    expect(editor.selection).toBeNull();
    editor.commitFloating();
    expect(editor.activeLayer.buffer.get(3, 4)).toBe(RED);
    expect(editor.activeLayer.buffer.get(1, 1)).toBe(0);
    expect(editor.selection).toBeNull();
  });

  it('loses pixels moved off the canvas', () => {
    const editor = setup();
    editor.deselect();
    editor.nudge(7, 0);
    editor.commitFloating();
    const painted = [...editor.activeLayer.buffer.data].filter((value) => value !== 0);
    expect(painted).toHaveLength(0);
  });

  it('commits floating content before any structural change', () => {
    const editor = setup();
    editor.nudge(0, 2);
    editor.addLayer();
    expect(editor.floating).toBeNull();
    expect(editor.sprite.layers[0]?.buffer.get(1, 3)).toBe(RED);
  });

  it('delete on lifted content leaves the source erased as a Delete step', () => {
    const editor = setup();
    editor.liftSelection();
    editor.deleteSelection();
    expect(editor.floating).toBeNull();
    expect(editor.activeLayer.buffer.get(1, 1)).toBe(0);
    editor.undo();
    expect(editor.activeLayer.buffer.get(1, 1)).toBe(RED);
  });

  it('delete on pasted content discards it', () => {
    const editor = setup();
    editor.copySelection();
    editor.paste({ x: 6, y: 6 });
    editor.deleteSelection();
    expect(editor.floating).toBeNull();
    expect(editor.activeLayer.buffer.get(6, 6)).toBe(0);
  });

  it('copy while floating copies the floating content', () => {
    const editor = setup();
    editor.nudge(0, 3);
    const copied = editor.copySelection();
    expect(copied?.get(0, 0)).toBe(RED);
  });

  it('does nothing when asked to move an unknown floating or to nudge a locked layer', () => {
    const editor = setup();
    editor.moveFloatingTo(3, 3);
    editor.setLayerLocked(editor.activeLayer.id, true);
    editor.nudge(1, 1);
    expect(editor.floating).toBeNull();
    editor.commitFloating();
    editor.cancelFloating();
  });
});

describe('palette with history', () => {
  const GREEN = packRgba(0, 255, 0, 255);

  it('adds, edits, reorders and removes colors, undoing every step', () => {
    const editor = createEditor();
    expect(editor.addPaletteColor(RED, 'Red')).toBe(true);
    editor.addPaletteColor(BLUE);
    editor.addPaletteColor(GREEN);
    editor.movePaletteColor(0, 2);
    editor.renamePaletteColor(0, 'Water');
    editor.setPaletteColor(1, packRgba(250, 0, 0, 255));
    editor.removePaletteColor(2);
    editor.renamePalette('Mine');

    const names = (): (string | undefined)[] => editor.palette.colors.map((c) => c.name);
    expect(editor.palette.name).toBe('Mine');
    expect(editor.palette.colors.map((c) => c.color)).toEqual([BLUE, packRgba(250, 0, 0, 255)]);
    // After the move the order is Blue, Green, Red. Green became (250,0,0) and Red was removed.
    expect(names()).toEqual(['Water', undefined]);

    for (let i = 0; i < 8; i++) editor.undo();
    expect(editor.palette.colors).toEqual([]);
    expect(editor.palette.name).toBe('Palette');
    for (let i = 0; i < 8; i++) editor.redo();
    expect(editor.palette.name).toBe('Mine');
    expect(names()).toEqual(['Water', undefined]);
  });

  it('refuses duplicates and a full palette, saying why', () => {
    const editor = createEditor();
    const blocked = record(editor, 'actionBlocked');
    editor.addPaletteColor(RED);
    expect(editor.addPaletteColor(RED)).toBe(false);
    for (let i = 0; i < 255; i++) editor.addPaletteColor(packRgba(i, 1, 2, 255));
    expect(editor.addPaletteColor(packRgba(77, 77, 77, 255))).toBe(false);
    expect(blocked.map((b) => b.reason)).toEqual(['color-in-palette', 'palette-full']);
  });

  it('announces palette changes without redrawing the canvas or touching layers', () => {
    const editor = createEditor();
    const palettes = record(editor, 'paletteChanged');
    const layers = record(editor, 'layersChanged');
    const dirty = record(editor, 'documentChanged');
    editor.addPaletteColor(RED);
    editor.undo();
    expect(palettes).toHaveLength(2);
    expect(layers).toHaveLength(0);
    expect(dirty).toHaveLength(0);
  });

  it('loads a palette in one step and appends new colors to the current one', () => {
    const editor = createEditor();
    editor.addPaletteColor(RED);
    editor.loadPalette('Preset', [{ color: BLUE, name: 'Blue' }, { color: GREEN }]);
    expect(editor.palette.name).toBe('Preset');
    expect(editor.palette.colors.map((c) => c.color)).toEqual([BLUE, GREEN]);
    editor.appendPaletteColors([{ color: RED }, { color: BLUE }]);
    expect(editor.palette.colors.map((c) => c.color)).toEqual([BLUE, GREEN, RED]);
    editor.undo();
    editor.undo();
    expect(editor.palette.colors.map((c) => c.color)).toEqual([RED]);
  });

  it('survives layer operations and starts empty for a new sprite', () => {
    const editor = createEditor();
    editor.addPaletteColor(RED);
    editor.addLayer();
    editor.flatten();
    expect(editor.palette.colors).toHaveLength(1);

    const ids = createSequentialIdGenerator('n');
    const fresh = createSprite({ width: 4, height: 4 }, ids);
    if (!fresh.ok) throw new Error('sprite');
    const palettes = record(editor, 'paletteChanged');
    editor.replaceSprite(fresh.value);
    expect(editor.palette.colors).toEqual([]);
    expect(palettes).toHaveLength(1);
  });

  it('drops floating content first, like any other edit', () => {
    const editor = createEditor();
    paint(editor, 1, 1, RED);
    editor.nudge(1, 1);
    editor.addPaletteColor(BLUE);
    expect(editor.floating).toBeNull();
  });
});

describe('replaceColor', () => {
  const GREEN = packRgba(0, 255, 0, 255);

  it('replaces the color on every layer in one undoable step', () => {
    const editor = createEditor();
    paint(editor, 0, 0, RED);
    paint(editor, 1, 0, BLUE);
    editor.addLayer();
    paint(editor, 2, 2, RED);
    editor.setLayerVisible(editor.activeLayer.id, false);

    expect(editor.replaceColor(RED, GREEN)).toBe(2);
    expect(editor.sprite.layers[0]?.buffer.get(0, 0)).toBe(GREEN);
    expect(editor.sprite.layers[0]?.buffer.get(1, 0)).toBe(BLUE);
    expect(editor.sprite.layers[1]?.buffer.get(2, 2)).toBe(GREEN);

    editor.undo();
    expect(editor.sprite.layers[0]?.buffer.get(0, 0)).toBe(RED);
    expect(editor.sprite.layers[1]?.buffer.get(2, 2)).toBe(RED);
    editor.redo();
    expect(editor.sprite.layers[1]?.buffer.get(2, 2)).toBe(GREEN);
  });

  it('only matches the exact color, alpha included', () => {
    const editor = createEditor();
    paint(editor, 0, 0, RED);
    paint(editor, 1, 0, packRgba(255, 0, 0, 128));
    expect(editor.replaceColor(RED, BLUE)).toBe(1);
    expect(editor.activeLayer.buffer.get(1, 0)).toBe(packRgba(255, 0, 0, 128));
  });

  it('stays inside the selection when there is one', () => {
    const editor = createEditor();
    paint(editor, 0, 0, RED);
    paint(editor, 5, 5, RED);
    editor.previewSelection({ x: 4, y: 4, width: 3, height: 3 });
    editor.commitSelection(null);
    expect(editor.replaceColor(RED, BLUE)).toBe(1);
    expect(editor.activeLayer.buffer.get(0, 0)).toBe(RED);
    expect(editor.activeLayer.buffer.get(5, 5)).toBe(BLUE);
  });

  it('skips locked layers', () => {
    const editor = createEditor();
    paint(editor, 0, 0, RED);
    editor.addLayer();
    paint(editor, 1, 1, RED);
    editor.setLayerLocked(editor.sprite.layers[0]?.id ?? '', true);
    expect(editor.replaceColor(RED, BLUE)).toBe(1);
    expect(editor.sprite.layers[0]?.buffer.get(0, 0)).toBe(RED);
    expect(editor.sprite.layers[1]?.buffer.get(1, 1)).toBe(BLUE);
  });

  it('records nothing when the color is absent or unchanged', () => {
    const editor = createEditor();
    paint(editor, 0, 0, RED);
    expect(editor.replaceColor(BLUE, GREEN)).toBe(0);
    expect(editor.replaceColor(RED, RED)).toBe(0);
    expect(editor.canUndo).toBe(false);
  });

  it('reports the changed area to the renderer', () => {
    const editor = createEditor();
    paint(editor, 2, 3, RED);
    paint(editor, 5, 6, RED);
    const dirty = record(editor, 'documentChanged');
    editor.replaceColor(RED, BLUE);
    expect(dirty.at(-1)).toEqual({ dirty: { x: 2, y: 3, width: 4, height: 4 } });
  });
});

describe('document lifecycle', () => {
  it('replacing the sprite resets layers, selection, floating content and history', () => {
    const editor = createEditor();
    editor.addLayer();
    editor.selectAll();
    editor.nudge(1, 1);
    const ids = createSequentialIdGenerator('n');
    const fresh = createSprite({ width: 4, height: 4 }, ids);
    if (!fresh.ok) throw new Error('sprite');
    const replaced = record(editor, 'spriteReplaced');

    editor.replaceSprite(fresh.value);

    expect(replaced).toHaveLength(1);
    expect(editor.sprite.width).toBe(4);
    expect(editor.floating).toBeNull();
    expect(editor.selection).toBeNull();
    expect(editor.canUndo).toBe(false);
  });

  it('samples the visible color at a point', () => {
    const editor = createEditor();
    paint(editor, 1, 1, RED);
    editor.addLayer();
    paint(editor, 1, 1, BLUE);
    expect(editor.sampleColor(1, 1)).toBe(BLUE);
    editor.setLayerVisible(editor.activeLayer.id, false);
    expect(editor.sampleColor(1, 1)).toBe(RED);
  });

  it('counts retained layer buffers against the history budget', () => {
    const ids = createSequentialIdGenerator();
    const sprite = createSprite({ width: 64, height: 64 }, ids);
    if (!sprite.ok) throw new Error('sprite');
    const editor = new DocumentEditor(sprite.value, ids, 100_000);
    for (let i = 0; i < 10; i++) editor.addLayer();
    expect(editor.historyBytes).toBeLessThanOrEqual(100_000);
  });
});
