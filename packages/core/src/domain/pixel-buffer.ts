import type { Color } from './color.js';

export const MAX_CANVAS_SIZE = 1024;

function assertValidSize(width: number, height: number): void {
  const valid = (n: number): boolean => Number.isInteger(n) && n >= 1 && n <= MAX_CANVAS_SIZE;
  if (!valid(width) || !valid(height)) {
    throw new RangeError(
      `Pixel buffer size must be integers from 1 to ${String(MAX_CANVAS_SIZE)}, got ${String(width)}x${String(height)}`,
    );
  }
}

/** A row-major grid of packed RGBA pixels. Writes outside the bounds are ignored. */
export class PixelBuffer {
  private constructor(
    readonly width: number,
    readonly height: number,
    readonly data: Uint32Array,
  ) {}

  static create(width: number, height: number): PixelBuffer {
    assertValidSize(width, height);
    return new PixelBuffer(width, height, new Uint32Array(width * height));
  }

  contains(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.width && y < this.height;
  }

  get(x: number, y: number): Color {
    return this.contains(x, y) ? (this.data[y * this.width + x] ?? 0) : 0;
  }

  set(x: number, y: number, color: Color): void {
    if (this.contains(x, y)) {
      this.data[y * this.width + x] = color;
    }
  }

  fill(color: Color): void {
    this.data.fill(color);
  }

  clone(): PixelBuffer {
    return new PixelBuffer(this.width, this.height, this.data.slice());
  }

  equals(other: PixelBuffer): boolean {
    if (this.width !== other.width || this.height !== other.height) return false;
    for (let i = 0; i < this.data.length; i++) {
      if (this.data[i] !== other.data[i]) return false;
    }
    return true;
  }
}
