import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { packRgba } from '../domain/color.js';
import { createPalette } from '../domain/palette.js';
import { PixelBuffer } from '../domain/pixel-buffer.js';
import type { Layer, Sprite } from '../domain/sprite.js';
import { createSequentialIdGenerator } from '../ports/id-generator.js';
import {
  MAX_SHARE_DECODED_BYTES,
  SHARE_MAX_FRAGMENT_CHARS,
  decodeShare,
  encodeShare,
  readShareFragment,
  shareFragment,
} from './share-format.js';

function makeSprite(width: number, height: number, seeds: number[], layerCount = 2): Sprite {
  const layers: Layer[] = Array.from({ length: layerCount }, (_, index) => {
    const buffer = PixelBuffer.create(width, height);
    for (let i = 0; i < buffer.data.length; i++) {
      const seed = seeds[(i + index) % seeds.length] ?? 0;
      buffer.data[i] =
        seed % 4 === 0
          ? 0
          : packRgba(seed % 256, (seed * 5) % 256, (seed * 11) % 256, 255 - (seed % 3) * 40);
    }
    return {
      id: `l${String(index)}`,
      name: index === 0 ? 'Fondo ñ' : `Layer ${String(index)}`,
      visible: index !== 1,
      locked: index === 1,
      opacity: index === 0 ? 1 : 0.4,
      blendMode: 'normal',
      buffer,
    };
  });
  return {
    id: 's',
    name: 'Héroe 🧙',
    width,
    height,
    layers,
    palette: createPalette('p', 'Warm', [
      { color: packRgba(250, 100, 10, 255), name: 'Orange' },
      { color: packRgba(1, 2, 3, 255) },
    ]),
  };
}

function expectSame(a: Sprite, b: Sprite): void {
  expect(b.name).toBe(a.name);
  expect([b.width, b.height]).toEqual([a.width, a.height]);
  expect(b.palette.name).toBe(a.palette.name);
  expect(b.palette.colors).toEqual(a.palette.colors);
  expect(b.layers).toHaveLength(a.layers.length);
  a.layers.forEach((layer, index) => {
    const other = b.layers[index];
    expect(other).toMatchObject({
      name: layer.name,
      visible: layer.visible,
      locked: layer.locked,
    });
    expect(other?.opacity).toBeCloseTo(layer.opacity, 2);
    expect(other?.buffer.equals(layer.buffer)).toBe(true);
  });
}

describe('encodeShare / decodeShare', () => {
  it('reproduces the sprite exactly, with fresh ids', () => {
    const sprite = makeSprite(7, 5, [3, 5, 9, 12, 20, 33]);
    const decoded = decodeShare(encodeShare(sprite), createSequentialIdGenerator('n'));
    expect(decoded.ok).toBe(true);
    if (!decoded.ok) return;
    expectSame(sprite, decoded.value);
    expect(decoded.value.id).toMatch(/^n-/);
    expect(new Set(decoded.value.layers.map((layer) => layer.id)).size).toBe(2);
  });

  it('round-trips random small sprites', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 10 }),
        fc.integer({ min: 1, max: 10 }),
        fc.array(fc.integer({ min: 0, max: 500 }), { minLength: 1, maxLength: 30 }),
        fc.integer({ min: 1, max: 4 }),
        (width, height, seeds, layers) => {
          const sprite = makeSprite(width, height, seeds, layers);
          const decoded = decodeShare(encodeShare(sprite), createSequentialIdGenerator());
          expect(decoded.ok).toBe(true);
          if (decoded.ok) expectSame(sprite, decoded.value);
        },
      ),
    );
  });

  it('never throws on damaged data: every truncation is a clean error', () => {
    const bytes = encodeShare(makeSprite(3, 3, [1, 2, 3, 5, 6], 2));
    for (let length = 0; length < bytes.length; length++) {
      const result = decodeShare(bytes.slice(0, length), createSequentialIdGenerator());
      expect(result.ok).toBe(false);
    }
  });

  it('survives arbitrary bytes', () => {
    fc.assert(
      fc.property(fc.uint8Array({ maxLength: 200 }), (bytes) => {
        const result = decodeShare(bytes, createSequentialIdGenerator());
        expect(typeof result.ok).toBe('boolean');
      }),
    );
  });

  it('rejects data that is not a share, or from a newer version', () => {
    const bytes = encodeShare(makeSprite(2, 2, [1, 2]));
    const wrongMagic = bytes.slice();
    wrongMagic[0] = 0;
    expect(decodeShare(wrongMagic, createSequentialIdGenerator())).toMatchObject({
      ok: false,
      error: { reason: 'not-a-share' },
    });
    const newer = bytes.slice();
    newer[2] = 99;
    expect(decodeShare(newer, createSequentialIdGenerator())).toMatchObject({
      ok: false,
      error: { reason: 'newer-version' },
    });
  });

  it('refuses sizes that would need too much memory before reading the pixels', () => {
    const big = makeSprite(1024, 1024, [1, 2, 3], 2);
    expect(1024 * 1024 * 4 * 2).toBeGreaterThan(MAX_SHARE_DECODED_BYTES);
    const result = decodeShare(encodeShare(big), createSequentialIdGenerator());
    expect(result).toMatchObject({ ok: false, error: { reason: 'too-large' } });
  });

  it('rejects an empty layer list and zero sizes', () => {
    const bytes = encodeShare(makeSprite(2, 2, [1, 2], 1));
    const zeroSize = bytes.slice();
    const widthAt = 4 + (zeroSize[3] ?? 0);
    zeroSize[widthAt] = 0;
    zeroSize[widthAt + 1] = 0;
    expect(decodeShare(zeroSize, createSequentialIdGenerator())).toMatchObject({ ok: false });
  });
});

describe('share fragment', () => {
  it('wraps bytes as s=<base64url> and reads them back', () => {
    const bytes = Uint8Array.from([0, 1, 2, 250, 251, 252, 253]);
    const fragment = shareFragment(bytes);
    expect(fragment).toMatch(/^s=[A-Za-z0-9_-]+$/);
    expect(readShareFragment(`#${fragment}`)).toEqual(bytes);
    expect(readShareFragment(fragment)).toEqual(bytes);
  });

  it('ignores other fragments and bad data', () => {
    expect(readShareFragment('')).toBeNull();
    expect(readShareFragment('#about')).toBeNull();
    expect(readShareFragment('#s=')).toBeNull();
    expect(readShareFragment('#s=%%%')).toBeNull();
  });

  it('exposes the character budget for links', () => {
    expect(SHARE_MAX_FRAGMENT_CHARS).toBeGreaterThan(1000);
  });
});
