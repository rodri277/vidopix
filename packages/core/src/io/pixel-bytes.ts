import { PixelBuffer } from '../domain/pixel-buffer.js';

export function pixelsToBytes(buffer: PixelBuffer): Uint8Array {
  const bytes = new Uint8Array(buffer.data.length * 4);
  for (let i = 0; i < buffer.data.length; i++) {
    const color = buffer.data[i] ?? 0;
    bytes[i * 4] = color & 0xff;
    bytes[i * 4 + 1] = (color >>> 8) & 0xff;
    bytes[i * 4 + 2] = (color >>> 16) & 0xff;
    bytes[i * 4 + 3] = color >>> 24;
  }
  return bytes;
}

export function bytesToPixels(bytes: Uint8Array, width: number, height: number): PixelBuffer {
  const buffer = PixelBuffer.create(width, height);
  for (let i = 0; i < buffer.data.length; i++) {
    const r = bytes[i * 4] ?? 0;
    const g = bytes[i * 4 + 1] ?? 0;
    const b = bytes[i * 4 + 2] ?? 0;
    const a = bytes[i * 4 + 3] ?? 0;
    buffer.data[i] = ((a << 24) | (b << 16) | (g << 8) | r) >>> 0;
  }
  return buffer;
}
