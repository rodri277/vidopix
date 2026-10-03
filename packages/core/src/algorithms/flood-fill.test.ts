import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { packRgba, type Color } from '../domain/color.js';
import { PixelBuffer } from '../domain/pixel-buffer.js';
import { colorsWithinTolerance, floodFillSpans, type FillMode } from './flood-fill.js';

function filledPixels(
  buffer: PixelBuffer,
  x: number,
  y: number,
  mode: FillMode,
  tolerance: number,
): Set<string> {
  const filled = new Set<string>();
  floodFillSpans(buffer, x, y, { mode, tolerance }, (row, xStart, xEnd) => {
    for (let column = xStart; column <= xEnd; column++) {
      const key = `${String(column)},${String(row)}`;
      expect(filled.has(key)).toBe(false);
      filled.add(key);
    }
  });
  return filled;
}

/** Naive 4-connected breadth-first search, used as the oracle. */
function referenceFill(
  buffer: PixelBuffer,
  startX: number,
  startY: number,
  mode: FillMode,
  tolerance: number,
): Set<string> {
  const target = buffer.get(startX, startY);
  const result = new Set<string>();
  const matches = (x: number, y: number): boolean =>
    colorsWithinTolerance(buffer.get(x, y), target, tolerance);

  if (mode === 'global') {
    for (let y = 0; y < buffer.height; y++) {
      for (let x = 0; x < buffer.width; x++) {
        if (matches(x, y)) result.add(`${String(x)},${String(y)}`);
      }
    }
    return result;
  }

  const queue: [number, number][] = [[startX, startY]];
  result.add(`${String(startX)},${String(startY)}`);
  while (queue.length > 0) {
    const [x, y] = queue.shift() ?? [0, 0];
    for (const [nx, ny] of [
      [x + 1, y],
      [x - 1, y],
      [x, y + 1],
      [x, y - 1],
    ] as const) {
      const key = `${String(nx)},${String(ny)}`;
      if (buffer.contains(nx, ny) && !result.has(key) && matches(nx, ny)) {
        result.add(key);
        queue.push([nx, ny]);
      }
    }
  }
  return result;
}

const shades: Color[] = [0, 1, 2, 3].map((n) => packRgba(n * 4, n * 4, n * 4, 255));

const gridArbitrary = fc
  .record({
    width: fc.integer({ min: 1, max: 9 }),
    height: fc.integer({ min: 1, max: 9 }),
  })
  .chain(({ width, height }) =>
    fc.record({
      width: fc.constant(width),
      height: fc.constant(height),
      cells: fc.array(fc.constantFrom(...shades), {
        minLength: width * height,
        maxLength: width * height,
      }),
      x: fc.integer({ min: 0, max: width - 1 }),
      y: fc.integer({ min: 0, max: height - 1 }),
    }),
  );

function bufferFrom(width: number, height: number, cells: readonly Color[]): PixelBuffer {
  const buffer = PixelBuffer.create(width, height);
  cells.forEach((color, index) => {
    buffer.data[index] = color;
  });
  return buffer;
}

describe('colorsWithinTolerance', () => {
  it('requires an exact match at tolerance 0', () => {
    expect(colorsWithinTolerance(packRgba(1, 2, 3, 4), packRgba(1, 2, 3, 4), 0)).toBe(true);
    expect(colorsWithinTolerance(packRgba(1, 2, 3, 4), packRgba(1, 2, 3, 5), 0)).toBe(false);
  });

  it('accepts differences up to the tolerance in every channel', () => {
    const base = packRgba(100, 100, 100, 255);
    expect(colorsWithinTolerance(base, packRgba(110, 90, 105, 250), 10)).toBe(true);
    expect(colorsWithinTolerance(base, packRgba(111, 100, 100, 255), 10)).toBe(false);
    expect(colorsWithinTolerance(base, packRgba(100, 100, 100, 244), 10)).toBe(false);
  });
});

describe('floodFillSpans', () => {
  it('matches a naive breadth-first fill on random grids (contiguous)', () => {
    fc.assert(
      fc.property(
        gridArbitrary,
        fc.constantFrom(0, 4, 8, 12),
        ({ width, height, cells, x, y }, tolerance) => {
          const buffer = bufferFrom(width, height, cells);
          expect(filledPixels(buffer, x, y, 'contiguous', tolerance)).toEqual(
            referenceFill(buffer, x, y, 'contiguous', tolerance),
          );
        },
      ),
      { numRuns: 300 },
    );
  });

  it('matches a naive scan on random grids (global)', () => {
    fc.assert(
      fc.property(
        gridArbitrary,
        fc.constantFrom(0, 4, 8),
        ({ width, height, cells, x, y }, tolerance) => {
          const buffer = bufferFrom(width, height, cells);
          expect(filledPixels(buffer, x, y, 'global', tolerance)).toEqual(
            referenceFill(buffer, x, y, 'global', tolerance),
          );
        },
      ),
      { numRuns: 300 },
    );
  });

  it('does not cross a wall in contiguous mode but does in global mode', () => {
    const buffer = PixelBuffer.create(5, 1);
    const wall = packRgba(255, 0, 0, 255);
    buffer.set(2, 0, wall);
    expect(filledPixels(buffer, 0, 0, 'contiguous', 0).size).toBe(2);
    expect(filledPixels(buffer, 0, 0, 'global', 0).size).toBe(4);
  });

  it('reports nothing when the start is outside the buffer', () => {
    const buffer = PixelBuffer.create(4, 4);
    expect(filledPixels(buffer, -1, 0, 'contiguous', 0).size).toBe(0);
    expect(filledPixels(buffer, 0, 4, 'global', 0).size).toBe(0);
  });

  it('still works when the caller paints while spans arrive', () => {
    const buffer = PixelBuffer.create(6, 6);
    const paint = packRgba(9, 9, 9, 255);
    const seen = new Set<string>();
    floodFillSpans(buffer, 0, 0, { mode: 'contiguous', tolerance: 20 }, (y, xStart, xEnd) => {
      for (let x = xStart; x <= xEnd; x++) {
        buffer.set(x, y, paint);
        seen.add(`${String(x)},${String(y)}`);
      }
    });
    expect(seen.size).toBe(36);
  });

  it('fills a 1024x1024 canvas without overflowing the stack', () => {
    const buffer = PixelBuffer.create(1024, 1024);
    let pixels = 0;
    floodFillSpans(buffer, 512, 512, { mode: 'contiguous', tolerance: 0 }, (_y, xStart, xEnd) => {
      pixels += xEnd - xStart + 1;
    });
    expect(pixels).toBe(1024 * 1024);
  });

  it('survives a worst-case checkerboard-like canvas', () => {
    const buffer = PixelBuffer.create(512, 512);
    const other = packRgba(1, 1, 1, 255);
    for (let y = 0; y < 512; y++) {
      for (let x = 0; x < 512; x++) {
        if ((x + y) % 2 === 1) buffer.set(x, y, other);
      }
    }
    let pixels = 0;
    floodFillSpans(buffer, 0, 0, { mode: 'global', tolerance: 0 }, (_y, xStart, xEnd) => {
      pixels += xEnd - xStart + 1;
    });
    expect(pixels).toBe((512 * 512) / 2);
  });
});
