import { describe, expect, it } from 'vitest';
import { packRgba } from './color.js';
import {
  MAX_PALETTE_COLORS,
  MAX_PALETTE_NAME_LENGTH,
  cleanName,
  createPalette,
  indexOfColor,
  opaque,
  paletteColor,
} from './palette.js';

const RED = packRgba(255, 0, 0, 255);

describe('opaque', () => {
  it('forces full alpha and keeps the color', () => {
    expect(opaque(packRgba(10, 20, 30, 0))).toBe(packRgba(10, 20, 30, 255));
    expect(opaque(RED)).toBe(RED);
  });
});

describe('cleanName', () => {
  it('trims, shortens and drops empty names', () => {
    expect(cleanName('  Sky  ', 10)).toBe('Sky');
    expect(cleanName('abcdef', 3)).toBe('abc');
    expect(cleanName('   ', 10)).toBeUndefined();
    expect(cleanName(undefined, 10)).toBeUndefined();
  });
});

describe('paletteColor', () => {
  it('makes the color opaque and only includes a name when there is one', () => {
    expect(paletteColor(packRgba(1, 2, 3, 7))).toEqual({ color: packRgba(1, 2, 3, 255) });
    expect(paletteColor(RED, '  Red  ')).toEqual({ color: RED, name: 'Red' });
    expect(paletteColor(RED, ' ')).toEqual({ color: RED });
    expect('name' in paletteColor(RED)).toBe(false);
  });
});

describe('createPalette', () => {
  it('defaults the name, cleans entries and limits the size', () => {
    expect(createPalette('p')).toEqual({ id: 'p', name: 'Palette', colors: [] });
    expect(createPalette('p', '  ')).toMatchObject({ name: 'Palette' });
    expect(createPalette('p', 'x'.repeat(100)).name).toHaveLength(MAX_PALETTE_NAME_LENGTH);
    const many = Array.from({ length: MAX_PALETTE_COLORS + 10 }, (_, i) => ({
      color: packRgba(i % 256, 0, 0, 255),
    }));
    expect(createPalette('p', 'Big', many).colors).toHaveLength(MAX_PALETTE_COLORS);
    expect(createPalette('p', 'A', [{ color: packRgba(1, 1, 1, 0) }]).colors[0]?.color).toBe(
      packRgba(1, 1, 1, 255),
    );
  });
});

describe('indexOfColor', () => {
  it('finds a color ignoring alpha, or returns -1', () => {
    const palette = createPalette('p', 'A', [{ color: RED }, { color: packRgba(0, 0, 255, 255) }]);
    expect(indexOfColor(palette, packRgba(0, 0, 255, 90))).toBe(1);
    expect(indexOfColor(palette, packRgba(9, 9, 9, 255))).toBe(-1);
  });
});
