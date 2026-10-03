import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { packRgba, parseHex } from './color.js';
import {
  HARMONY_KINDS,
  contrastRatio,
  harmony,
  relativeLuminance,
  shadeRamp,
  wcagLevels,
} from './color-theory.js';
import { colorToOklch } from './oklch.js';

function hex(value: string): number {
  const parsed = parseHex(value);
  if (!parsed.ok) throw new Error(`bad hex ${value}`);
  return parsed.value;
}

const hueDistance = (a: number, b: number): number => {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
};

describe('relativeLuminance', () => {
  it('is 0 for black and 1 for white', () => {
    expect(relativeLuminance(hex('#000000'))).toBe(0);
    expect(relativeLuminance(hex('#ffffff'))).toBeCloseTo(1, 10);
  });

  it('weighs the channels as WCAG defines', () => {
    expect(relativeLuminance(hex('#ff0000'))).toBeCloseTo(0.2126, 4);
    expect(relativeLuminance(hex('#00ff00'))).toBeCloseTo(0.7152, 4);
    expect(relativeLuminance(hex('#0000ff'))).toBeCloseTo(0.0722, 4);
  });
});

describe('contrastRatio against well-known values', () => {
  it.each([
    ['#000000', '#ffffff', 21],
    ['#ffffff', '#ffffff', 1],
    ['#ff0000', '#ffffff', 4.0],
    ['#767676', '#ffffff', 4.54],
    ['#777777', '#ffffff', 4.48],
    ['#0000ff', '#ffffff', 8.59],
  ])('%s on %s is %f:1', (a, b, expected) => {
    expect(contrastRatio(hex(a), hex(b))).toBeCloseTo(expected, 1);
  });

  it('does not depend on the order of the colors and is never below 1', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 0xffffff }),
        fc.integer({ min: 0, max: 0xffffff }),
        (a, b) => {
          const first = (a | 0xff000000) >>> 0;
          const second = (b | 0xff000000) >>> 0;
          expect(contrastRatio(first, second)).toBeCloseTo(contrastRatio(second, first), 10);
          expect(contrastRatio(first, second)).toBeGreaterThanOrEqual(1);
          expect(contrastRatio(first, second)).toBeLessThanOrEqual(21 + 1e-9);
        },
      ),
    );
  });
});

describe('wcagLevels', () => {
  it('applies the AA and AAA thresholds', () => {
    expect(wcagLevels(21)).toEqual({
      aaLarge: true,
      aaNormal: true,
      aaaLarge: true,
      aaaNormal: true,
    });
    expect(wcagLevels(4.5)).toEqual({
      aaLarge: true,
      aaNormal: true,
      aaaLarge: true,
      aaaNormal: false,
    });
    expect(wcagLevels(3)).toEqual({
      aaLarge: true,
      aaNormal: false,
      aaaLarge: false,
      aaaNormal: false,
    });
    expect(wcagLevels(2.99)).toEqual({
      aaLarge: false,
      aaNormal: false,
      aaaLarge: false,
      aaaNormal: false,
    });
    expect(wcagLevels(7)).toMatchObject({ aaaNormal: true });
  });
});

