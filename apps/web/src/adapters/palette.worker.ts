import { fitWithin, medianCut } from '@vidopix/core';

/** Largest side of the working copy. Palettes do not need more detail than this. */
const WORKING_SIDE = 256;

export interface ExtractRequest {
  readonly file: Blob;
  readonly count: number;
}

export type ExtractMessage =
  | { readonly type: 'progress'; readonly phase: 'decoding' | 'reducing'; readonly value: number }
  | { readonly type: 'done'; readonly colors: number[] }
  | { readonly type: 'error'; readonly message: string };

const post = (message: ExtractMessage): void => {
  (self as unknown as { postMessage(message: ExtractMessage): void }).postMessage(message);
};

/**
 * Runs off the main thread: decodes the image, shrinks it to a small working copy and reduces it
 * to a palette. The page can cancel by terminating the worker.
 */
async function extract({ file, count }: ExtractRequest): Promise<void> {
  post({ type: 'progress', phase: 'decoding', value: 0 });
  const bitmap = await createImageBitmap(file);
  const { width, height } = fitWithin(bitmap.width, bitmap.height, WORKING_SIDE);
  const canvas = new OffscreenCanvas(width, height);
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('Canvas 2D is not available in this browser');
  context.imageSmoothingQuality = 'high';
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const { data } = context.getImageData(0, 0, width, height);
  post({ type: 'progress', phase: 'decoding', value: 1 });

  const colors = medianCut(new Uint32Array(data.buffer), count, (done, total) => {
    post({ type: 'progress', phase: 'reducing', value: done / total });
  });
  post({ type: 'done', colors });
}

self.onmessage = (event: MessageEvent<ExtractRequest>) => {
  extract(event.data).catch((error: unknown) => {
    post({
      type: 'error',
      message: error instanceof Error ? error.message : 'The image could not be read',
    });
  });
};
