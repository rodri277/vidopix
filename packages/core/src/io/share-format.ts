import { packRgba } from '../domain/color.js';
import {
  MAX_PALETTE_COLORS,
  MAX_PALETTE_NAME_LENGTH,
  createPalette,
  paletteColor,
  type PaletteColor,
} from '../domain/palette.js';
import { MAX_CANVAS_SIZE, type PixelBuffer } from '../domain/pixel-buffer.js';
import {
  DEFAULT_FRAME_DURATION,
  MAX_FRAMES,
  MAX_FRAME_DURATION,
  MIN_FRAME_DURATION,
  type Frame,
  type Layer,
  type Sprite,
} from '../domain/sprite.js';
import type { IdGenerator } from '../ports/id-generator.js';
import { err, ok, type Result } from '../result.js';
import { base64ToBytes, bytesToBase64, utf8Decode, utf8Encode } from './bytes.js';
import { bytesToPixels, pixelsToBytes } from './pixel-bytes.js';

/**
 * A compact binary form of a sprite, meant to be compressed and put inside a link. It carries the
 * same things as a project file except identifiers, which are made up again when it is opened.
 */
const MAGIC_0 = 0x56; // V
const MAGIC_1 = 0x50; // P
/** Version 1 had one image per layer; version 2 adds frames. Both can be read. */
const VERSION = 2;
const MAX_LAYERS = 64;
const NAME_BYTES = 255;

/** The most pixel data a link may expand to. Guards against tiny links that unpack to gigabytes. */
export const MAX_SHARE_DECODED_BYTES = 4 * 1024 * 1024;
/** A link longer than this is not offered: some chat apps and servers cut long URLs. */
export const SHARE_MAX_FRAGMENT_CHARS = 6000;

export interface ShareError {
  readonly kind: 'invalid-share';
  readonly reason: 'not-a-share' | 'newer-version' | 'truncated' | 'invalid' | 'too-large';
  readonly message: string;
}

function failure(reason: ShareError['reason'], message: string): Result<never, ShareError> {
  return err({ kind: 'invalid-share', reason, message });
}

// ---- Writing ----

class Writer {
  private readonly chunks: Uint8Array[] = [];
  private length = 0;

  byte(value: number): void {
    this.bytes(Uint8Array.of(value & 0xff));
  }

  uint16(value: number): void {
    this.bytes(Uint8Array.of(value & 0xff, (value >> 8) & 0xff));
  }

  text(value: string): void {
    const encoded = utf8Encode(value).slice(0, NAME_BYTES);
    this.byte(encoded.length);
    this.bytes(encoded);
  }

  bytes(value: Uint8Array): void {
    this.chunks.push(value);
    this.length += value.length;
  }

  finish(): Uint8Array {
    const result = new Uint8Array(this.length);
    let offset = 0;
    for (const chunk of this.chunks) {
      result.set(chunk, offset);
      offset += chunk.length;
    }
    return result;
  }
}

export function encodeShare(sprite: Sprite): Uint8Array {
  const out = new Writer();
  out.bytes(Uint8Array.of(MAGIC_0, MAGIC_1, VERSION));
  out.text(sprite.name);
  out.uint16(sprite.width);
  out.uint16(sprite.height);
  out.text(sprite.palette.name);
  out.uint16(sprite.palette.colors.length);
  for (const { color, name } of sprite.palette.colors) {
    out.bytes(Uint8Array.of(color & 0xff, (color >>> 8) & 0xff, (color >>> 16) & 0xff));
    out.text(name ?? '');
  }
  out.byte(sprite.frames.length);
  for (const frame of sprite.frames) out.uint16(frame.duration);
  out.byte(sprite.layers.length);
  for (const layer of sprite.layers) {
    out.byte((layer.visible ? 1 : 0) | (layer.locked ? 2 : 0));
    out.byte(Math.round(layer.opacity * 255));
    out.text(layer.name);
    for (const cel of layer.cels) out.bytes(pixelsToBytes(cel));
  }
  return out.finish();
}

// ---- Reading ----

class Truncated extends Error {}

class Reader {
  private offset = 0;

  constructor(private readonly data: Uint8Array) {}

  get remaining(): number {
    return this.data.length - this.offset;
  }

  byte(): number {
    const value = this.data[this.offset];
    if (value === undefined) throw new Truncated();
    this.offset++;
    return value;
  }

  uint16(): number {
    return this.byte() | (this.byte() << 8);
  }