describe('harmony', () => {
  const base = hex('#3b82f6');
  const baseLch = colorToOklch(base);

  it('lists the available harmonies', () => {
    expect([...HARMONY_KINDS]).toEqual([
      'analogous',
      'complementary',
      'triadic',
      'tetradic',
      'monochromatic',
    ]);
  });

  it.each([
    ['analogous', [-30, 0, 30]],
    ['complementary', [0, 180]],
    ['triadic', [0, 120, 240]],
    ['tetradic', [0, 90, 180, 270]],
  ] as const)('%s rotates the hue and keeps lightness and chroma', (kind, offsets) => {
    const colors = harmony(base, kind);
    expect(colors).toHaveLength(offsets.length);
    colors.forEach((color, index) => {
      const lch = colorToOklch(color);
      const expectedHue = (baseLch.h + (offsets[index] ?? 0) + 360) % 360;
      expect(hueDistance(lch.h, expectedHue)).toBeLessThan(3);
      expect(Math.abs(lch.l - baseLch.l)).toBeLessThan(0.02);
      expect(color >>> 24).toBe(255);
    });
  });

  it('puts the base color itself in every hue-based harmony', () => {
    for (const kind of ['complementary', 'triadic', 'tetradic'] as const) {
      expect(harmony(base, kind)).toContain((base | 0xff000000) >>> 0);
    }
    expect(harmony(base, 'analogous')[1]).toBe((base | 0xff000000) >>> 0);
  });

  it('monochromatic keeps the hue and spreads lightness from dark to light', () => {
    const colors = harmony(base, 'monochromatic');
    expect(colors).toHaveLength(5);
    const lightness = colors.map((color) => colorToOklch(color).l);
    expect([...lightness].sort((a, b) => a - b)).toEqual(lightness);
    expect(lightness[0]).toBeLessThan(0.35);
    expect(lightness[4]).toBeGreaterThan(0.8);
    for (const color of colors.slice(1, 4)) {
      expect(hueDistance(colorToOklch(color).h, baseLch.h)).toBeLessThan(4);
    }
  });

  it('works for greys', () => {
    for (const kind of HARMONY_KINDS) {
      for (const color of harmony(hex('#808080'), kind)) expect(color >>> 24).toBe(255);
    }
  });
});

describe('shadeRamp', () => {
  const base = hex('#4f9d4f');

  it('runs from dark to light with the base color in the middle of an odd ramp', () => {
    const ramp = shadeRamp(base, 5);
    expect(ramp).toHaveLength(5);
    const lightness = ramp.map((color) => colorToOklch(color).l);
    for (let i = 1; i < lightness.length; i++) {
      expect(lightness[i] ?? 0).toBeGreaterThan(lightness[i - 1] ?? 1);
    }
    expect(ramp[2]).toBe(base);
  });

  it('shifts shadows toward blue/purple and highlights toward yellow', () => {
    const baseHue = colorToOklch(base).h;
    const ramp = shadeRamp(base, 7, { hueShift: 40 });
    const darkest = colorToOklch(ramp[0] ?? 0).h;
    const lightest = colorToOklch(ramp[6] ?? 0).h;
    expect(hueDistance(darkest, 270)).toBeLessThan(hueDistance(baseHue, 270));
    expect(hueDistance(lightest, 90)).toBeLessThan(hueDistance(baseHue, 90));
  });

  it('keeps the hue fixed when the shift is zero', () => {
    const baseHue = colorToOklch(base).h;
    for (const color of shadeRamp(base, 5, { hueShift: 0 })) {
      expect(hueDistance(colorToOklch(color).h, baseHue)).toBeLessThan(4);
    }
  });

  it('does not shift the hue of greys', () => {
    const grey = hex('#808080');
    const ramp = shadeRamp(grey, 5);
    for (const color of ramp) {
      const { r, g, b } = { r: color & 255, g: (color >>> 8) & 255, b: (color >>> 16) & 255 };
      expect(Math.max(r, g, b) - Math.min(r, g, b)).toBeLessThanOrEqual(1);
    }
  });

  it('limits the number of steps and always returns opaque colors', () => {
    expect(shadeRamp(base, 1)).toHaveLength(2);
    expect(shadeRamp(base, 99)).toHaveLength(15);
    expect(shadeRamp(base, 2.6)).toHaveLength(3);
    for (const color of shadeRamp(packRgba(10, 200, 30, 40), 9)) expect(color >>> 24).toBe(255);
  });

  it('stays inside the displayable range for any color', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 0xffffff }),
        fc.integer({ min: 2, max: 15 }),
        (rgb, steps) => {
          const ramp = shadeRamp((rgb | 0xff000000) >>> 0, steps);
          expect(ramp).toHaveLength(steps);
          for (const color of ramp) {
            expect(Number.isInteger(color)).toBe(true);
            expect(color >>> 24).toBe(255);
          }
        },
      ),
    );
  });
});
