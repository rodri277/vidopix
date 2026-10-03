import { err, ok, type Result } from '../result.js';

/**
 * A color packed into one unsigned 32-bit integer so pixel buffers can share
 * memory with `ImageData`. On little-endian hardware (every browser target)
 * the bytes in memory are R, G, B, A, so the integer reads as 0xAABBGGRR.
 */
export type Color = number;

export interface Rgba {
  readonly r: number;
  readonly g: number;
  readonly b: number;
  readonly a: number;
}

export type ColorParseError = { readonly kind: 'invalid-hex'; readonly input: string };

export function packRgba(r: number, g: number, b: number, a: number): Color {
  return ((a << 24) | (b << 16) | (g << 8) | r) >>> 0;
}

export function unpackRgba(color: Color): Rgba {
  return {
    r: color & 0xff,
    g: (color >>> 8) & 0xff,
    b: (color >>> 16) & 0xff,
    a: (color >>> 24) & 0xff,
  };
}

const byteToHex = (value: number): string => value.toString(16).padStart(2, '0');

export function toHex(color: Color): string {
  const { r, g, b, a } = unpackRgba(color);
  const rgb = `#${byteToHex(r)}${byteToHex(g)}${byteToHex(b)}`;
  return a === 255 ? rgb : `${rgb}${byteToHex(a)}`;
}

const HEX_PATTERN = /^[0-9a-f]+$/i;

export function parseHex(input: string): Result<Color, ColorParseError> {
  const digits = input.startsWith('#') ? input.slice(1) : input;
  const expanded =
    digits.length === 3
      ? [...digits].map((digit) => digit + digit).join('')
      : digits;

  if ((expanded.length !== 6 && expanded.length !== 8) || !HEX_PATTERN.test(expanded)) {
    return err({ kind: 'invalid-hex', input });
  }

  const channel = (index: number): number => parseInt(expanded.slice(index * 2, index * 2 + 2), 16);
  const alpha = expanded.length === 8 ? channel(3) : 255;
  return ok(packRgba(channel(0), channel(1), channel(2), alpha));
}
