// gifenc ships no types; every project that reads this file needs to see ours.
// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="../types/gifenc.d.ts" />
import { applyPalette, quantize, type RgbColor } from 'gifenc';

/** Pixels with less alpha than this are transparent in a GIF, which has no partial transparency. */
export const GIF_OPAQUE_ALPHA = 128;
/** A GIF palette holds 256 entries; one is kept for transparency when it is needed. */
const PALETTE_SIZE = 256;
/** Most pixels looked at when picking colors for an image that has too many. */
const MAX_SAMPLE_PIXELS = 1 << 15;

export interface IndexedFrames {
  readonly palette: RgbColor[];
  /** Palette entry for transparent pixels, or null when no pixel is transparent. */
  readonly transparentIndex: number | null;
  /** One palette index per pixel, per frame. */
  readonly frames: Uint8Array[];
}

const isOpaque = (pixel: number): boolean => pixel >>> 24 >= GIF_OPAQUE_ALPHA;

/** Packed RGBA with the alpha forced to opaque, so colors that differ only in alpha are one. */
const rgbKey = (pixel: number): number => (pixel | 0xff000000) >>> 0;

/**
 * Turns frames of packed RGBA pixels into palette indexes for one shared palette. When the frames
 * use no more colors than fit, the palette is exact. Otherwise colors are reduced with a
 * quantizer, so images with many colors still export but may change slightly.
 */
export function indexFrames(frames: readonly Uint32Array[]): IndexedFrames {
  const colors = new Map<number, number>();
  let transparent = false;
  let tooMany = false;
  for (const frame of frames) {
    for (const pixel of frame) {
      if (!isOpaque(pixel)) {
        transparent = true;
      } else if (!tooMany) {
        const key = rgbKey(pixel);
        if (!colors.has(key)) colors.set(key, colors.size);
        if (colors.size > PALETTE_SIZE) tooMany = true;
      }
    }
  }
  const room = transparent ? PALETTE_SIZE - 1 : PALETTE_SIZE;
  return colors.size <= room && !tooMany
    ? exactPalette(frames, colors, transparent)
    : reducedPalette(frames, room, transparent);
}

const toRgb = (pixel: number): RgbColor => [
  pixel & 0xff,
  (pixel >>> 8) & 0xff,
  (pixel >>> 16) & 0xff,
];

function exactPalette(
  frames: readonly Uint32Array[],
  colors: ReadonlyMap<number, number>,
  transparent: boolean,
): IndexedFrames {
  const palette: RgbColor[] = [...colors.keys()].map(toRgb);
  const transparentIndex = transparent ? palette.length : null;
  if (transparentIndex !== null) palette.push([0, 0, 0]);
  if (palette.length === 0) palette.push([0, 0, 0]);

  const indexed = frames.map((frame) => {
    const out = new Uint8Array(frame.length);
    for (let i = 0; i < frame.length; i++) {
      const pixel = frame[i] ?? 0;
      out[i] = isOpaque(pixel) ? (colors.get(rgbKey(pixel)) ?? 0) : (transparentIndex ?? 0);
    }
    return out;
  });
  return { palette, transparentIndex, frames: indexed };
}

function reducedPalette(
  frames: readonly Uint32Array[],
  room: number,
  transparent: boolean,
): IndexedFrames {
  let total = 0;
  for (const frame of frames) total += frame.length;
  const stride = Math.max(1, Math.ceil(total / MAX_SAMPLE_PIXELS));
  const sample: number[] = [];
  let seen = 0;
  for (const frame of frames) {
    for (const pixel of frame) {
      if (isOpaque(pixel) && seen++ % stride === 0) sample.push(rgbKey(pixel));
    }
  }
  const palette = quantize(new Uint8Array(Uint32Array.from(sample).buffer), room);
  const transparentIndex = transparent ? palette.length : null;
  if (transparentIndex !== null) palette.push([0, 0, 0]);

  const indexed = frames.map((frame) => {
    const nearest = applyPalette(new Uint8Array(rgbOnly(frame).buffer), palette);
    if (transparentIndex !== null) {
      for (let i = 0; i < frame.length; i++) {
        if (!isOpaque(frame[i] ?? 0)) nearest[i] = transparentIndex;
      }
    }
    return nearest;
  });
  return { palette, transparentIndex, frames: indexed };
}

/** The frame with every alpha forced to opaque, which is what the palette lookup compares. */
function rgbOnly(frame: Uint32Array): Uint32Array {
  const copy = new Uint32Array(frame.length);
  for (let i = 0; i < frame.length; i++) copy[i] = rgbKey(frame[i] ?? 0);
  return copy;
}
