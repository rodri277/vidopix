import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { packRgba, unpackRgba } from './color.js';
import { colorToOklch, linearToSrgb, oklchToColor, srgbToLinear } from './oklch.js';

const near = (actual: number, expected: number, tolerance = 1e-3): void => {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(tolerance);
};

describe('sRGB transfer function', () => {
  it('maps the endpoints and the linear toe', () => {
    expect(srgbToLinear(0)).toBe(0);
    expect(srgbToLinear(1)).toBeCloseTo(1, 12);
    near(srgbToLinear(0.5), 0.214041, 1e-5);
    near(srgbToLinear(0.04), 0.04 / 12.92, 1e-9);
  });

  it('is inverted by linearToSrgb', () => {
    fc.assert(
      fc.property(fc.double({ min: 0, max: 1, noNaN: true }), (value) => {
        expect(linearToSrgb(srgbToLinear(value))).toBeCloseTo(value, 9);
      }),
    );
  });
});

// Reference values published with Bjorn Ottosson's OKLab definition.
describe('colorToOklch against published reference values', () => {
  it.each([
    ['white', [255, 255, 255], 1, 0, 0],
    ['black', [0, 0, 0], 0, 0, 0],
    ['red', [255, 0, 0], 0.62796, 0.25768, 29.23],
    ['green', [0, 255, 0], 0.86644, 0.29483, 142.5],
    ['blue', [0, 0, 255], 0.45201, 0.31321, 264.05],
  ] as const)('%s', (_name, [r, g, b], lightness, chroma, hue) => {
    const result = colorToOklch(packRgba(r, g, b, 255));
    near(result.l, lightness);
    near(result.c, chroma);
    if (chroma > 0) near(result.h, hue, 0.05);
    expect(result.alpha).toBe(1);
  });

  it('reports a hue of 0 for greys and normalizes it to [0, 360)', () => {
    expect(colorToOklch(packRgba(128, 128, 128, 255)).h).toBe(0);
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 0xffffff }), (rgb) => {
        const { h } = colorToOklch((rgb | 0xff000000) >>> 0);
        expect(h).toBeGreaterThanOrEqual(0);
        expect(h).toBeLessThan(360);
      }),
    );
  });

  it('carries alpha through', () => {
    near(colorToOklch(packRgba(10, 20, 30, 51)).alpha, 0.2, 1e-9);
  });
});

describe('oklchToColor', () => {
  it('round-trips every 8-bit sRGB color without losing a single level', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 255 }),
        fc.integer({ min: 0, max: 255 }),
        fc.integer({ min: 0, max: 255 }),
        fc.integer({ min: 0, max: 255 }),
        (r, g, b, a) => {
          const original = packRgba(r, g, b, a);
          expect(unpackRgba(oklchToColor(colorToOklch(original)))).toEqual(unpackRgba(original));
        },
      ),
      { numRuns: 2000 },
    );
  });

  it('clamps lightness to black and white', () => {
    expect(oklchToColor({ l: 1.5, c: 0.1, h: 120, alpha: 1 })).toBe(packRgba(255, 255, 255, 255));
    expect(oklchToColor({ l: -0.2, c: 0.1, h: 120, alpha: 1 })).toBe(packRgba(0, 0, 0, 255));
  });

  it('reduces chroma to bring out-of-gamut colors into range, keeping lightness and hue', () => {
    const requested = { l: 0.7, c: 0.4, h: 145, alpha: 1 };
    const color = oklchToColor(requested);
    const back = colorToOklch(color);
    expect(back.c).toBeLessThan(requested.c);
    near(back.l, requested.l, 0.01);
    near(back.h, requested.h, 2);
  });

  it('never produces an invalid channel for any input', () => {
    fc.assert(
      fc.property(
        fc.double({ min: -0.5, max: 1.5, noNaN: true }),
        fc.double({ min: 0, max: 0.5, noNaN: true }),
        fc.double({ min: -720, max: 720, noNaN: true }),
        fc.double({ min: -1, max: 2, noNaN: true }),
        (l, c, h, alpha) => {
          const color = oklchToColor({ l, c, h, alpha });
          expect(Number.isInteger(color)).toBe(true);
          expect(color).toBeGreaterThanOrEqual(0);
          expect(color).toBeLessThanOrEqual(0xffffffff);
        },
      ),
    );
  });

  it('wraps hue and clamps alpha', () => {
    const a = oklchToColor({ l: 0.6, c: 0.1, h: 30, alpha: 1 });
    const b = oklchToColor({ l: 0.6, c: 0.1, h: 390, alpha: 1 });
    expect(a).toBe(b);
    expect(unpackRgba(oklchToColor({ l: 0.6, c: 0.1, h: 30, alpha: 2 })).a).toBe(255);
    expect(unpackRgba(oklchToColor({ l: 0.6, c: 0.1, h: 30, alpha: -1 })).a).toBe(0);
  });
});
