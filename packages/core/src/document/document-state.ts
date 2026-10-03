import type { Rect } from '../domain/rect.js';
import type { Layer, Sprite } from '../domain/sprite.js';

/**
 * Everything about the document that is not pixel data: which layers exist and how they are set
 * up, which one is active, and the selection. It is replaced as a whole on every change, so
 * undo only has to swap references. Layer pixel buffers are shared between states.
 */
export interface DocumentState {
  readonly sprite: Sprite;
  readonly activeLayerId: string;
  /** Index of the frame being edited. Every layer's `buffer` is its cel for this frame. */
  readonly activeFrame: number;
  /** Selected area in document pixels, or null when nothing is selected. */
  readonly selection: Rect | null;
}

export function findLayer(state: DocumentState, id: string): Layer | undefined {
  return state.sprite.layers.find((layer) => layer.id === id);
}

export function activeLayerOf(state: DocumentState): Layer {
  const layer = findLayer(state, state.activeLayerId) ?? state.sprite.layers[0];
  if (!layer) throw new Error('A sprite always has at least one layer');
  return layer;
}

export function withLayers(
  state: DocumentState,
  layers: readonly Layer[],
  activeLayerId: string = state.activeLayerId,
): DocumentState {
  return { ...state, sprite: { ...state.sprite, layers }, activeLayerId };
}
