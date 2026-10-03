import { describe, expect, it } from 'vitest';
import { packRgba } from '../domain/color.js';
import { createPalette } from '../domain/palette.js';
import { PixelBuffer } from '../domain/pixel-buffer.js';
import type { Sprite } from '../domain/sprite.js';
import { exportFrame } from './export.js';
import { indexFrames } from './gif-palette.js';
import { encodeGif } from './gif.js';

// ---- A small GIF reader, just enough to check what was written ----

interface DecodedFrame {
  delay: number;
  transparentIndex: number | null;
  disposal: number;
  /** Colors as packed RGBA, with transparent pixels as 0. */
  pixels: Uint32Array;
}

interface DecodedGif {
  width: number;
  height: number;
  loops: number | null;
  frames: DecodedFrame[];
}

function lzwDecode(data: Uint8Array, minCodeSize: number, length: number): Uint8Array {
  const clear = 1 << minCodeSize;
  const end = clear + 1;
  const out = new Uint8Array(length);
  let outPos = 0;
  let size = minCodeSize + 1;
  let table: number[][] = [];
  const reset = (): void => {
    table = [];
    for (let i = 0; i < clear; i++) table.push([i]);
    table.push([], []);
    size = minCodeSize + 1;
  };
  reset();
  let bits = 0;
  let bitCount = 0;
  let pos = 0;
  let previous: number[] | null = null;
  while (outPos < length) {
    while (bitCount < size && pos < data.length) {
      bits |= (data[pos++] ?? 0) << bitCount;
      bitCount += 8;
    }
    if (bitCount < size) break;
    const code = bits & ((1 << size) - 1);
    bits >>>= size;
    bitCount -= size;
    if (code === clear) {
      reset();
      previous = null;
      continue;
    }
    if (code === end) break;
    let entry: number[];
    const known = table[code];
    if (known) entry = known;
    else if (previous) entry = [...previous, previous[0] ?? 0];
    else throw new Error('bad LZW');
    for (const value of entry) if (outPos < length) out[outPos++] = value;
    if (previous) table.push([...previous, entry[0] ?? 0]);
    if (table.length === 1 << size && size < 12) size++;
    previous = entry;
  }
  return out;
}

function readGif(bytes: Uint8Array): DecodedGif {
  const text = (at: number, n: number): string =>
    String.fromCharCode(...bytes.subarray(at, at + n));
  expect(text(0, 6)).toBe('GIF89a');
  const u16 = (at: number): number => (bytes[at] ?? 0) | ((bytes[at + 1] ?? 0) << 8);
  const width = u16(6);
  const height = u16(8);
  const flags = bytes[10] ?? 0;
  let pos = 13;
  const readTable = (size: number): number[][] => {
    const table: number[][] = [];
    for (let i = 0; i < size; i++) {
      table.push([bytes[pos] ?? 0, bytes[pos + 1] ?? 0, bytes[pos + 2] ?? 0]);
      pos += 3;
    }
    return table;
  };
  const global = flags & 0x80 ? readTable(1 << ((flags & 7) + 1)) : [];
  const result: DecodedGif = { width, height, loops: null, frames: [] };
  let pending: { delay: number; transparentIndex: number | null; disposal: number } = {
    delay: 0,
    transparentIndex: null,
    disposal: 0,
  };
  const subBlocks = (): Uint8Array => {
    const parts: number[] = [];
    for (let size = bytes[pos++] ?? 0; size > 0; size = bytes[pos++] ?? 0) {
      for (let i = 0; i < size; i++) parts.push(bytes[pos + i] ?? 0);
      pos += size;
    }
    return Uint8Array.from(parts);
  };
  while (pos < bytes.length) {
    const block = bytes[pos++];
    if (block === 0x3b) break;
    if (block === 0x21) {
      const label = bytes[pos++];
      if (label === 0xf9) {
        const data = subBlocks();
        const packed = data[0] ?? 0;
        pending = {
          delay: ((data[1] ?? 0) | ((data[2] ?? 0) << 8)) * 10,
          transparentIndex: packed & 1 ? (data[3] ?? 0) : null,
          disposal: (packed >> 2) & 7,
        };
      } else {
        subBlocks();
      }
      continue;
    }
    if (block === 0x2c) {
      const w = u16(pos + 4);
      const h = u16(pos + 6);
      const local = bytes[pos + 8] ?? 0;
      pos += 9;
      const table = local & 0x80 ? readTable(1 << ((local & 7) + 1)) : global;
      const minCode = bytes[pos++] ?? 8;
      const indexes = lzwDecode(subBlocks(), minCode, w * h);
      const pixels = new Uint32Array(w * h);
      indexes.forEach((index, i) => {
        if (index === pending.transparentIndex) return;
        const [r = 0, g = 0, b = 0] = table[index] ?? [];
        pixels[i] = packRgba(r, g, b, 255);
      });
      result.frames.push({ ...pending, pixels });
      pending = { delay: 0, transparentIndex: null, disposal: 0 };
    }
  }
  return result;
}

