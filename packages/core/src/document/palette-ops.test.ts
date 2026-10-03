import { describe, expect, it } from 'vitest';
import { packRgba } from '../domain/color.js';
import { MAX_PALETTE_COLORS } from '../domain/palette.js';
import { createSprite } from '../domain/sprite.js';
import { createSequentialIdGenerator } from '../ports/id-generator.js';
import type { DocumentState } from './document-state.js';
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

const RED = packRgba(255, 0, 0, 255);
const GREEN = packRgba(0, 255, 0, 255);
const BLUE = packRgba(0, 0, 255, 255);

function setup(): DocumentState {
  const sprite = createSprite({ width: 2, height: 2 }, createSequentialIdGenerator());
  if (!sprite.ok) throw new Error('sprite');
  const layer = sprite.value.layers[0];
  if (!layer) throw new Error('layer');
  return { sprite: sprite.value, activeLayerId: layer.id, selection: null };
}

const colors = (state: DocumentState): number[] => state.sprite.palette.colors.map((c) => c.color);

function withThree(): DocumentState {
  return addPaletteColor(addPaletteColor(addPaletteColor(setup(), RED), GREEN), BLUE);
}

describe('addPaletteColor', () => {
  it('appends an opaque color with an optional name', () => {
    const state = addPaletteColor(setup(), packRgba(255, 0, 0, 40), 'Red');
    expect(state.sprite.palette.colors).toEqual([{ color: RED, name: 'Red' }]);
  });

  it('refuses duplicates, ignoring alpha, and reports why', () => {
    const state = addPaletteColor(setup(), RED);
    expect(addPaletteColor(state, packRgba(255, 0, 0, 10))).toBe(state);
    expect(whyCannotAdd(state, RED)).toBe('duplicate');
    expect(whyCannotAdd(state, BLUE)).toBe('added');
  });

  it('stops at the maximum size', () => {
    let state = setup();
    for (let i = 0; i < MAX_PALETTE_COLORS; i++) {
      state = addPaletteColor(state, packRgba(i, 1, 2, 255));
    }
    expect(state.sprite.palette.colors).toHaveLength(MAX_PALETTE_COLORS);
    expect(whyCannotAdd(state, packRgba(9, 9, 9, 255))).toBe('full');
    expect(addPaletteColor(state, packRgba(9, 9, 9, 255))).toBe(state);
  });

  it('keeps pixel buffers and layers untouched', () => {
    const state = setup();
    expect(addPaletteColor(state, RED).sprite.layers).toBe(state.sprite.layers);
  });
});

describe('appendPaletteColors', () => {
  it('adds only the missing colors, in order', () => {
    const state = appendPaletteColors(addPaletteColor(setup(), RED), [
      { color: GREEN },
      { color: RED },
      { color: BLUE, name: 'Blue' },
    ]);
    expect(colors(state)).toEqual([RED, GREEN, BLUE]);
    expect(state.sprite.palette.colors[2]?.name).toBe('Blue');
  });

  it('returns the same state when everything is already there or the palette is full', () => {
    const state = withThree();
    expect(appendPaletteColors(state, [{ color: RED }])).toBe(state);
    expect(appendPaletteColors(state, [])).toBe(state);
    let full = setup();
    for (let i = 0; i < MAX_PALETTE_COLORS; i++)
      full = addPaletteColor(full, packRgba(i, 1, 2, 255));
    expect(appendPaletteColors(full, [{ color: packRgba(9, 9, 9, 255) }])).toBe(full);
  });
});

describe('removePaletteColor', () => {
  it('removes by index and ignores bad indices', () => {
    const state = withThree();
    expect(colors(removePaletteColor(state, 1))).toEqual([RED, BLUE]);
    expect(removePaletteColor(state, 5)).toBe(state);
    expect(removePaletteColor(state, -1)).toBe(state);
  });
});

describe('movePaletteColor', () => {
  it('reorders and clamps the target', () => {
    const state = withThree();
    expect(colors(movePaletteColor(state, 0, 2))).toEqual([GREEN, BLUE, RED]);
    expect(colors(movePaletteColor(state, 2, 0))).toEqual([BLUE, RED, GREEN]);
    expect(colors(movePaletteColor(state, 0, 99))).toEqual([GREEN, BLUE, RED]);
    expect(colors(movePaletteColor(state, 2, -4))).toEqual([BLUE, RED, GREEN]);
  });

  it('does nothing when the position does not change or the index is unknown', () => {
    const state = withThree();
    expect(movePaletteColor(state, 1, 1)).toBe(state);
    expect(movePaletteColor(state, 9, 0)).toBe(state);
  });
});

describe('renamePaletteColor / renamePalette', () => {
  it('sets, clears and cleans entry names', () => {
    const state = renamePaletteColor(withThree(), 0, '  Rose ');
    expect(state.sprite.palette.colors[0]).toEqual({ color: RED, name: 'Rose' });
    const cleared = renamePaletteColor(state, 0, '  ');
    expect('name' in (cleared.sprite.palette.colors[0] ?? {})).toBe(false);
    expect(renamePaletteColor(state, 0, 'Rose')).toBe(state);
    expect(renamePaletteColor(state, 9, 'x')).toBe(state);
  });

  it('renames the palette and ignores empty or unchanged names', () => {
    const state = setup();
    expect(renamePalette(state, ' Sunset ').sprite.palette.name).toBe('Sunset');
    expect(renamePalette(state, '   ')).toBe(state);
    expect(renamePalette(state, 'Palette')).toBe(state);
  });
});

describe('setPaletteColor', () => {
  it('edits an entry, keeping its name, and refuses a color that exists elsewhere', () => {
    const named = renamePaletteColor(withThree(), 0, 'Main');
    const changed = setPaletteColor(named, 0, packRgba(200, 0, 0, 30));
    expect(changed.sprite.palette.colors[0]).toEqual({
      color: packRgba(200, 0, 0, 255),
      name: 'Main',
    });
    expect(setPaletteColor(named, 0, GREEN)).toBe(named);
    expect(setPaletteColor(named, 0, RED)).toBe(named);
    expect(setPaletteColor(named, 7, RED)).toBe(named);
  });
});

describe('replacePalette', () => {
  it('swaps colors and name, drops duplicates and keeps the palette id', () => {
    const state = withThree();
    const next = replacePalette(state, 'Mine', [
      { color: BLUE },
      { color: BLUE },
      { color: RED, name: 'R' },
    ]);
    expect(next.sprite.palette.id).toBe(state.sprite.palette.id);
    expect(next.sprite.palette.name).toBe('Mine');
    expect(next.sprite.palette.colors).toEqual([{ color: BLUE }, { color: RED, name: 'R' }]);
  });

  it('returns the same state when nothing would change', () => {
    const state = replacePalette(withThree(), 'Same', [{ color: RED }, { color: GREEN }]);
    expect(replacePalette(state, 'Same', [{ color: RED }, { color: GREEN }])).toBe(state);
  });
});
