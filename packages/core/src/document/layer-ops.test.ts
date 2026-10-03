import { describe, expect, it } from 'vitest';
import { packRgba } from '../domain/color.js';
import { createSprite } from '../domain/sprite.js';
import { createSequentialIdGenerator } from '../ports/id-generator.js';
import { activeLayerOf, type DocumentState } from './document-state.js';
import {
  MAX_LAYERS,
  addLayer,
  deleteLayer,
  duplicateLayer,
  moveLayer,
  renameLayer,
  setActiveLayer,
  setLayerProps,
} from './layer-ops.js';

const RED = packRgba(255, 0, 0, 255);

function setup(): { state: DocumentState; ids: ReturnType<typeof createSequentialIdGenerator> } {
  const ids = createSequentialIdGenerator();
  const sprite = createSprite({ width: 4, height: 4 }, ids);
  if (!sprite.ok) throw new Error('sprite');
  const first = sprite.value.layers[0];
  if (!first) throw new Error('layer');
  return {
    state: { sprite: sprite.value, activeLayerId: first.id, activeFrame: 0, selection: null },
    ids,
  };
}

const names = (state: DocumentState): string[] => state.sprite.layers.map((layer) => layer.name);

describe('addLayer', () => {
  it('inserts an empty layer above the active one and activates it', () => {
    const { state, ids } = setup();
    const withTwo = addLayer(state, ids);
    const withThree = addLayer(setActiveLayer(withTwo, state.activeLayerId), ids);
    expect(names(withTwo)).toEqual(['Layer 1', 'Layer 2']);
    expect(names(withThree)).toEqual(['Layer 1', 'Layer 3', 'Layer 2']);
    expect(activeLayerOf(withThree).name).toBe('Layer 3');
    expect(activeLayerOf(withThree).buffer.data.every((v) => v === 0)).toBe(true);
  });

  it('stops at the maximum number of layers', () => {
    const { ids } = setup();
    let { state } = setup();
    for (let i = 0; i < MAX_LAYERS + 5; i++) state = addLayer(state, ids);
    expect(state.sprite.layers).toHaveLength(MAX_LAYERS);
  });

  it('does not reuse a name that is taken', () => {
    const { state, ids } = setup();
    const a = addLayer(state, ids);
    const b = renameLayer(a, a.activeLayerId, 'Layer 3');
    const c = addLayer(b, ids);
    expect(new Set(names(c)).size).toBe(names(c).length);
  });
});

describe('duplicateLayer', () => {
  it('copies pixels and properties into an independent layer above', () => {
    const { state, ids } = setup();
    const source = activeLayerOf(state);
    source.buffer.set(1, 1, RED);
    const result = duplicateLayer(state, source.id, ids);
    const copy = activeLayerOf(result);
    expect(copy.name).toBe('Layer 1 copy');
    expect(copy.buffer.get(1, 1)).toBe(RED);
    copy.buffer.set(1, 1, 0);
    expect(source.buffer.get(1, 1)).toBe(RED);
    expect(result.sprite.layers[1]).toBe(copy);
  });

  it('ignores unknown ids', () => {
    const { state, ids } = setup();
    expect(duplicateLayer(state, 'nope', ids)).toBe(state);
  });
});

describe('deleteLayer', () => {
  it('removes a layer and moves the active layer to its neighbor below', () => {
    const { state, ids } = setup();
    const two = addLayer(state, ids);
    const three = addLayer(two, ids);
    const result = deleteLayer(three, three.activeLayerId);
    expect(names(result)).toEqual(['Layer 1', 'Layer 2']);
    expect(activeLayerOf(result).name).toBe('Layer 2');
    const bottom = deleteLayer(two, state.activeLayerId);
    expect(names(bottom)).toEqual(['Layer 2']);
    expect(activeLayerOf(bottom).name).toBe('Layer 2');
  });

  it('keeps the active layer when another one is deleted', () => {
    const { state, ids } = setup();
    const two = addLayer(state, ids);
    const result = deleteLayer(two, state.activeLayerId);
    expect(result.activeLayerId).toBe(two.activeLayerId);
  });

  it('never deletes the last layer or an unknown one', () => {
    const { state } = setup();
    expect(deleteLayer(state, state.activeLayerId)).toBe(state);
    expect(deleteLayer(state, 'nope')).toBe(state);
  });
});

