import { describe, expect, it } from 'vitest';
import { unionRects } from './rect.js';

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
