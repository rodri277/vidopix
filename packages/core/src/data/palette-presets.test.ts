import { describe, expect, it } from 'vitest';
import { parseHex } from '../domain/color.js';
import { MAX_PALETTE_COLORS } from '../domain/palette.js';
import { PALETTE_PRESETS, presetToColors } from './palette-presets.js';

describe('palette presets', () => {
  it('includes the agreed palettes with their published sizes', () => {
    const sizes = Object.fromEntries(
      PALETTE_PRESETS.map((preset) => [preset.id, preset.colors.length]),
    );
    expect(sizes).toEqual({
      'pico-8': 16,
      'dawnbringer-16': 16,
      'dawnbringer-32': 32,
      'sweetie-16': 16,
      'endesga-32': 32,
      'resurrect-64': 64,
    });
  });

  it('has valid, distinct colors and credits an author and a source for each', () => {
    const ids = new Set<string>();
    for (const preset of PALETTE_PRESETS) {
      expect(ids.has(preset.id)).toBe(false);
      ids.add(preset.id);
      expect(preset.author.length).toBeGreaterThan(0);
      expect(preset.source).toBe(`https://lospec.com/palette-list/${preset.id}`);
      expect(preset.colors.length).toBeLessThanOrEqual(MAX_PALETTE_COLORS);
      expect(new Set(preset.colors).size).toBe(preset.colors.length);
      for (const hex of preset.colors) {
        expect(hex).toMatch(/^[0-9a-f]{6}$/);
        expect(parseHex(hex).ok).toBe(true);
      }
    }
  });

  it('matches well-known first and last colors', () => {
    const byId = Object.fromEntries(PALETTE_PRESETS.map((preset) => [preset.id, preset.colors]));
    expect(byId['pico-8']?.[0]).toBe('000000');
    expect(byId['pico-8']?.[7]).toBe('fff1e8');
    expect(byId['endesga-32']?.[0]).toBe('be4a2f');
  });

  it('turns a preset into opaque palette colors in order', () => {
    const preset = PALETTE_PRESETS[0];
    if (!preset) throw new Error('no presets');
    const colors = presetToColors(preset);
    expect(colors).toHaveLength(preset.colors.length);
    expect(colors[1]?.color).toBe(0xff532b1d);
    expect(colors.every((entry) => entry.color >>> 24 === 255)).toBe(true);
  });
});
