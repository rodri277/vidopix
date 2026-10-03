import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { packRgba } from '../domain/color.js';
import { PixelBuffer } from '../domain/pixel-buffer.js';
import { PatchRecorder } from '../history/patch-recorder.js';
import { BAYER_4X4, Painter, ditherAllows } from './painter.js';
import { DEFAULT_TOOL_OPTIONS, type ToolOptions } from './tool.js';

const RED = packRgba(255, 0, 0, 255);

const options = (changes: Partial<ToolOptions>): ToolOptions => ({
  ...DEFAULT_TOOL_OPTIONS,
  ...changes,
});

function painted(buffer: PixelBuffer): Set<string> {
  const result = new Set<string>();
  for (let y = 0; y < buffer.height; y++) {
    for (let x = 0; x < buffer.width; x++) {
      if (buffer.get(x, y) !== 0) result.add(`${String(x)},${String(y)}`);
    }
  }
  return result;
}

describe('Bayer matrix', () => {
  it('has each threshold from 0 to 15 exactly once', () => {
    expect([...BAYER_4X4].sort((a, b) => a - b)).toEqual(Array.from({ length: 16 }, (_, i) => i));
  });

  it('lets through a share of pixels equal to the density', () => {
    for (let density = 1; density <= 16; density++) {
      let allowed = 0;
      for (let y = 0; y < 4; y++)
        for (let x = 0; x < 4; x++) if (ditherAllows(x, y, density)) allowed++;
      expect(allowed).toBe(density);
    }
  });

  it('repeats every four pixels and treats 16 as solid', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 200 }),
        fc.integer({ min: 0, max: 200 }),
        fc.integer({ min: 1, max: 16 }),
        (x, y, density) => {
          expect(ditherAllows(x + 4, y + 8, density)).toBe(ditherAllows(x, y, density));
          expect(ditherAllows(x, y, 16)).toBe(true);
        },
      ),
    );
  });

  it('adds pixels as the density grows, never removes them', () => {
    for (let density = 1; density < 16; density++) {
      for (let y = 0; y < 4; y++) {
        for (let x = 0; x < 4; x++) {
          if (ditherAllows(x, y, density)) expect(ditherAllows(x, y, density + 1)).toBe(true);
        }
      }
    }
  });
});

describe('Painter', () => {
  function run(opts: Partial<ToolOptions>, plots: [number, number][], size = 8): PixelBuffer {
    const buffer = PixelBuffer.create(size, size);
    const painter = new Painter(new PatchRecorder(buffer), options(opts), size, size);
    for (const [x, y] of plots) painter.paint(x, y, RED);
    return buffer;
  }

  it('paints exactly what it is given when no aid is on', () => {
    expect(
      painted(
        run({}, [
          [1, 2],
          [3, 4],
        ]),
      ),
    ).toEqual(new Set(['1,2', '3,4']));
  });

  it('mirrors across the vertical axis, the horizontal axis, or both', () => {
    expect(painted(run({ mirrorX: true }, [[1, 2]]))).toEqual(new Set(['1,2', '6,2']));
    expect(painted(run({ mirrorY: true }, [[1, 2]]))).toEqual(new Set(['1,2', '1,5']));
    expect(painted(run({ mirrorX: true, mirrorY: true }, [[1, 2]]))).toEqual(
      new Set(['1,2', '6,2', '1,5', '6,5']),
    );
  });

  it('does not double a pixel that sits on the axis (odd size)', () => {
    const points = new Painter(
      new PatchRecorder(PixelBuffer.create(5, 5)),
      options({ mirrorX: true, mirrorY: true }),
      5,
      5,
    ).expand(2, 2);
    expect(points).toEqual([[2, 2]]);
  });

  it('mirrors every pixel of a symmetric shape into a symmetric result', () => {
    fc.assert(
      fc.property(
        fc.array(fc.tuple(fc.integer({ min: 0, max: 9 }), fc.integer({ min: 0, max: 9 })), {
          minLength: 1,
          maxLength: 30,
        }),
        (plots) => {
          const result = painted(run({ mirrorX: true, mirrorY: true }, plots, 10));
          for (const key of result) {
            const [x, y] = key.split(',').map(Number) as [number, number];
            expect(result.has(`${String(9 - x)},${String(y)}`)).toBe(true);
            expect(result.has(`${String(x)},${String(9 - y)}`)).toBe(true);
          }
        },
      ),
    );
  });

  it('keeps only the pixels the dither pattern allows, anchored to the canvas', () => {
    const all: [number, number][] = [];
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) all.push([x, y]);
    const result = painted(run({ dither: 8 }, all));
    expect(result.size).toBe(32);
    for (const key of result) {
      const [x, y] = key.split(',').map(Number) as [number, number];
      expect(ditherAllows(x, y, 8)).toBe(true);
    }
  });

  it('applies the dither to the mirrored pixels too', () => {
    const buffer = PixelBuffer.create(8, 8);
    const painter = new Painter(
      new PatchRecorder(buffer),
      options({ mirrorX: true, dither: 4 }),
      8,
      8,
    );
    const expanded = painter.expand(0, 0);
    for (const [x, y] of expanded) expect(ditherAllows(x, y, 4)).toBe(true);
  });

  it('restores a pixel to what it was before', () => {
    const buffer = PixelBuffer.create(4, 4);
    buffer.set(1, 1, packRgba(9, 9, 9, 255));
    const recorder = new PatchRecorder(buffer);
    const painter = new Painter(recorder, options({}), 4, 4);
    painter.paint(1, 1, RED);
    painter.restore(1, 1, new Map([[1 * 4 + 1, packRgba(9, 9, 9, 255)]]));
    expect(buffer.get(1, 1)).toBe(packRgba(9, 9, 9, 255));
    expect(recorder.finish()).toBeNull();
  });
});
