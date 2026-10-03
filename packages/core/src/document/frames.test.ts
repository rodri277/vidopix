import { describe, expect, it } from 'vitest';
import { packRgba } from '../domain/color.js';
import { createSprite, MAX_FRAMES } from '../domain/sprite.js';
import { PatchRecorder } from '../history/patch-recorder.js';
import { createSequentialIdGenerator } from '../ports/id-generator.js';
import { DocumentEditor, type DocumentEvents } from './document-editor.js';
import type { DocumentState } from './document-state.js';
import {
  addFrame,
  canGrow,
  clampDuration,
  deleteFrame,
  duplicateFrame,
  moveFrame,
  setActiveFrame,
  setAllFrameDurations,
  setFrameDuration,
  spriteBytes,
  MAX_SPRITE_BYTES,
} from './frame-ops.js';

const RED = packRgba(255, 0, 0, 255);
const BLUE = packRgba(0, 0, 255, 255);
const GREEN = packRgba(0, 255, 0, 255);

function setup(size = 4): {
  state: DocumentState;
  ids: ReturnType<typeof createSequentialIdGenerator>;
} {
  const ids = createSequentialIdGenerator();
  const sprite = createSprite({ width: size, height: size }, ids);
  if (!sprite.ok) throw new Error('sprite');
  const first = sprite.value.layers[0];
  if (!first) throw new Error('layer');
  return {
    state: { sprite: sprite.value, activeLayerId: first.id, activeFrame: 0, selection: null },
    ids,
  };
}

const durations = (state: DocumentState): number[] => state.sprite.frames.map((f) => f.duration);

function createEditor(size = 8): DocumentEditor {
  const ids = createSequentialIdGenerator();
  const sprite = createSprite({ width: size, height: size }, ids);
  if (!sprite.ok) throw new Error('sprite');
  return new DocumentEditor(sprite.value, ids);
}

function log<K extends keyof DocumentEvents>(
  editor: DocumentEditor,
  event: K,
): DocumentEvents[K][] {
  const entries: DocumentEvents[K][] = [];
  editor.events.on(event, (payload) => entries.push(payload));
  return entries;
}

/** Draws one pixel through the history, as a tool does. */
function stroke(editor: DocumentEditor, x: number, y: number, color: number): void {
  const recorder = new PatchRecorder(editor.activeLayer.buffer);
  recorder.setPixel(x, y, color);
  editor.commitPixels('Pencil', recorder.finish());
}

describe('clampDuration', () => {
  it('rounds to 10 ms and stays within the limits', () => {
    expect(clampDuration(104)).toBe(100);
    expect(clampDuration(105)).toBe(110);
    expect(clampDuration(0)).toBe(20);
    expect(clampDuration(1_000_000)).toBe(10_000);
    expect(clampDuration(Number.NaN)).toBe(100);
    expect(clampDuration(Number.POSITIVE_INFINITY)).toBe(100);
  });
});

describe('new sprites', () => {
  it('start with one 100 ms frame and a cel per layer', () => {
    const { state } = setup();
    expect(state.sprite.frames).toHaveLength(1);
    expect(durations(state)).toEqual([100]);
    const [layer] = state.sprite.layers;
    expect(layer?.cels).toHaveLength(1);
    expect(layer?.buffer).toBe(layer?.cels[0]);
  });
});

