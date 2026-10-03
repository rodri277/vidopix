import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { traceLine } from './line.js';

function collect(x0: number, y0: number, x1: number, y1: number): [number, number][] {
  const points: [number, number][] = [];
  traceLine(x0, y0, x1, y1, (x, y) => points.push([x, y]));
  return points;
}

const coordinate = fc.integer({ min: -200, max: 200 });

describe('traceLine', () => {
  it('draws a single point when both ends are equal', () => {
    expect(collect(3, 4, 3, 4)).toEqual([[3, 4]]);
  });

  it('draws horizontal, vertical and diagonal lines exactly', () => {
    expect(collect(0, 0, 3, 0)).toEqual([
      [0, 0],
      [1, 0],
      [2, 0],
      [3, 0],
    ]);
    expect(collect(0, 3, 0, 0)).toEqual([
      [0, 3],
      [0, 2],
      [0, 1],
      [0, 0],
    ]);
    expect(collect(0, 0, 2, 2)).toEqual([
      [0, 0],
      [1, 1],
      [2, 2],
    ]);
  });

  it('starts at the first point and ends at the second', () => {
    fc.assert(
      fc.property(coordinate, coordinate, coordinate, coordinate, (x0, y0, x1, y1) => {
        const points = collect(x0, y0, x1, y1);
        expect(points[0]).toEqual([x0, y0]);
        expect(points[points.length - 1]).toEqual([x1, y1]);
      }),
    );
  });

  it('has no gaps: consecutive points touch and each step moves forward', () => {
    fc.assert(
      fc.property(coordinate, coordinate, coordinate, coordinate, (x0, y0, x1, y1) => {
        const points = collect(x0, y0, x1, y1);
        for (let i = 1; i < points.length; i++) {
          const [px, py] = points[i - 1] ?? [0, 0];
          const [cx, cy] = points[i] ?? [0, 0];
          const stepX = Math.abs(cx - px);
          const stepY = Math.abs(cy - py);
          expect(Math.max(stepX, stepY)).toBe(1);
        }
      }),
    );
  });

  it('draws exactly max(|dx|, |dy|) + 1 pixels', () => {
    fc.assert(
      fc.property(coordinate, coordinate, coordinate, coordinate, (x0, y0, x1, y1) => {
        expect(collect(x0, y0, x1, y1)).toHaveLength(
          Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) + 1,
        );
      }),
    );
  });
});