/** Netscape loop extension: 0 means forever. */
function loopCount(bytes: Uint8Array): number | null {
  const marker = 'NETSCAPE2.0';
  for (let i = 0; i < bytes.length - 16; i++) {
    if (String.fromCharCode(...bytes.subarray(i, i + marker.length)) === marker) {
      return (bytes[i + 13] ?? 0) | ((bytes[i + 14] ?? 0) << 8);
    }
  }
  return null;
}

// ---- Sprites ----

function spriteOf(width: number, height: number, cels: PixelBuffer[], durations: number[]): Sprite {
  const [first] = cels;
  if (!first) throw new Error('cels');
  return {
    id: 's',
    name: 'Anim',
    width,
    height,
    layers: [
      {
        id: 'l',
        name: 'L',
        visible: true,
        locked: false,
        opacity: 1,
        blendMode: 'normal',
        buffer: first,
        cels,
      },
    ],
    frames: durations.map((duration, index) => ({ id: `f${String(index)}`, duration })),
    palette: createPalette('p'),
  };
}

const RED = packRgba(255, 0, 0, 255);
const GREEN = packRgba(0, 255, 0, 255);
const BLUE = packRgba(0, 0, 255, 255);

function threeFrames(): Sprite {
  const cels = [RED, GREEN, BLUE].map((color, index) => {
    const cel = PixelBuffer.create(4, 3);
    cel.set(index, index, color);
    cel.set(3, 0, color);
    return cel;
  });
  return spriteOf(4, 3, cels, [100, 250, 40]);
}

