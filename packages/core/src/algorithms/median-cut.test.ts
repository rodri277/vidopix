import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { packRgba, unpackRgba } from '../domain/color.js';
import { colorToOklch } from '../domain/oklch.js';
import { fitWithin, medianCut } from './median-cut.js';

const RED = packRgba(255, 0, 0, 255);
const BLUE = packRgba(0, 0, 255, 255);
const GREEN = packRgba(0, 255, 0, 255);

const image = (...colors: number[]): Uint32Array => Uint32Array.from(colors);
const repeat = (color: number, times: number): number[] => new Array<number>(times).fill(color);

function distance(a: number, b: number): number {
  const p = unpackRgba(a);
  const q = unpackRgba(b);
  return Math.max(Math.abs(p.r - q.r), Math.abs(p.g - q.g), Math.abs(p.b - q.b));
}

describe('medianCut', () => {
  it('returns every color when there are no more than requested, darkest first', () => {
    const result = medianCut(image(RED, BLUE, RED, GREEN, BLUE), 8);
    expect(result).toHaveLength(3);
    expect(new Set(result)).toEqual(new Set([RED, GREEN, BLUE]));
    const lightness = result.map((color) => colorToOklch(color).l);
    expect([...lightness].sort((a, b) => a - b)).toEqual(lightness);
  });

  it('keeps both colors of a two-color image exactly', () => {
    expect(new Set(medianCut(image(...repeat(RED, 50), ...repeat(BLUE, 50)), 2))).toEqual(
      new Set([RED, BLUE]),
    );
  });

  it('keeps a minority color instead of averaging it away', () => {
    const result = medianCut(image(...repeat(RED, 90), ...repeat(BLUE, 10)), 2);
    expect(new Set(result)).toEqual(new Set([RED, BLUE]));
  });

  it('ignores transparent and mostly transparent pixels', () => {
    const clear = packRgba(10, 200, 30, 0);
    expect(medianCut(image(clear, clear), 4)).toEqual([]);
    expect(medianCut(image(clear, RED, packRgba(0, 0, 255, 100)), 4)).toEqual([RED]);
    expect(medianCut(new Uint32Array(0), 4)).toEqual([]);
  });

  it('recovers well-separated clusters from noisy pixels', () => {
    const centers = [
      packRgba(220, 30, 40, 255),
      packRgba(30, 200, 60, 255),
      packRgba(40, 60, 220, 255),
      packRgba(240, 230, 60, 255),
    ];
    const pixels: number[] = [];
    for (const center of centers) {
      const { r, g, b } = unpackRgba(center);
      for (let i = 0; i < 200; i++) {
        const jitter = (i % 7) - 3;
        pixels.push(packRgba(r + jitter, g - jitter, b + (jitter % 3), 255));
      }
    }
    const result = medianCut(Uint32Array.from(pixels), 4);
    expect(result).toHaveLength(4);
    for (const center of centers) {
      expect(Math.min(...result.map((color) => distance(color, center)))).toBeLessThanOrEqual(6);
    }
  });

  it('never returns more colors than requested, and only opaque ones', () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 0, max: 0xffffff }), { minLength: 1, maxLength: 300 }),
        fc.integer({ min: 2, max: 32 }),
        (values, count) => {
          const pixels = Uint32Array.from(values.map((v) => (v | 0xff000000) >>> 0));
          const result = medianCut(pixels, count);
          expect(result.length).toBeLessThanOrEqual(count);
          expect(result.length).toBeGreaterThan(0);
          expect(new Set(result).size).toBe(result.length);
          for (const color of result) expect(color >>> 24).toBe(255);
        },
      ),
    );
  });

  it('gives palette colors that stay inside the range of the input', () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 0, max: 0xffffff }), { minLength: 5, maxLength: 200 }),
        (values) => {
          const pixels = Uint32Array.from(values.map((v) => (v | 0xff000000) >>> 0));
          const channels = (shift: number): number[] => [...pixels].map((p) => (p >>> shift) & 255);
          const [reds, greens, blues] = [channels(0), channels(8), channels(16)];
          for (const color of medianCut(pixels, 6)) {
            const { r, g, b } = unpackRgba(color);
            expect(r).toBeGreaterThanOrEqual(Math.min(...reds));
            expect(r).toBeLessThanOrEqual(Math.max(...reds));
            expect(g).toBeGreaterThanOrEqual(Math.min(...greens));
            expect(g).toBeLessThanOrEqual(Math.max(...greens));
            expect(b).toBeGreaterThanOrEqual(Math.min(...blues));
            expect(b).toBeLessThanOrEqual(Math.max(...blues));
          }
        },
      ),
    );
  });

  it('is deterministic', () => {
    const pixels = Uint32Array.from({ length: 500 }, (_, i) =>
      packRgba((i * 37) % 256, (i * 91) % 256, (i * 13) % 256, 255),
    );
    expect(medianCut(pixels, 12)).toEqual(medianCut(pixels, 12));
  });

  it('limits the request to a sensible range', () => {
    const pixels = Uint32Array.from({ length: 400 }, (_, i) =>
      packRgba(i % 256, (i * 3) % 256, (i * 7) % 256, 255),
    );
    expect(medianCut(pixels, 1).length).toBeLessThanOrEqual(2);
    expect(medianCut(pixels, 500).length).toBeLessThanOrEqual(64);
    expect(medianCut(pixels, 7.9).length).toBeLessThanOrEqual(8);
  });

  it('reports progress up to completion', () => {
    const pixels = Uint32Array.from({ length: 400 }, (_, i) =>
      packRgba(i % 256, (i * 3) % 256, (i * 7) % 256, 255),
    );
    const steps: number[] = [];
    medianCut(pixels, 8, (done, total) => {
      expect(total).toBeGreaterThan(0);
      steps.push(done / total);
    });
    expect(steps.length).toBeGreaterThan(0);
    expect(steps.at(-1)).toBe(1);
    expect([...steps].sort((a, b) => a - b)).toEqual(steps);
  });

  it('handles a photo-sized sample quickly', () => {
    const pixels = new Uint32Array(256 * 256);
    for (let i = 0; i < pixels.length; i++) {
      pixels[i] = packRgba((i * 7919) % 256, (i * 104729) % 256, (i * 1299709) % 256, 255);
    }
    const started = performance.now();
    expect(medianCut(pixels, 64)).toHaveLength(64);
    expect(performance.now() - started).toBeLessThan(3000);
  });
});

describe('fitWithin', () => {
  it('keeps the aspect ratio and never upscales', () => {
    expect(fitWithin(4000, 3000, 256)).toEqual({ width: 256, height: 192 });
    expect(fitWithin(3000, 4000, 256)).toEqual({ width: 192, height: 256 });
    expect(fitWithin(100, 50, 256)).toEqual({ width: 100, height: 50 });
    expect(fitWithin(5000, 1, 256)).toEqual({ width: 256, height: 1 });
  });
});
