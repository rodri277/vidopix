import type { Color } from '@vidopix/core';
import type { ExtractMessage, ExtractRequest } from './palette.worker';

export type ExtractPhase = 'decoding' | 'reducing';

export class ExtractionCanceled extends Error {
  constructor() {
    super('Extraction canceled');
    this.name = 'ExtractionCanceled';
  }
}

export interface Extraction {
  readonly result: Promise<Color[]>;
  /** Stops the work immediately by terminating the worker. */
  cancel(): void;
}

/** Starts extracting a palette from an image file without blocking the page. */
export function startExtraction(
  file: Blob,
  count: number,
  onProgress: (phase: ExtractPhase, value: number) => void,
): Extraction {
  const worker = new Worker(new URL('./palette.worker.ts', import.meta.url), { type: 'module' });
  let settle: { resolve: (colors: Color[]) => void; reject: (error: Error) => void } | null = null;

  const result = new Promise<Color[]>((resolve, reject) => {
    settle = { resolve, reject };
    worker.onmessage = (event: MessageEvent<ExtractMessage>) => {
      const message = event.data;
      if (message.type === 'progress') {
        onProgress(message.phase, message.value);
        return;
      }
      worker.terminate();
      if (message.type === 'done') resolve(message.colors);
      else reject(new Error(message.message));
    };
    worker.onerror = () => {
      worker.terminate();
      reject(new Error('The image could not be read'));
    };
  });

  const request: ExtractRequest = { file, count };
  worker.postMessage(request);

  return {
    result,
    cancel: () => {
      worker.terminate();
      settle?.reject(new ExtractionCanceled());
    },
  };
}