describe('addFrame', () => {
  it('inserts an empty frame after the active one and makes it active', () => {
    const { state, ids } = setup();
    const withTwo = addFrame(state, ids);
    const withThree = addFrame(setActiveFrame(withTwo, 0), ids);
    expect(withTwo.activeFrame).toBe(1);
    expect(withThree.activeFrame).toBe(1);
    expect(withThree.sprite.frames).toHaveLength(3);
    for (const layer of withThree.sprite.layers) {
      expect(layer.cels).toHaveLength(3);
      expect(layer.buffer).toBe(layer.cels[1]);
      expect(layer.buffer.data.every((v) => v === 0)).toBe(true);
    }
  });

  it('gives the new frame the duration of the frame before it', () => {
    const { state, ids } = setup();
    const slow = setFrameDuration(state, 0, 300);
    expect(durations(addFrame(slow, ids))).toEqual([300, 300]);
  });

  it('can insert after a given index and clamps the position', () => {
    const { state, ids } = setup();
    const three = addFrame(addFrame(state, ids), ids);
    const ordered = three.sprite.frames.map((f) => f.id);
    const inserted = addFrame(three, ids, 0);
    expect(inserted.sprite.frames.map((f) => f.id).filter((id) => ordered.includes(id))).toEqual(
      ordered,
    );
    expect(inserted.activeFrame).toBe(1);
    expect(addFrame(three, ids, 99).activeFrame).toBe(3);
    expect(addFrame(three, ids, -5).activeFrame).toBe(0);
  });

  it('stops at the frame limit', () => {
    const { ids } = setup(1);
    let { state } = setup(1);
    for (let i = 0; i < MAX_FRAMES + 5; i++) state = addFrame(state, ids);
    expect(state.sprite.frames).toHaveLength(MAX_FRAMES);
  });

  it('stops when the sprite would use too much memory', () => {
    const { state, ids } = setup(1024);
    let grown = state;
    for (let i = 0; i < 100; i++) grown = addFrame(grown, ids);
    expect(spriteBytes(grown)).toBeLessThanOrEqual(MAX_SPRITE_BYTES);
    expect(canGrow(grown, 0, 1)).toBe(false);
    expect(canGrow(grown, 0, 0)).toBe(true);
    expect(addFrame(grown, ids)).toBe(grown);
  });
});

describe('duplicateFrame', () => {
  it('copies every cel and the duration, placing the copy next to the original', () => {
    const { state, ids } = setup();
    const painted = setFrameDuration(state, 0, 250);
    painted.sprite.layers[0]?.cels[0]?.set(1, 2, RED);
    const copy = duplicateFrame(painted, ids);
    expect(durations(copy)).toEqual([250, 250]);
    expect(copy.activeFrame).toBe(1);
    const [layer] = copy.sprite.layers;
    expect(layer?.cels[1]?.get(1, 2)).toBe(RED);
    expect(layer?.cels[1]).not.toBe(layer?.cels[0]);
    layer?.cels[1]?.set(1, 2, BLUE);
    expect(layer?.cels[0]?.get(1, 2)).toBe(RED);
  });

  it('ignores a missing frame and the limits', () => {
    const { state, ids } = setup();
    expect(duplicateFrame(state, ids, 5)).toBe(state);
    let many = state;
    for (let i = 0; i < MAX_FRAMES; i++) many = duplicateFrame(many, ids);
    expect(many.sprite.frames).toHaveLength(MAX_FRAMES);
    expect(duplicateFrame(many, ids)).toBe(many);
  });
});

describe('deleteFrame', () => {
  it('removes the frame and its cels and keeps the active frame valid', () => {
    const { state, ids } = setup();
    const three = addFrame(addFrame(state, ids), ids);
    expect(three.activeFrame).toBe(2);
    const fewer = deleteFrame(three, 2);
    expect(fewer.sprite.frames).toHaveLength(2);
    expect(fewer.activeFrame).toBe(1);
    expect(fewer.sprite.layers[0]?.cels).toHaveLength(2);
    const earlier = deleteFrame(three, 0);
    expect(earlier.activeFrame).toBe(1);
    expect(earlier.sprite.layers[0]?.buffer).toBe(earlier.sprite.layers[0]?.cels[1]);
  });

  it('keeps at least one frame and ignores unknown indexes', () => {
    const { state, ids } = setup();
    expect(deleteFrame(state, 0)).toBe(state);
    const two = addFrame(state, ids);
    expect(deleteFrame(two, 7)).toBe(two);
  });
});

