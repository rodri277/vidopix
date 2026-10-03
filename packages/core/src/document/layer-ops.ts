import { PixelBuffer } from '../domain/pixel-buffer.js';
import type { Layer } from '../domain/sprite.js';
import type { IdGenerator } from '../ports/id-generator.js';
import { findLayer, withLayers, type DocumentState } from './document-state.js';

export const MAX_LAYERS = 64;

export interface LayerProps {
  readonly visible?: boolean;
  readonly locked?: boolean;
  readonly opacity?: number;
}

/**
 * Pure layer edits. Each returns the new document state, or the same object when the request
 * changes nothing. Index 0 is the bottom layer.
 */

function nextLayerName(layers: readonly Layer[]): string {
  const taken = new Set(layers.map((layer) => layer.name));
  for (let n = layers.length + 1; ; n++) {
    const name = `Layer ${String(n)}`;
    if (!taken.has(name)) return name;
  }
}

function indexOf(state: DocumentState, id: string): number {
  return state.sprite.layers.findIndex((layer) => layer.id === id);
}

export function addLayer(state: DocumentState, ids: IdGenerator): DocumentState {
  const { layers, width, height } = state.sprite;
  if (layers.length >= MAX_LAYERS) return state;
  const cels = state.sprite.frames.map(() => PixelBuffer.create(width, height));
  const layer: Layer = {
    id: ids.next(),
    name: nextLayerName(layers),
    visible: true,
    locked: false,
    opacity: 1,
    blendMode: 'normal',
    buffer: cels[state.activeFrame] ?? PixelBuffer.create(width, height),
    cels,
  };
  const above = indexOf(state, state.activeLayerId) + 1;
  const next = [...layers.slice(0, above), layer, ...layers.slice(above)];
  return withLayers(state, next, layer.id);
}

export function duplicateLayer(state: DocumentState, id: string, ids: IdGenerator): DocumentState {
  const { layers } = state.sprite;
  const index = indexOf(state, id);
  const source = layers[index];
  if (!source || layers.length >= MAX_LAYERS) return state;
  const cels = source.cels.map((cel) => cel.clone());
  const copy: Layer = {
    ...source,
    id: ids.next(),
    name: `${source.name} copy`,
    buffer: cels[state.activeFrame] ?? source.buffer.clone(),
    cels,
  };
  const next = [...layers.slice(0, index + 1), copy, ...layers.slice(index + 1)];
  return withLayers(state, next, copy.id);
}

export function deleteLayer(state: DocumentState, id: string): DocumentState {
  const { layers } = state.sprite;
  const index = indexOf(state, id);
  if (index < 0 || layers.length <= 1) return state;
  const next = layers.filter((layer) => layer.id !== id);
  const wasActive = state.activeLayerId === id;
  const neighbor = next[Math.max(0, index - 1)];
  return withLayers(state, next, wasActive && neighbor ? neighbor.id : state.activeLayerId);
}

export function renameLayer(state: DocumentState, id: string, name: string): DocumentState {
  const trimmed = name.trim().slice(0, 60);
  const layer = findLayer(state, id);
  if (!layer || trimmed === '' || trimmed === layer.name) return state;
  return replaceLayer(state, { ...layer, name: trimmed });
}

export function setLayerProps(state: DocumentState, id: string, props: LayerProps): DocumentState {
  const layer = findLayer(state, id);
  if (!layer) return state;
  const opacity =
    props.opacity === undefined ? layer.opacity : Math.min(1, Math.max(0, props.opacity));
  const updated: Layer = {
    ...layer,
    visible: props.visible ?? layer.visible,
    locked: props.locked ?? layer.locked,
    opacity,
  };
  if (
    updated.visible === layer.visible &&
    updated.locked === layer.locked &&
    updated.opacity === layer.opacity
  ) {
    return state;
  }
  return replaceLayer(state, updated);
}

/** Moves a layer so it ends up at `toIndex` (clamped), counting from the bottom. */
export function moveLayer(state: DocumentState, id: string, toIndex: number): DocumentState {
  const { layers } = state.sprite;
  const from = indexOf(state, id);
  const target = Math.min(layers.length - 1, Math.max(0, Math.round(toIndex)));
  const moving = layers[from];
  if (!moving || from === target) return state;
  const without = layers.filter((layer) => layer.id !== id);
  const next = [...without.slice(0, target), moving, ...without.slice(target)];
  return withLayers(state, next);
}

export function setActiveLayer(state: DocumentState, id: string): DocumentState {
  if (id === state.activeLayerId || !findLayer(state, id)) return state;
  return { ...state, activeLayerId: id };
}

function replaceLayer(state: DocumentState, layer: Layer): DocumentState {
  return withLayers(
    state,
    state.sprite.layers.map((existing) => (existing.id === layer.id ? layer : existing)),
  );
}
