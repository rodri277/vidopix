import { describe, expect, it } from 'vitest';
import { intersectRects, rectContains, rectFromCorners, rectsEqual, unionRects } from './rect.js';

describe('unionRects', () => {
  const a = { x: 0, y: 0, width: 2, height: 2 };
  const b = { x: 5, y: 3, width: 1, height: 4 };

  it('returns the smallest rectangle containing both', () => {
    expect(unionRects(a, b)).toEqual({ x: 0, y: 0, width: 6, height: 7 });
  });

  it('treats null as empty', () => {
    expect(unionRects(null, b)).toBe(b);
    expect(unionRects(a, null)).toBe(a);
    expect(unionRects(null, null)).toBeNull();
  });
});

describe('rectFromCorners', () => {
  it('includes both corners, in any order', () => {
    expect(rectFromCorners(2, 3, 5, 3)).toEqual({ x: 2, y: 3, width: 4, height: 1 });
    expect(rectFromCorners(5, 7, 2, 3)).toEqual({ x: 2, y: 3, width: 4, height: 5 });
    expect(rectFromCorners(4, 4, 4, 4)).toEqual({ x: 4, y: 4, width: 1, height: 1 });
  });
});

describe('intersectRects', () => {
  it('returns the overlap or null', () => {
    const a = { x: 0, y: 0, width: 4, height: 4 };
    expect(intersectRects(a, { x: 2, y: 1, width: 5, height: 2 })).toEqual({
      x: 2,
      y: 1,
      width: 2,
      height: 2,
    });
    expect(intersectRects(a, { x: 4, y: 0, width: 2, height: 2 })).toBeNull();
    expect(intersectRects(a, { x: -3, y: -3, width: 2, height: 2 })).toBeNull();
    expect(intersectRects(a, a)).toEqual(a);
  });
});

describe('rectContains / rectsEqual', () => {
  const r = { x: 2, y: 2, width: 3, height: 2 };
  it('tests points half-open on the far edges', () => {
    expect(rectContains(r, 2, 2)).toBe(true);
    expect(rectContains(r, 4, 3)).toBe(true);
    expect(rectContains(r, 5, 3)).toBe(false);
    expect(rectContains(r, 4, 4)).toBe(false);
    expect(rectContains(r, 1, 2)).toBe(false);
  });

  it('compares rectangles, treating null as nothing', () => {
    expect(rectsEqual(r, { ...r })).toBe(true);
    expect(rectsEqual(r, { ...r, width: 4 })).toBe(false);
    expect(rectsEqual(null, null)).toBe(true);
    expect(rectsEqual(r, null)).toBe(false);
  });
});
