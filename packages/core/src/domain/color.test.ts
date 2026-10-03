import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { packRgba, parseHex, toHex, unpackRgba } from './color.js';

describe('packRgba / unpackRgba', () => {
  it('round-trips every channel', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 255 }),
        fc.integer({ min: 0, max: 255 }),
        fc.integer({ min: 0, max: 255 }),
        fc.integer({ min: 0, max: 255 }),
        (r, g, b, a) => {
          expect(unpackRgba(packRgba(r, g, b, a))).toEqual({ r, g, b, a });
        },
      ),
    );
  });

  it('stores bytes in memory order R, G, B, A on little-endian platforms', () => {
    const packed = packRgba(0x11, 0x22, 0x33, 0x44);
    const bytes = new Uint8Array(new Uint32Array([packed]).buffer);
    expect([...bytes]).toEqual([0x11, 0x22, 0x33, 0x44]);
  });

  it('keeps the packed value an unsigned 32-bit integer', () => {
    expect(packRgba(255, 255, 255, 255)).toBe(0xffffffff);
  });
});

describe('toHex', () => {
  it('omits alpha when fully opaque', () => {
    expect(toHex(packRgba(255, 0, 128, 255))).toBe('#ff0080');
  });

  it('includes alpha when translucent', () => {
    expect(toHex(packRgba(255, 0, 128, 64))).toBe('#ff008040');
  });
});

describe('parseHex', () => {
  it('parses 6-digit hex as opaque', () => {
    expect(parseHex('#ff0080')).toEqual({ ok: true, value: packRgba(255, 0, 128, 255) });
  });

  it('parses 8-digit hex with alpha', () => {
    expect(parseHex('#ff008040')).toEqual({ ok: true, value: packRgba(255, 0, 128, 64) });
  });

  it('parses 3-digit shorthand', () => {
    expect(parseHex('#f08')).toEqual({ ok: true, value: packRgba(255, 0, 136, 255) });
  });

  it('accepts a missing # and uppercase digits', () => {
    expect(parseHex('FF0080')).toEqual({ ok: true, value: packRgba(255, 0, 128, 255) });
  });

  it.each(['', '#', '#ff', '#ff00', '#ff00800', '#gg0000', '#ff0080400'])(
    'rejects malformed input %j',
    (input) => {
      const result = parseHex(input);
      expect(result.ok).toBe(false);
    },
  );

  it('round-trips with toHex for any color', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 0xffffffff }), (color) => {
        expect(parseHex(toHex(color))).toEqual({ ok: true, value: color });
      }),
    );
  });
});
