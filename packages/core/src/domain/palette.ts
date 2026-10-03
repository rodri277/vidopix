import type { Color } from './color.js';

export const MAX_PALETTE_COLORS = 256;
export const MAX_PALETTE_NAME_LENGTH = 60;

/** A palette entry. Palette colors are always opaque; transparency belongs to the drawing color. */
export interface PaletteColor {
  readonly color: Color;
  readonly name?: string;
}

export interface Palette {
  readonly id: string;
  readonly name: string;
  readonly colors: readonly PaletteColor[];
}

/** The same color with full opacity. */
export function opaque(color: Color): Color {
  return (color | 0xff000000) >>> 0;
}

/** Trims and shortens a name; returns undefined for an empty one. */
export function cleanName(name: string | undefined, max: number): string | undefined {
  const trimmed = name
    ?.replace(/\p{Cc}+/gu, ' ')
    .trim()
    .slice(0, max);
  return trimmed === undefined || trimmed === '' ? undefined : trimmed;
}

export function paletteColor(color: Color, name?: string): PaletteColor {
  const cleaned = cleanName(name, MAX_PALETTE_NAME_LENGTH);
  return cleaned === undefined ? { color: opaque(color) } : { color: opaque(color), name: cleaned };
}

export function createPalette(
  id: string,
  name = 'Palette',
  colors: readonly PaletteColor[] = [],
): Palette {
  return {
    id,
    name: cleanName(name, MAX_PALETTE_NAME_LENGTH) ?? 'Palette',
    colors: colors
      .slice(0, MAX_PALETTE_COLORS)
      .map((entry) => paletteColor(entry.color, entry.name)),
  };
}

export function indexOfColor(palette: Palette, color: Color): number {
  const target = opaque(color);
  return palette.colors.findIndex((entry) => entry.color === target);
}