  take(count: number): Uint8Array {
    if (count > this.remaining) throw new Truncated();
    const slice = this.data.subarray(this.offset, this.offset + count);
    this.offset += count;
    return slice;
  }

  text(): string {
    const decoded = utf8Decode(this.take(this.byte()));
    if (decoded === null) throw new SyntaxError('text is not valid UTF-8');
    return decoded;
  }
}

export function decodeShare(data: Uint8Array, ids: IdGenerator): Result<Sprite, ShareError> {
  if (data.length < 3 || data[0] !== MAGIC_0 || data[1] !== MAGIC_1) {
    return failure('not-a-share', 'This link does not contain a Vidopix sprite');
  }
  if ((data[2] ?? 0) > VERSION) {
    return failure('newer-version', 'This link was made by a newer version of Vidopix');
  }

  const version = data[2] ?? 1;
  try {
    const input = new Reader(data.subarray(3));
    const name = input.text();
    const width = input.uint16();
    const height = input.uint16();
    if (width < 1 || height < 1 || width > MAX_CANVAS_SIZE || height > MAX_CANVAS_SIZE) {
      return failure('invalid', 'The sprite size in this link is not valid');
    }

    const paletteName = input.text();
    const colorCount = input.uint16();
    if (colorCount > MAX_PALETTE_COLORS)
      return failure('invalid', 'The palette in this link is too large');
    const colors: PaletteColor[] = [];
    for (let i = 0; i < colorCount; i++) {
      const [r = 0, g = 0, b = 0] = input.take(3);
      colors.push(paletteColor(packRgba(r, g, b, 255), input.text()));
    }

    const durations: number[] = [DEFAULT_FRAME_DURATION];
    if (version >= 2) {
      const frameCount = input.byte();
      if (frameCount < 1 || frameCount > MAX_FRAMES) {
        return failure('invalid', 'The number of frames in this link is not valid');
      }
      durations.length = 0;
      for (let i = 0; i < frameCount; i++) {
        const duration = input.uint16();
        if (duration < MIN_FRAME_DURATION || duration > MAX_FRAME_DURATION) {
          return failure('invalid', 'A frame duration in this link is not valid');
        }
        durations.push(duration);
      }
    }

    const layerCount = input.byte();
    if (layerCount < 1 || layerCount > MAX_LAYERS) {
      return failure('invalid', 'The number of layers in this link is not valid');
    }
    const layerBytes = width * height * 4;
    if (layerBytes * layerCount * durations.length > MAX_SHARE_DECODED_BYTES) {
      return failure('too-large', 'This sprite is too large to open from a link');
    }

    const spriteId = ids.next();
    const layers: Layer[] = [];
    for (let i = 0; i < layerCount; i++) {
      const flags = input.byte();
      const opacity = input.byte() / 255;
      const layerName = input.text();
      const cels: PixelBuffer[] = durations.map(() =>
        bytesToPixels(input.take(layerBytes), width, height),
      );
      const [first] = cels;
      if (!first) return failure('invalid', 'This link is damaged');
      layers.push({
        id: ids.next(),
        name: layerName === '' ? `Layer ${String(i + 1)}` : layerName,
        visible: (flags & 1) !== 0,
        locked: (flags & 2) !== 0,
        opacity,
        blendMode: 'normal',
        buffer: first,
        cels,
      });
    }

    const palette = createPalette(
      ids.next(),
      paletteName.slice(0, MAX_PALETTE_NAME_LENGTH) || 'Palette',
      colors,
    );
    const frames: Frame[] = durations.map((duration) => ({ id: ids.next(), duration }));
    return ok({
      id: spriteId,
      name: name || 'Untitled',
      width,
      height,
      layers,
      frames,
      palette,
    });
  } catch (error) {
    if (error instanceof Truncated) return failure('truncated', 'This link is incomplete');
    return failure('invalid', 'This link is damaged');
  }
}

// ---- Link fragment ----

/** `s=<base64url>` for the part of the URL after `#`. */
export function shareFragment(compressed: Uint8Array): string {
  return `s=${bytesToBase64(compressed, true)}`;
}

/** The compressed bytes in a `#s=...` fragment, or null if there are none. */
export function readShareFragment(hash: string): Uint8Array | null {
  const fragment = hash.startsWith('#') ? hash.slice(1) : hash;
  if (!fragment.startsWith('s=')) return null;
  const payload = fragment.slice(2);
  if (payload === '') return null;
  return base64ToBytes(payload);
}
