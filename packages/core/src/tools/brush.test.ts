import { describe, expect, it } from 'vitest';
import { stampBrush } from './brush.js';

function stamp(x: number, y: number, size: number): string[] {
  const points: string[] = [];
  stampBrush(x, y, size, (px, py) => points.push(`${String(px)},${String(py)}`));
  return points;
}

describe('stampBrush', () => {
  it('plots a single pixel at size 1', () => {
    expect(stamp(4, 5, 1)).toEqual(['4,5']);
  });

  it('centers odd sizes', () => {
    const points = stamp(5, 5, 3);
    expect(points).toHaveLength(9);
    expect(points).toContain('4,4');
    expect(points).toContain('6,6');
  });

  it('extends even sizes toward the bottom right', () => {
    const points = stamp(5, 5, 2);
    expect(points.sort()).toEqual(['5,5', '5,6', '6,5', '6,6']);
  });

  it('covers size x size pixels for every allowed size', () => {
    for (let size = 1; size <= 16; size++) {
      expect(new Set(stamp(20, 20, size)).size).toBe(size * size);
    }
  });
});
