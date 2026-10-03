import { PixelBuffer, MAX_CANVAS_SIZE } from '@vidopix/core';
import type { SystemClipboard } from '../state/editor-store';

function toCanvas(image: PixelBuffer): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = image.width;
  canvas.height = image.height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas 2D is not available in this browser');
  context.putImageData(
    new ImageData(new Uint8ClampedArray(image.data.buffer), image.width, image.height),
    0,
    0,
  );
  return canvas;
}

function canvasToPng(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('The browser could not encode the PNG'));
    }, 'image/png');
  });
}

/** Decodes any image the browser understands into pixels. Returns null if it is too large. */
export async function decodeImage(source: Blob): Promise<PixelBuffer | null> {
  const bitmap = await createImageBitmap(source);
  try {
    if (bitmap.width > MAX_CANVAS_SIZE || bitmap.height > MAX_CANVAS_SIZE) return null;
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) throw new Error('Canvas 2D is not available in this browser');
    context.drawImage(bitmap, 0, 0);
    const { data } = context.getImageData(0, 0, bitmap.width, bitmap.height);
    const pixels = PixelBuffer.create(bitmap.width, bitmap.height);
    pixels.data.set(new Uint32Array(data.buffer.slice(0)));
    return pixels;
  } finally {
    bitmap.close();
  }
}

/** The first image file in a paste event, decoded, or null. */
export async function imageFromPasteEvent(event: ClipboardEvent): Promise<PixelBuffer | null> {
  const file = Array.from(event.clipboardData?.files ?? []).find((f) =>
    f.type.startsWith('image/'),
  );
  return file ? decodeImage(file) : null;
}

export const browserClipboard: SystemClipboard = {
  async writeImage(image) {
    const item = new ClipboardItem({ 'image/png': canvasToPng(toCanvas(image)) });
    await navigator.clipboard.write([item]);
  },

  async readImage() {
    const items = await navigator.clipboard.read();
    for (const item of items) {
      const type = item.types.find((t) => t.startsWith('image/'));
      if (type) return decodeImage(await item.getType(type));
    }
    return null;
  },
};
