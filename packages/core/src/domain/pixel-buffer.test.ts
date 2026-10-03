import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { packRgba } from './color.js';
import { MAX_CANVAS_SIZE, PixelBuffer } from './pixel-buffer.js';

const RED = packRgba(255, 0, 0, 255);

describe('PixelBuffer.create', () => {
  it('starts fully transparent', () => {
    const buffer = PixelBuffer.create(3, 2);
    expect(buffer.width).toBe(3);
    expect(buffer.height).toBe(2);
    expect(buffer.data).toHaveLength(6);
    expect(buffer.data.every((value) => value === 0)).toBe(true);
  });

  it.each([
    [0, 1],
    [1, 0],
    [-1, 4],
    [1.5, 4],
    [MAX_CANVAS_SIZE + 1, 4],
    [4, MAX_CANVAS_SIZE + 1],
    [Number.NaN, 4],
  ])('rejects invalid size %d x %d', (width, height) => {
    expect(() => PixelBuffer.create(width, height)).toThrow(RangeError);
  });

  it('accepts the maximum canvas size', () => {
    expect(PixelBuffer.create(MAX_CANVAS_SIZE, MAX_CANVAS_SIZE).data).toHaveLength(
      MAX_CANVAS_SIZE * MAX_CANVAS_SIZE,
    );
  });
});

describe('PixelBuffer get / set', () => {
  it('reads back what was written', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 7 }),
        fc.integer({ min: 0, max: 4 }),
        fc.integer({ min: 0, max: 0xffffffff }),
        (x, y, color) => {
          const buffer = PixelBuffer.create(8, 5);
          buffer.set(x, y, color);
          expect(buffer.get(x, y)).toBe(color);
        },
      ),
    );
  });

  it('uses row-major order', () => {
    const buffer = PixelBuffer.create(4, 3);
    buffer.set(2, 1, RED);
    expect(buffer.data[1 * 4 + 2]).toBe(RED);
  });

  it('ignores writes outside the bounds and reads them as transparent', () => {
    const buffer = PixelBuffer.create(2, 2);
    buffer.set(-1, 0, RED);
    buffer.set(0, 2, RED);
    buffer.set(2, 0, RED);
    expect(buffer.data.every((value) => value === 0)).toBe(true);
    expect(buffer.get(-1, 0)).toBe(0);
    expect(buffer.get(5, 5)).toBe(0);
  });

  it('reports whether a point is inside', () => {
    const buffer = PixelBuffer.create(2, 2);
    expect(buffer.contains(0, 0)).toBe(true);
    expect(buffer.contains(1, 1)).toBe(true);
    expect(buffer.contains(2, 1)).toBe(false);
    expect(buffer.contains(0, -1)).toBe(false);
  });
});

describe('PixelBuffer clone / fill / equals', () => {
  it('clones independently', () => {
    const original = PixelBuffer.create(2, 2);
    original.set(0, 0, RED);
    const copy = original.clone();
    copy.set(1, 1, RED);
    expect(original.get(1, 1)).toBe(0);
    expect(copy.get(0, 0)).toBe(RED);
  });

  it('fills every pixel', () => {
    const buffer = PixelBuffer.create(3, 3);
    buffer.fill(RED);
    expect(buffer.data.every((value) => value === RED)).toBe(true);
  });

  it('compares by size and content', () => {
    const a = PixelBuffer.create(2, 2);
    const b = PixelBuffer.create(2, 2);
    expect(a.equals(b)).toBe(true);
    b.set(1, 0, RED);
    expect(a.equals(b)).toBe(false);
    expect(a.equals(PixelBuffer.create(4, 1))).toBe(false);
  });
});
