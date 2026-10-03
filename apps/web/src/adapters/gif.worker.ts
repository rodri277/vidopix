import { PixelBuffer, createPalette, type Layer, type Sprite } from '@vidopix/core';
import { encodeGif } from '@vidopix/core/gif';

/** The parts of a sprite a GIF needs, as plain data that can cross to the worker. */
export interface GifSpriteData {
  readonly width: number;
  readonly height: number;
  readonly durations: readonly number[];
  readonly layers: readonly {
    readonly visible: boolean;
    readonly opacity: number;
    /** One packed-RGBA image per frame. */
    readonly cels: readonly Uint32Array[];
  }[];
}

export interface GifRequest {
  readonly sprite: GifSpriteData;
  readonly scale: number;
  readonly background?: number;
}

export type GifMessage =
  | { readonly type: 'progress'; readonly done: number; readonly total: number }
  | { readonly type: 'done'; readonly bytes: Uint8Array<ArrayBuffer> }
  | { readonly type: 'error'; readonly message: string };

const post = (message: GifMessage, transfer: Transferable[] = []): void => {
  (
    self as unknown as { postMessage(message: GifMessage, transfer: Transferable[]): void }
  ).postMessage(message, transfer);
};

function rebuild(data: GifSpriteData): Sprite {
  const layers: Layer[] = data.layers.map((layer, index) => {
    const cels = layer.cels.map((pixels) => {
      const cel = PixelBuffer.create(data.width, data.height);
      cel.data.set(pixels);
      return cel;
    });
    const [first] = cels;
    if (!first) throw new Error('A layer has no frames');
    return {
      id: `layer-${String(index)}`,
      name: `Layer ${String(index + 1)}`,
      visible: layer.visible,
      locked: false,
      opacity: layer.opacity,
      blendMode: 'normal',
      buffer: first,
      cels,
    };
  });
  return {
    id: 'export',
    name: 'export',
    width: data.width,
    height: data.height,
    layers,
    frames: data.durations.map((duration, index) => ({ id: `frame-${String(index)}`, duration })),
    palette: createPalette('export'),
  };
}

/** Runs off the main thread: builds the GIF and sends the bytes back. */
self.onmessage = (event: MessageEvent<GifRequest>) => {
  try {
    const { sprite, scale, background } = event.data;
    const result = encodeGif(
      rebuild(sprite),
      { scale, ...(background === undefined ? {} : { background }) },
      (done, total) => {
        post({ type: 'progress', done, total });
      },
    );
    if (!result.ok) {
      post({ type: 'error', message: result.error.kind });
      return;
    }
    const bytes = new Uint8Array(result.value);
    post({ type: 'done', bytes }, [bytes.buffer]);
  } catch (error) {
    post({ type: 'error', message: error instanceof Error ? error.message : 'GIF failed' });
  }
};
