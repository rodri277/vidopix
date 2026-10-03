declare module 'gifenc' {
  export type RgbColor = [number, number, number];

  export interface FrameOptions {
    /** The global palette on the first frame; later frames would get a local one. */
    palette?: RgbColor[] | undefined;
    /** Milliseconds. Stored in hundredths of a second. */
    delay?: number;
    transparent?: boolean;
    transparentIndex?: number;
    /** -1 once, 0 forever, n for n extra loops. Only read on the first frame. */
    repeat?: number;
    dispose?: number;
    colorDepth?: number;
  }

  export interface GifEncoder {
    writeFrame(index: Uint8Array, width: number, height: number, options?: FrameOptions): void;
    finish(): void;
    bytes(): Uint8Array;
  }

  export function GIFEncoder(options?: { initialCapacity?: number; auto?: boolean }): GifEncoder;
  export function quantize(
    rgba: Uint8Array | Uint8ClampedArray,
    maxColors: number,
    options?: { format?: 'rgb565' | 'rgb444' | 'rgba4444' },
  ): RgbColor[];
  export function applyPalette(
    rgba: Uint8Array | Uint8ClampedArray,
    palette: RgbColor[],
    format?: 'rgb565' | 'rgb444' | 'rgba4444',
  ): Uint8Array;
}