describe('encodeGif', () => {
  it('writes every frame with its own duration and loops forever', () => {
    const bytes = encodeGif(threeFrames(), { scale: 1 });
    expect(bytes.ok).toBe(true);
    if (!bytes.ok) return;
    const gif = readGif(bytes.value);
    expect([gif.width, gif.height]).toEqual([4, 3]);
    expect(gif.frames.map((f) => f.delay)).toEqual([100, 250, 40]);
    expect(loopCount(bytes.value)).toBe(0);
  });

  it('keeps the pixels and the transparency of every frame', () => {
    const sprite = threeFrames();
    const bytes = encodeGif(sprite, { scale: 1 });
    if (!bytes.ok) throw new Error('gif');
    const gif = readGif(bytes.value);
    gif.frames.forEach((frame, index) => {
      const expected = exportFrame(sprite, index, { scale: 1 });
      if (!expected.ok) throw new Error('frame');
      expect([...frame.pixels]).toEqual([...expected.value.pixels]);
      expect(frame.transparentIndex).not.toBeNull();
      // A transparent frame clears itself before the next, so frames do not pile up.
      expect(frame.disposal).toBe(2);
    });
  });

  it('flags no transparency when every pixel is opaque', () => {
    const cel = PixelBuffer.create(2, 2);
    cel.fill(RED);
    const bytes = encodeGif(spriteOf(2, 2, [cel, cel.clone()], [60, 60]), { scale: 1 });
    if (!bytes.ok) throw new Error('gif');
    const gif = readGif(bytes.value);
    expect(gif.frames.every((f) => f.transparentIndex === null)).toBe(true);
    expect([...(gif.frames[0]?.pixels ?? [])]).toEqual([RED, RED, RED, RED]);
  });

  it('fills transparent pixels with the background color when given', () => {
    const cel = PixelBuffer.create(2, 1);
    cel.set(0, 0, RED);
    const bytes = encodeGif(spriteOf(2, 1, [cel], [100]), { scale: 1, background: BLUE });
    if (!bytes.ok) throw new Error('gif');
    const gif = readGif(bytes.value);
    expect(gif.frames[0]?.transparentIndex).toBeNull();
    expect([...(gif.frames[0]?.pixels ?? [])]).toEqual([RED, BLUE]);
  });

  it('scales by whole numbers', () => {
    const bytes = encodeGif(threeFrames(), { scale: 4 });
    if (!bytes.ok) throw new Error('gif');
    const gif = readGif(bytes.value);
    expect([gif.width, gif.height]).toEqual([16, 12]);
    expect(gif.frames[0]?.pixels[0]).toBe(RED);
    expect(gif.frames[0]?.pixels[3]).toBe(RED);
  });

  it('treats mostly transparent pixels as transparent and the rest as opaque', () => {
    const cel = PixelBuffer.create(3, 1);
    cel.set(0, 0, packRgba(10, 20, 30, 100));
    cel.set(1, 0, packRgba(10, 20, 30, 200));
    const bytes = encodeGif(spriteOf(3, 1, [cel], [100]), { scale: 1 });
    if (!bytes.ok) throw new Error('gif');
    const pixels = readGif(bytes.value).frames[0]?.pixels;
    expect(pixels?.[0]).toBe(0);
    expect(pixels?.[1]).toBe(packRgba(10, 20, 30, 255));
    expect(pixels?.[2]).toBe(0);
  });

  it('reports progress up to the total', () => {
    const calls: [number, number][] = [];
    encodeGif(threeFrames(), { scale: 1 }, (done, total) => calls.push([done, total]));
    expect(calls.at(-1)).toEqual([6, 6]);
    expect(calls.map(([done]) => done)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('refuses bad scales and sizes that are too large', () => {
    expect(encodeGif(threeFrames(), { scale: 0 })).toMatchObject({ ok: false });
    expect(encodeGif(threeFrames(), { scale: 33 })).toMatchObject({ ok: false });
    const wide = spriteOf(1024, 1, [PixelBuffer.create(1024, 1)], [100]);
    expect(encodeGif(wide, { scale: 17 })).toMatchObject({
      ok: false,
      error: { kind: 'too-large' },
    });
  });

  it('stays smooth for 32 frames of 64×64', () => {
    const cels = Array.from({ length: 32 }, (_, index) => {
      const cel = PixelBuffer.create(64, 64);
      for (let i = 0; i < 64; i++)
        cel.set((i + index * 2) % 64, i, packRgba(index * 8, i * 4, 99, 255));
      return cel;
    });
    const started = performance.now();
    const bytes = encodeGif(spriteOf(64, 64, cels, Array<number>(32).fill(100)), { scale: 1 });
    expect(bytes.ok).toBe(true);
    expect(performance.now() - started).toBeLessThan(1000);
    if (bytes.ok) expect(readGif(bytes.value).frames).toHaveLength(32);
  });
});

describe('indexFrames', () => {
  it('uses an exact palette with room for transparency when there are few colors', () => {
    const frame = Uint32Array.of(RED, 0, GREEN, RED);
    const result = indexFrames([frame]);
    expect(result.palette).toHaveLength(3);
    expect(result.transparentIndex).toBe(2);
    expect([...(result.frames[0] ?? [])]).toEqual([0, 2, 1, 0]);
  });

  it('shares one palette across frames and ignores alpha differences', () => {
    const result = indexFrames([
      Uint32Array.of(packRgba(5, 5, 5, 255)),
      Uint32Array.of(packRgba(5, 5, 5, 200), packRgba(6, 6, 6, 255)),
    ]);
    expect(result.palette).toEqual([
      [5, 5, 5],
      [6, 6, 6],
    ]);
    expect(result.transparentIndex).toBeNull();
  });

  it('keeps a lone transparent frame valid', () => {
    const result = indexFrames([new Uint32Array(4)]);
    expect(result.transparentIndex).toBe(0);
    expect(result.palette).toHaveLength(1);
  });

  it('reduces images with more colors than a GIF can hold', () => {
    const frame = new Uint32Array(1000);
    for (let i = 0; i < frame.length; i++)
      frame[i] = packRgba(i % 256, (i * 7) % 256, (i * 13) % 256, 255);
    frame[0] = 0;
    const result = indexFrames([frame]);
    expect(result.palette.length).toBeLessThanOrEqual(256);
    expect(result.transparentIndex).toBe(result.palette.length - 1);
    expect(result.frames[0]?.[0]).toBe(result.transparentIndex);
    expect(result.frames[0]?.every((v) => v < result.palette.length)).toBe(true);
  });

  it('reduces without a transparency entry when nothing is transparent', () => {
    const frame = new Uint32Array(2000);
    for (let i = 0; i < frame.length; i++)
      frame[i] = packRgba(i % 256, (i * 3) % 256, i % 199, 255);
    const result = indexFrames([frame]);
    expect(result.transparentIndex).toBeNull();
    expect(result.palette.length).toBeLessThanOrEqual(256);
  });
});
