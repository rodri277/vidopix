import type { Color } from '../domain/color.js';
import {
  MAX_PALETTE_COLORS,
  MAX_PALETTE_NAME_LENGTH,
  cleanName,
  createPalette,
  indexOfColor,
  opaque,
  paletteColor,
  type Palette,
  type PaletteColor,
} from '../domain/palette.js';
import type { DocumentState } from './document-state.js';

/**
 * Pure palette edits. Each returns the new document state, or the same object when the request
 * changes nothing (a duplicate color, a full palette, an index that does not exist).
 */

function withPalette(state: DocumentState, palette: Palette): DocumentState {
  return { ...state, sprite: { ...state.sprite, palette } };
}

function withColors(state: DocumentState, colors: readonly PaletteColor[]): DocumentState {
  return withPalette(state, { ...state.sprite.palette, colors });
}

export type AddColorOutcome = 'added' | 'duplicate' | 'full';

export function whyCannotAdd(state: DocumentState, color: Color): AddColorOutcome {
  const { palette } = state.sprite;
  if (indexOfColor(palette, color) >= 0) return 'duplicate';
  return palette.colors.length >= MAX_PALETTE_COLORS ? 'full' : 'added';
}

export function addPaletteColor(state: DocumentState, color: Color, name?: string): DocumentState {
  if (whyCannotAdd(state, color) !== 'added') return state;
  return withColors(state, [...state.sprite.palette.colors, paletteColor(color, name)]);
}

/** Adds the colors that are not in the palette yet, until it is full. */
export function appendPaletteColors(
  state: DocumentState,
  colors: readonly PaletteColor[],
): DocumentState {
  let palette = state.sprite.palette;
  for (const entry of colors) {
    if (palette.colors.length >= MAX_PALETTE_COLORS) break;
    if (indexOfColor(palette, entry.color) >= 0) continue;
    palette = { ...palette, colors: [...palette.colors, paletteColor(entry.color, entry.name)] };
  }
  return palette === state.sprite.palette ? state : withPalette(state, palette);
}

export function removePaletteColor(state: DocumentState, index: number): DocumentState {
  const { colors } = state.sprite.palette;
  if (index < 0 || index >= colors.length) return state;
  return withColors(
    state,
    colors.filter((_, i) => i !== index),
  );
}

export function movePaletteColor(state: DocumentState, from: number, to: number): DocumentState {
  const { colors } = state.sprite.palette;
  const target = Math.min(colors.length - 1, Math.max(0, Math.round(to)));
  const moving = colors[from];
  if (!moving || from === target) return state;
  const without = colors.filter((_, i) => i !== from);
  return withColors(state, [...without.slice(0, target), moving, ...without.slice(target)]);
}

export function renamePaletteColor(
  state: DocumentState,
  index: number,
  name: string | undefined,
): DocumentState {
  const entry = state.sprite.palette.colors[index];
  if (!entry) return state;
  const cleaned = cleanName(name, MAX_PALETTE_NAME_LENGTH);
  if (cleaned === entry.name) return state;
  return replaceEntry(state, index, paletteColor(entry.color, cleaned));
}

/** Changes the color of an entry. Refuses a color the palette already has elsewhere. */
export function setPaletteColor(state: DocumentState, index: number, color: Color): DocumentState {
  const { palette } = state.sprite;
  const entry = palette.colors[index];
  const target = opaque(color);
  if (!entry || entry.color === target) return state;
  const existing = indexOfColor(palette, target);
  if (existing >= 0 && existing !== index) return state;
  return replaceEntry(state, index, paletteColor(target, entry.name));
}

export function renamePalette(state: DocumentState, name: string): DocumentState {
  const cleaned = cleanName(name, MAX_PALETTE_NAME_LENGTH);
  const { palette } = state.sprite;
  if (cleaned === undefined || cleaned === palette.name) return state;
  return withPalette(state, { ...palette, name: cleaned });
}

/** Replaces every color (and the name) while keeping the palette's identity. */
export function replacePalette(
  state: DocumentState,
  name: string,
  colors: readonly PaletteColor[],
): DocumentState {
  const { palette } = state.sprite;
  const next = createPalette(palette.id, name, dedupe(colors));
  const same =
    next.name === palette.name &&
    next.colors.length === palette.colors.length &&
    next.colors.every((entry, i) => {
      const old = palette.colors[i];
      return old?.color === entry.color && old.name === entry.name;
    });
  return same ? state : withPalette(state, next);
}

function dedupe(colors: readonly PaletteColor[]): PaletteColor[] {
  const seen = new Set<number>();
  const result: PaletteColor[] = [];
  for (const entry of colors) {
    const color = opaque(entry.color);
    if (seen.has(color)) continue;
    seen.add(color);
    result.push(entry);
  }
  return result;
}

function replaceEntry(state: DocumentState, index: number, entry: PaletteColor): DocumentState {
  return withColors(
    state,
    state.sprite.palette.colors.map((existing, i) => (i === index ? entry : existing)),
  );
}
