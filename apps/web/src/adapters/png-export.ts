import type { ExportImage } from '@vidopix/core';

/** Encodes the image as PNG using the browser's own encoder. */
export async function encodePng(image: ExportImage): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = image.width;
  canvas.height = image.height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas 2D is not available in this browser');
  context.putImageData(new ImageData(image.toBytes(), image.width, image.height), 0, 0);
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('The browser could not encode the PNG'));
    }, 'image/png');
  });
}

export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  // Give the browser a moment to start the download before releasing the data.
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1000);
}

export function safeFileName(name: string, extension: string): string {
  const cleaned = name
    .replace(/[^\p{L}\p{N}_ .-]+/gu, '')
    .trim()
    .replace(/\s+/g, '-');
  return `${cleaned === '' ? 'sprite' : cleaned}.${extension}`;
}