describe('moveFrame', () => {
  it('reorders frames and cels together, and the active frame follows its content', () => {
    const { state, ids } = setup();
    const three = addFrame(addFrame(state, ids), ids);
    three.sprite.layers[0]?.cels.forEach((cel, index) => {
      cel.set(0, 0, [RED, BLUE, GREEN][index] ?? 0);
    });
    const [a, b, c] = three.sprite.frames.map((f) => f.id);
    const active = setActiveFrame(three, 0);
    const moved = moveFrame(active, 0, 2);
    expect(moved.sprite.frames.map((f) => f.id)).toEqual([b, c, a]);
    expect(moved.sprite.layers[0]?.cels.map((cel) => cel.get(0, 0))).toEqual([BLUE, GREEN, RED]);
    expect(moved.activeFrame).toBe(2);
    expect(moved.sprite.layers[0]?.buffer.get(0, 0)).toBe(RED);
    const other = moveFrame(setActiveFrame(three, 1), 0, 2);
    expect(other.activeFrame).toBe(0);
  });

  it('ignores no-op and unknown moves, and clamps the target', () => {
    const { state, ids } = setup();
    const two = addFrame(state, ids);
    expect(moveFrame(two, 0, 0)).toBe(two);
    expect(moveFrame(two, 5, 0)).toBe(two);
    expect(moveFrame(two, 1, 1)).toBe(two);
    expect(moveFrame(two, 0, 99).sprite.frames.map((f) => f.id)).toEqual(
      [...two.sprite.frames].reverse().map((f) => f.id),
    );
  });
});

describe('durations', () => {
  it('sets one frame, rounding and clamping, and ignores no-ops', () => {
    const { state, ids } = setup();
    const two = addFrame(state, ids);
    expect(durations(setFrameDuration(two, 1, 333))).toEqual([100, 330]);
    expect(durations(setFrameDuration(two, 0, 1))).toEqual([20, 100]);
    expect(setFrameDuration(two, 0, 100)).toBe(two);
    expect(setFrameDuration(two, 9, 50)).toBe(two);
  });

  it('sets all of them at once', () => {
    const { state, ids } = setup();
    const two = setFrameDuration(addFrame(state, ids), 1, 500);
    expect(durations(setAllFrameDurations(two, 40))).toEqual([40, 40]);
    const same = setAllFrameDurations(two, 40);
    expect(setAllFrameDurations(same, 40)).toBe(same);
  });
});

describe('setActiveFrame', () => {
  it('points every layer at its cel and clamps the index', () => {
    const { state, ids } = setup();
    const layered = addFrame(state, ids);
    const at0 = setActiveFrame(layered, -3);
    expect(at0.activeFrame).toBe(0);
    for (const layer of at0.sprite.layers) expect(layer.buffer).toBe(layer.cels[0]);
    expect(setActiveFrame(at0, 0)).toBe(at0);
    expect(setActiveFrame(at0, 99).activeFrame).toBe(1);
  });
});

