import { describe, expect, it } from 'vitest';
import { packRgba, unpackRgba } from './color.js';
import { blendPixel, compositePixel, compositeRegion, compositeSprite } from './compositing.js';
import { PixelBuffer } from './pixel-buffer.js';
import type { Layer, Sprite } from './sprite.js';

const RED = packRgba(255, 0, 0, 255);
const BLUE = packRgba(0, 0, 255, 255);

function layer(buffer: PixelBuffer, overrides: Partial<Layer> = {}): Layer {
  return {
    id: 'l',
    name: 'Layer',
    visible: true,
    locked: false,
    opacity: 1,
    blendMode: 'normal',
    buffer,
    ...overrides,
  };
}

function spriteOf(width: number, height: number, ...layers: Layer[]): Sprite {
  return { id: 's', name: 'Test', width, height, layers };
}

describe('compositeSprite', () => {
  it('returns the layer pixels for a single opaque layer', () => {
    const buffer = PixelBuffer.create(3, 2);
    buffer.set(1, 1, RED);
    const result = compositeSprite(spriteOf(3, 2, layer(buffer)));
    expect(result.equals(buffer)).toBe(true);
    expect(result).not.toBe(buffer);
  });

  it('stacks layers bottom to top', () => {
    const bottom = PixelBuffer.create(2, 1);
    bottom.fill(RED);
    const top = PixelBuffer.create(2, 1);
    top.set(0, 0, BLUE);
    const result = compositeSprite(spriteOf(2, 1, layer(bottom), layer(top)));
    expect(result.get(0, 0)).toBe(BLUE);
    expect(result.get(1, 0)).toBe(RED);
  });

  it('skips hidden layers', () => {
    const buffer = PixelBuffer.create(1, 1);
    buffer.fill(RED);
    const result = compositeSprite(spriteOf(1, 1, layer(buffer, { visible: false })));
    expect(result.get(0, 0)).toBe(0);
  });

  it('applies layer opacity', () => {
    const buffer = PixelBuffer.create(1, 1);
    buffer.fill(RED);
    const result = compositeSprite(spriteOf(1, 1, layer(buffer, { opacity: 0.5 })));
    expect(unpackRgba(result.get(0, 0))).toEqual({ r: 255, g: 0, b: 0, a: 128 });
  });

  it('blends a translucent layer over an opaque one', () => {
    const bottom = PixelBuffer.create(1, 1);
    bottom.fill(RED);
    const top = PixelBuffer.create(1, 1);
    top.fill(packRgba(0, 0, 255, 128));
    const { r, g, b, a } = unpackRgba(
      compositeSprite(spriteOf(1, 1, layer(bottom), layer(top))).get(0, 0),
    );
    expect(a).toBe(255);
    expect(r).toBeGreaterThan(100);
    expect(b).toBeGreaterThan(100);
    expect(g).toBe(0);
  });
});

describe('compositeRegion', () => {
  it('recomputes only the requested region', () => {
    const buffer = PixelBuffer.create(4, 4);
    const sprite = spriteOf(4, 4, layer(buffer));
    const target = compositeSprite(sprite);

    buffer.set(1, 1, RED);
    buffer.set(3, 3, BLUE);
    compositeRegion(sprite, target, { x: 0, y: 0, width: 2, height: 2 });

    expect(target.get(1, 1)).toBe(RED);
    expect(target.get(3, 3)).toBe(0);
  });

  it('clears pixels that were erased inside the region', () => {
    const buffer = PixelBuffer.create(3, 1);
    buffer.fill(RED);
    const sprite = spriteOf(3, 1, layer(buffer));
    const target = compositeSprite(sprite);
    buffer.set(1, 0, 0);
    compositeRegion(sprite, target, { x: 1, y: 0, width: 1, height: 1 });
    expect([...target.data]).toEqual([RED, 0, RED]);
  });

  it('matches a full composite for any region that covers the changes', () => {
    const bottom = PixelBuffer.create(6, 6);
    bottom.fill(RED);
    const top = PixelBuffer.create(6, 6);
    const sprite = spriteOf(6, 6, layer(bottom), layer(top, { opacity: 0.5 }));
    const target = compositeSprite(sprite);
    top.set(2, 3, BLUE);
    top.set(4, 4, BLUE);
    compositeRegion(sprite, target, { x: 2, y: 3, width: 3, height: 2 });
    expect(target.equals(compositeSprite(sprite))).toBe(true);
  });

  it('clips regions that extend past the sprite and ignores empty ones', () => {
    const buffer = PixelBuffer.create(2, 2);
    buffer.fill(RED);
    const sprite = spriteOf(2, 2, layer(buffer));
    const target = PixelBuffer.create(2, 2);
    compositeRegion(sprite, target, { x: -5, y: -5, width: 100, height: 100 });
    expect(target.equals(buffer)).toBe(true);
    const untouched = PixelBuffer.create(2, 2);
    compositeRegion(sprite, untouched, { x: 5, y: 5, width: 2, height: 2 });
    expect(untouched.data.every((value) => value === 0)).toBe(true);
  });
});

describe('compositePixel', () => {
  it('matches the full composite at any point and ignores out-of-range points', () => {
    const bottom = PixelBuffer.create(3, 3);
    bottom.fill(RED);
    const top = PixelBuffer.create(3, 3);
    top.set(1, 1, packRgba(0, 0, 255, 128));
    const sprite = spriteOf(3, 3, layer(bottom), layer(top, { opacity: 0.5 }));
    const full = compositeSprite(sprite);
    for (let y = 0; y < 3; y++) {
      for (let x = 0; x < 3; x++) expect(compositePixel(sprite, x, y)).toBe(full.get(x, y));
    }
    expect(compositePixel(sprite, -1, 0)).toBe(0);
    expect(compositePixel(sprite, 3, 3)).toBe(0);
  });

  it('skips hidden layers', () => {
    const buffer = PixelBuffer.create(1, 1);
    buffer.fill(RED);
    expect(compositePixel(spriteOf(1, 1, layer(buffer, { visible: false })), 0, 0)).toBe(0);
  });
});

describe('blendPixel', () => {
  it('keeps the backdrop under a transparent source and replaces it under an opaque one', () => {
    expect(blendPixel(0, RED)).toBe(RED);
    expect(blendPixel(BLUE, RED)).toBe(BLUE);
    expect(blendPixel(RED, 0)).toBe(RED);
  });

  it('mixes a translucent source over an opaque backdrop', () => {
    const { r, b, a } = unpackRgba(blendPixel(packRgba(0, 0, 255, 128), RED));
    expect(a).toBe(255);
    expect(r).toBeGreaterThan(100);
    expect(b).toBeGreaterThan(100);
  });
});