describe('renameLayer', () => {
  it('trims, limits the length and ignores empty or unchanged names', () => {
    const { state } = setup();
    const id = state.activeLayerId;
    expect(names(renameLayer(state, id, '  Background  '))).toEqual(['Background']);
    expect(renameLayer(state, id, 'a'.repeat(100)).sprite.layers[0]?.name).toHaveLength(60);
    expect(renameLayer(state, id, '   ')).toBe(state);
    expect(renameLayer(state, id, 'Layer 1')).toBe(state);
    expect(renameLayer(state, 'nope', 'x')).toBe(state);
  });
});

describe('setLayerProps', () => {
  it('changes visibility, lock and opacity, clamping opacity', () => {
    const { state } = setup();
    const id = state.activeLayerId;
    const hidden = setLayerProps(state, id, { visible: false });
    expect(activeLayerOf(hidden).visible).toBe(false);
    expect(activeLayerOf(setLayerProps(state, id, { locked: true })).locked).toBe(true);
    expect(activeLayerOf(setLayerProps(state, id, { opacity: 5 })).opacity).toBe(1);
    expect(activeLayerOf(setLayerProps(state, id, { opacity: -1 })).opacity).toBe(0);
    expect(activeLayerOf(setLayerProps(state, id, { opacity: 0.25 })).opacity).toBe(0.25);
  });

  it('returns the same state when nothing changes', () => {
    const { state } = setup();
    expect(setLayerProps(state, state.activeLayerId, { visible: true, opacity: 1 })).toBe(state);
    expect(setLayerProps(state, 'nope', { visible: false })).toBe(state);
  });

  it('shares pixel buffers with the previous state', () => {
    const { state } = setup();
    const next = setLayerProps(state, state.activeLayerId, { opacity: 0.5 });
    expect(activeLayerOf(next).buffer).toBe(activeLayerOf(state).buffer);
  });
});

describe('moveLayer', () => {
  it('reorders layers counting from the bottom and clamps the target', () => {
    const { state, ids } = setup();
    const three = addLayer(addLayer(state, ids), ids);
    const [a, b, c] = three.sprite.layers.map((layer) => layer.id);
    if (!a || !b || !c) throw new Error('layers');
    expect(moveLayer(three, a, 2).sprite.layers.map((l) => l.id)).toEqual([b, c, a]);
    expect(moveLayer(three, c, 0).sprite.layers.map((l) => l.id)).toEqual([c, a, b]);
    expect(moveLayer(three, a, 99).sprite.layers.map((l) => l.id)).toEqual([b, c, a]);
    expect(moveLayer(three, c, -5).sprite.layers.map((l) => l.id)).toEqual([c, a, b]);
  });

  it('does nothing when the layer is already there or unknown', () => {
    const { state } = setup();
    expect(moveLayer(state, state.activeLayerId, 0)).toBe(state);
    expect(moveLayer(state, 'nope', 0)).toBe(state);
  });
});

describe('setActiveLayer', () => {
  it('switches only to layers that exist', () => {
    const { state, ids } = setup();
    const two = addLayer(state, ids);
    expect(setActiveLayer(two, state.activeLayerId).activeLayerId).toBe(state.activeLayerId);
    expect(setActiveLayer(two, 'nope')).toBe(two);
    expect(setActiveLayer(two, two.activeLayerId)).toBe(two);
  });
});

describe('activeLayerOf', () => {
  it('falls back to the first layer when the active id is stale', () => {
    const { state } = setup();
    const stale = { ...state, activeLayerId: 'gone' };
    expect(activeLayerOf(stale)).toBe(state.sprite.layers[0]);
  });

  it('refuses a sprite without layers', () => {
    const { state } = setup();
    const empty = { ...state, sprite: { ...state.sprite, layers: [] } };
    expect(() => activeLayerOf(empty)).toThrow('at least one layer');
  });
});