describe('frames in the editor', () => {
  it('adds, duplicates, deletes and reorders frames, each undoable', () => {
    const editor = createEditor();
    const events = log(editor, 'framesChanged');
    stroke(editor, 1, 1, RED);
    editor.addFrame();
    expect(editor.sprite.frames).toHaveLength(2);
    expect(editor.activeFrame).toBe(1);
    expect(editor.activeLayer.buffer.get(1, 1)).toBe(0);

    editor.duplicateFrame(0);
    expect(editor.sprite.frames).toHaveLength(3);
    expect(editor.activeFrame).toBe(1);
    expect(editor.activeLayer.buffer.get(1, 1)).toBe(RED);

    editor.moveFrame(1, 2);
    expect(editor.activeFrame).toBe(2);
    editor.deleteFrame();
    expect(editor.sprite.frames).toHaveLength(2);

    editor.undo();
    expect(editor.sprite.frames).toHaveLength(3);
    editor.undo();
    editor.undo();
    expect(editor.sprite.frames).toHaveLength(2);
    editor.undo();
    expect(editor.sprite.frames).toHaveLength(1);
    expect(editor.activeFrame).toBe(0);
    editor.redo();
    editor.redo();
    editor.redo();
    editor.redo();
    expect(editor.sprite.frames).toHaveLength(2);
    expect(events.at(-1)?.frames).toBe(editor.sprite.frames);
  });

  it('refuses to delete the only frame', () => {
    const editor = createEditor();
    const blocked = log(editor, 'actionBlocked');
    editor.deleteFrame();
    expect(editor.sprite.frames).toHaveLength(1);
    expect(blocked).toEqual([{ reason: 'single-frame' }]);
    expect(editor.canUndo).toBe(false);
  });

  it('says why when the frame limit or memory is reached', () => {
    const editor = createEditor(1);
    const blocked = log(editor, 'actionBlocked');
    for (let i = 0; i < MAX_FRAMES + 2; i++) editor.addFrame();
    expect(editor.sprite.frames).toHaveLength(MAX_FRAMES);
    expect(blocked.some((b) => b.reason === 'frame-limit')).toBe(true);
    editor.duplicateFrame();
    expect(blocked.filter((b) => b.reason === 'frame-limit')).toHaveLength(4);

    const big = createEditor(1024);
    const bigBlocked = log(big, 'actionBlocked');
    for (let i = 0; i < 70; i++) big.addFrame();
    expect(bigBlocked.some((b) => b.reason === 'sprite-too-large')).toBe(true);
    big.addLayer();
    big.duplicateLayer();
    expect(bigBlocked.filter((b) => b.reason === 'sprite-too-large').length).toBeGreaterThan(2);
  });

  it('switching frames is not a history step and drops floating content first', () => {
    const editor = createEditor();
    editor.addFrame();
    stroke(editor, 2, 2, BLUE);
    const history = log(editor, 'historyChanged');
    editor.setActiveFrame(0);
    expect(editor.activeFrame).toBe(0);
    expect(history).toHaveLength(0);
    editor.setActiveFrame(0);

    editor.previewSelection({ x: 0, y: 0, width: 2, height: 2 });
    editor.nudge(1, 0);
    expect(editor.floating).not.toBeNull();
    editor.setActiveFrame(1);
    expect(editor.floating).toBeNull();
    expect(editor.activeFrame).toBe(1);
  });

  it('strokes on one frame stay there and undo brings that frame back into view', () => {
    const editor = createEditor();
    stroke(editor, 0, 0, RED);
    editor.addFrame();
    stroke(editor, 3, 3, BLUE);
    editor.setActiveFrame(0);
    editor.undo();
    expect(editor.activeFrame).toBe(1);
    expect(editor.sprite.layers[0]?.cels[1]?.get(3, 3)).toBe(0);
    expect(editor.sprite.layers[0]?.cels[0]?.get(0, 0)).toBe(RED);
    editor.redo();
    expect(editor.activeFrame).toBe(1);
    expect(editor.activeLayer.buffer.get(3, 3)).toBe(BLUE);
  });

  it('keeps undo working after frames are reordered', () => {
    const editor = createEditor();
    stroke(editor, 0, 0, RED);
    editor.addFrame();
    editor.moveFrame(1, 0);
    expect(editor.activeFrame).toBe(0);
    stroke(editor, 5, 5, BLUE);
    editor.setActiveFrame(1);
    editor.undo();
    // The stroke belongs to the frame that is now first; undo shows it and removes the stroke.
    expect(editor.activeFrame).toBe(0);
    expect(editor.sprite.layers[0]?.cels[0]?.get(5, 5)).toBe(0);
    expect(editor.sprite.layers[0]?.cels[1]?.get(0, 0)).toBe(RED);
    editor.undo();
    editor.undo();
    expect(editor.sprite.frames).toHaveLength(1);
    expect(editor.sprite.layers[0]?.cels[0]?.get(0, 0)).toBe(RED);
  });

  it('retimes frames with history and without touching pixels', () => {
    const editor = createEditor();
    const documentChanges = log(editor, 'documentChanged');
    editor.addFrame();
    documentChanges.length = 0;
    editor.setFrameDuration(0, 250);
    editor.setAllFrameDurations(50);
    expect(editor.sprite.frames.map((f) => f.duration)).toEqual([50, 50]);
    expect(documentChanges).toHaveLength(0);
    editor.undo();
    expect(editor.sprite.frames.map((f) => f.duration)).toEqual([250, 100]);
    editor.undo();
    expect(editor.sprite.frames.map((f) => f.duration)).toEqual([100, 100]);
  });

  it('layer operations act on every frame', () => {
    const editor = createEditor();
    editor.addFrame();
    editor.addLayer();
    expect(editor.sprite.layers.every((l) => l.cels.length === 2)).toBe(true);
    editor.duplicateLayer();
    expect(editor.sprite.layers.every((l) => l.cels.length === 2)).toBe(true);
    editor.undo();
    editor.undo();
    expect(editor.sprite.layers[0]?.cels).toHaveLength(2);
  });

  it('merges down in every frame', () => {
    const editor = createEditor();
    stroke(editor, 0, 0, RED);
    editor.addFrame();
    stroke(editor, 1, 1, RED);
    editor.addLayer();
    stroke(editor, 2, 2, BLUE);
    editor.setActiveFrame(0);
    stroke(editor, 3, 3, BLUE);
    editor.mergeDown();
    expect(editor.sprite.layers).toHaveLength(1);
    const [layer] = editor.sprite.layers;
    expect(layer?.cels[0]?.get(0, 0)).toBe(RED);
    expect(layer?.cels[0]?.get(3, 3)).toBe(BLUE);
    expect(layer?.cels[1]?.get(1, 1)).toBe(RED);
    expect(layer?.cels[1]?.get(2, 2)).toBe(BLUE);
    editor.undo();
    expect(editor.sprite.layers).toHaveLength(2);
    expect(editor.sprite.layers[0]?.cels[1]?.get(2, 2)).toBe(0);
    expect(editor.sprite.layers[1]?.cels[1]?.get(2, 2)).toBe(BLUE);
  });

  it('flattens every frame', () => {
    const editor = createEditor();
    stroke(editor, 0, 0, RED);
    editor.addFrame();
    stroke(editor, 1, 1, RED);
    editor.addLayer();
    stroke(editor, 2, 2, BLUE);
    editor.setActiveFrame(0);
    editor.flatten();
    const [layer] = editor.sprite.layers;
    expect(editor.sprite.layers).toHaveLength(1);
    expect(layer?.cels).toHaveLength(2);
    expect(layer?.buffer).toBe(layer?.cels[0]);
    expect(layer?.cels[0]?.get(0, 0)).toBe(RED);
    expect(layer?.cels[1]?.get(2, 2)).toBe(BLUE);
    editor.undo();
    expect(editor.sprite.layers).toHaveLength(2);
    expect(editor.activeFrame).toBe(0);
  });

  it('replaces a color in every frame as one step', () => {
    const editor = createEditor();
    stroke(editor, 0, 0, RED);
    editor.addFrame();
    stroke(editor, 1, 1, RED);
    editor.addFrame();
    stroke(editor, 2, 2, RED);
    expect(editor.replaceColor(RED, GREEN)).toBe(3);
    const [layer] = editor.sprite.layers;
    expect(layer?.cels.map((c) => c.data.filter((v) => v === GREEN).length)).toEqual([1, 1, 1]);
    editor.undo();
    expect(layer?.cels.map((c) => c.data.filter((v) => v === RED).length)).toEqual([1, 1, 1]);
  });

  it('replacing a sprite starts on its first frame and reports it', () => {
    const editor = createEditor();
    const events = log(editor, 'framesChanged');
    const ids = createSequentialIdGenerator();
    const fresh = createSprite({ width: 2, height: 2 }, ids);
    if (!fresh.ok) throw new Error('sprite');
    editor.replaceSprite(fresh.value);
    expect(editor.activeFrame).toBe(0);
    expect(events.at(-1)).toEqual({ frames: fresh.value.frames, activeFrame: 0 });
  });
});
