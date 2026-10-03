import type { Sprite } from '@vidopix/core';
import type { GifMessage, GifRequest, GifSpriteData } from './gif.worker';

export class GifExportCanceled extends Error {
  constructor() {
    super('GIF export canceled');
    this.name = 'GifExportCanceled';
  }
}

export interface GifExport {
  readonly result: Promise<Blob>;
  /** Stops the work immediately by terminating the worker. */
  cancel(): void;
}

/** Copies the pixels the GIF needs, so the document can keep changing while it is encoded. */
export function toGifData(sprite: Sprite): GifSpriteData {
  return {
    width: sprite.width,
    height: sprite.height,
    durations: sprite.frames.map((frame) => frame.duration),
    layers: sprite.layers.map((layer) => ({
      visible: layer.visible,
      opacity: layer.opacity,
      cels: layer.cels.map((cel) => cel.data.slice()),
    })),
  };
}

/** Starts encoding the animation as a GIF in a worker, without blocking the page. */
export function startGifExport(
  sprite: Sprite,
  options: { readonly scale: number; readonly background?: number },
  onProgress: (fraction: number) => void,
): GifExport {
  const worker = new Worker(new URL('./gif.worker.ts', import.meta.url), { type: 'module' });
  let reject: ((error: Error) => void) | null = null;

  const result = new Promise<Blob>((resolve, fail) => {
    reject = fail;
    worker.onmessage = (event: MessageEvent<GifMessage>) => {
      const message = event.data;
      if (message.type === 'progress') {
        onProgress(message.done / message.total);
        return;
      }
      worker.terminate();
      if (message.type === 'done') resolve(new Blob([message.bytes], { type: 'image/gif' }));
      else fail(new Error(message.message));
    };
    worker.onerror = () => {
      worker.terminate();
      fail(new Error('The GIF could not be created'));
    };
  });

  const data = toGifData(sprite);
  const request: GifRequest = {
    sprite: data,
    scale: options.scale,
    ...(options.background === undefined ? {} : { background: options.background }),
  };
  worker.postMessage(
    request,
    data.layers.flatMap((layer) => layer.cels.map((cel) => cel.buffer)),
  );

  return {
    result,
    cancel: () => {
      worker.terminate();
      reject?.(new GifExportCanceled());
    },
  };
}
