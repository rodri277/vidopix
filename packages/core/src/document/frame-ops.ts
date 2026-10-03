import { PixelBuffer } from '../domain/pixel-buffer.js';
import {
  DEFAULT_FRAME_DURATION,
  MAX_FRAMES,
  MAX_FRAME_DURATION,
  MIN_FRAME_DURATION,
  type Frame,
  type Layer,
} from '../domain/sprite.js';
import type { IdGenerator } from '../ports/id-generator.js';
import type { DocumentState } from './document-state.js';

/** Most memory the pixels of all frames and layers of one sprite may take. */
export const MAX_SPRITE_BYTES = 256 * 1024 * 1024;

/** Memory taken by every cel of the sprite. */
export function spriteBytes(state: DocumentState): number {
  const { width, height, layers, frames } = state.sprite;
  return width * height * 4 * layers.length * frames.length;
}

/** Whether one more layer or frame still fits in the memory budget. */
export function canGrow(state: DocumentState, extraLayers: number, extraFrames: number): boolean {
  const { width, height, layers, frames } = state.sprite;
  const bytes = width * height * 4 * (layers.length + extraLayers) * (frames.length + extraFrames);
  return bytes <= MAX_SPRITE_BYTES;
}

export function clampDuration(milliseconds: number): number {
  if (!Number.isFinite(milliseconds)) return DEFAULT_FRAME_DURATION;
  const rounded = Math.round(milliseconds / 10) * 10;
  return Math.min(MAX_FRAME_DURATION, Math.max(MIN_FRAME_DURATION, rounded));
}

/** Points every layer's `buffer` at its cel in `index`. */
export function setActiveFrame(state: DocumentState, index: number): DocumentState {
  const last = state.sprite.frames.length - 1;
  const target = Math.min(last, Math.max(0, Math.round(index)));
  if (
    target === state.activeFrame &&
    state.sprite.layers.every((l) => l.buffer === l.cels[target])
  ) {
    return state;
  }
  const layers = state.sprite.layers.map((layer) => ({
    ...layer,
    buffer: layer.cels[target] ?? layer.buffer,
  }));
  return { ...state, sprite: { ...state.sprite, layers }, activeFrame: target };
}

function withFrames(
  state: DocumentState,
  frames: readonly Frame[],
  cels: (layer: Layer) => readonly PixelBuffer[],
  activeFrame: number,
): DocumentState {
  const layers = state.sprite.layers.map((layer) => {
    const next = cels(layer);
    return { ...layer, cels: next, buffer: next[activeFrame] ?? layer.buffer };
  });
  return { ...state, sprite: { ...state.sprite, frames, layers }, activeFrame };
}

const insertAt = <T>(items: readonly T[], index: number, value: T): T[] => [
  ...items.slice(0, index),
  value,
  ...items.slice(index),
];

/** A new empty frame after `afterIndex` (default: after the active one), which becomes active. */
export function addFrame(
  state: DocumentState,
  ids: IdGenerator,
  afterIndex?: number,
): DocumentState {
  const { frames, width, height } = state.sprite;
  if (frames.length >= MAX_FRAMES || !canGrow(state, 0, 1)) return state;
  const at = Math.min(frames.length, Math.max(0, (afterIndex ?? state.activeFrame) + 1));
  const neighbor = frames[at - 1] ?? frames[0];
  const frame: Frame = { id: ids.next(), duration: neighbor?.duration ?? DEFAULT_FRAME_DURATION };
  return withFrames(
    state,
    insertAt(frames, at, frame),
    (layer) => insertAt(layer.cels, at, PixelBuffer.create(width, height)),
    at,
  );
}

/** A copy of the frame at `index`, placed right after it, which becomes active. */
export function duplicateFrame(
  state: DocumentState,
  ids: IdGenerator,
  index: number = state.activeFrame,
): DocumentState {
  const { frames } = state.sprite;
  const source = frames[index];
  if (!source || frames.length >= MAX_FRAMES || !canGrow(state, 0, 1)) return state;
  const at = index + 1;
  return withFrames(
    state,
    insertAt(frames, at, { id: ids.next(), duration: source.duration }),
    (layer) =>
      insertAt(
        layer.cels,
        at,
        layer.cels[index]?.clone() ?? PixelBuffer.create(state.sprite.width, state.sprite.height),
      ),
    at,
  );
}

export function deleteFrame(state: DocumentState, index: number): DocumentState {
  const { frames } = state.sprite;
  if (frames.length <= 1 || !frames[index]) return state;
  const remove = <T>(items: readonly T[]): T[] => items.filter((_, i) => i !== index);
  const active = Math.min(
    frames.length - 2,
    state.activeFrame > index ? state.activeFrame - 1 : state.activeFrame,
  );
  return withFrames(state, remove(frames), (layer) => remove(layer.cels), active);
}

/** Moves a frame so it ends up at `toIndex`. The active frame stays the same frame. */
export function moveFrame(state: DocumentState, from: number, to: number): DocumentState {
  const { frames } = state.sprite;
  const moving = frames[from];
  const target = Math.min(frames.length - 1, Math.max(0, Math.round(to)));
  if (!moving || from === target) return state;
  const reorder = <T>(items: readonly T[], item: T): T[] =>
    insertAt(
      items.filter((_, i) => i !== from),
      target,
      item,
    );
  const activeId = frames[state.activeFrame]?.id;
  const nextFrames = reorder(frames, moving);
  const active = Math.max(
    0,
    nextFrames.findIndex((frame) => frame.id === activeId),
  );
  return withFrames(
    state,
    nextFrames,
    (layer) => reorder(layer.cels, layer.cels[from] ?? layer.buffer),
    active,
  );
}

export function setFrameDuration(
  state: DocumentState,
  index: number,
  milliseconds: number,
): DocumentState {
  const { frames } = state.sprite;
  const frame = frames[index];
  const duration = clampDuration(milliseconds);
  if (!frame || frame.duration === duration) return state;
  return {
    ...state,
    sprite: {
      ...state.sprite,
      frames: frames.map((f, i) => (i === index ? { ...f, duration } : f)),
    },
  };
}

export function setAllFrameDurations(state: DocumentState, milliseconds: number): DocumentState {
  const duration = clampDuration(milliseconds);
  const { frames } = state.sprite;
  if (frames.every((frame) => frame.duration === duration)) return state;
  return {
    ...state,
    sprite: { ...state.sprite, frames: frames.map((frame) => ({ ...frame, duration })) },
  };
}
