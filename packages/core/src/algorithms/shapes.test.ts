import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { traceEllipse, traceRect } from './shapes.js';

function collectRect(x0: number, y0: number, x1: number, y1: number, filled: boolean): Set<string> {
  const points = new Set<string>();
  traceRect(x0, y0, x1, y1, filled, (x, y) => points.add(`${String(x)},${String(y)}`));
  return points;
}

function collectEllipse(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  filled: boolean,
): Set<string> {
  const points = new Set<string>();
  traceEllipse(x0, y0, x1, y1, filled, (x, y) => points.add(`${String(x)},${String(y)}`));
  return points;
}

const corner = fc.integer({ min: -40, max: 40 });

describe('traceRect', () => {
  it('draws only the border when not filled', () => {
    const points = collectRect(0, 0, 3, 2, false);
    expect(points.size).toBe(10);
    expect(points.has('1,1')).toBe(false);
    expect(points.has('0,0') && points.has('3,0') && points.has('0,2') && points.has('3,2')).toBe(
      true,
    );
  });

  it('draws every pixel when filled', () => {
    expect(collectRect(0, 0, 3, 2, true).size).toBe(12);
  });

  it('accepts corners in any order', () => {
    fc.assert(
      fc.property(corner, corner, corner, corner, fc.boolean(), (x0, y0, x1, y1, filled) => {
        expect(collectRect(x0, y0, x1, y1, filled)).toEqual(collectRect(x1, y1, x0, y0, filled));
      }),
    );
  });

  it('collapses to a line or a point when degenerate', () => {
    expect(collectRect(2, 2, 2, 2, false).size).toBe(1);
    expect(collectRect(0, 1, 4, 1, false).size).toBe(5);
    expect(collectRect(1, 0, 1, 3, true).size).toBe(4);
  });

  it('stays inside its bounding box and has the right area when filled', () => {
    fc.assert(
      fc.property(corner, corner, corner, corner, (x0, y0, x1, y1) => {
        const width = Math.abs(x1 - x0) + 1;
        const height = Math.abs(y1 - y0) + 1;
        expect(collectRect(x0, y0, x1, y1, true).size).toBe(width * height);
      }),
    );
  });
});

describe('traceEllipse', () => {
  it('draws a single pixel for a 1x1 box', () => {
    expect([...collectEllipse(5, 5, 5, 5, false)]).toEqual(['5,5']);
  });

  it('stays inside its bounding box', () => {
    fc.assert(
      fc.property(corner, corner, corner, corner, fc.boolean(), (x0, y0, x1, y1, filled) => {
        const minX = Math.min(x0, x1);
        const maxX = Math.max(x0, x1);
        const minY = Math.min(y0, y1);
        const maxY = Math.max(y0, y1);
        for (const key of collectEllipse(x0, y0, x1, y1, filled)) {
          const [x, y] = key.split(',').map(Number) as [number, number];
          expect(x).toBeGreaterThanOrEqual(minX);
          expect(x).toBeLessThanOrEqual(maxX);
          expect(y).toBeGreaterThanOrEqual(minY);
          expect(y).toBeLessThanOrEqual(maxY);
        }
      }),
    );
  });

  it('is symmetric around the center of its box', () => {
    fc.assert(
      fc.property(corner, corner, corner, corner, fc.boolean(), (x0, y0, x1, y1, filled) => {
        const minX = Math.min(x0, x1);
        const maxX = Math.max(x0, x1);
        const minY = Math.min(y0, y1);
        const maxY = Math.max(y0, y1);
        const points = collectEllipse(x0, y0, x1, y1, filled);
        for (const key of points) {
          const [x, y] = key.split(',').map(Number) as [number, number];
          expect(points.has(`${String(minX + maxX - x)},${String(y)}`)).toBe(true);
          expect(points.has(`${String(x)},${String(minY + maxY - y)}`)).toBe(true);
        }
      }),
    );
  });

  it('touches the middle of every side of its box', () => {
    const points = collectEllipse(0, 0, 8, 6, false);
    expect(points.has('0,3')).toBe(true);
    expect(points.has('8,3')).toBe(true);
    expect(points.has('4,0')).toBe(true);
    expect(points.has('4,6')).toBe(true);
  });

  it('is a closed loop: every outline pixel has two neighbors in the outline', () => {
    const points = collectEllipse(0, 0, 15, 11, false);
    for (const key of points) {
      const [x, y] = key.split(',').map(Number) as [number, number];
      let neighbors = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if ((dx !== 0 || dy !== 0) && points.has(`${String(x + dx)},${String(y + dy)}`)) {
            neighbors++;
          }
        }
      }
      expect(neighbors).toBeGreaterThanOrEqual(2);
    }
  });

  it('fills the interior and includes the whole outline when filled', () => {
    const outline = collectEllipse(0, 0, 10, 8, false);
    const filled = collectEllipse(0, 0, 10, 8, true);
    for (const point of outline) expect(filled.has(point)).toBe(true);
    expect(filled.has('5,4')).toBe(true);
    expect(filled.size).toBeGreaterThan(outline.size);
  });

  it('accepts corners in any order', () => {
    fc.assert(
      fc.property(corner, corner, corner, corner, fc.boolean(), (x0, y0, x1, y1, filled) => {
        expect(collectEllipse(x0, y0, x1, y1, filled)).toEqual(
          collectEllipse(x1, y1, x0, y0, filled),
        );
      }),
    );
  });
});
