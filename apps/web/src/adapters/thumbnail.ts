import { compositeSprite, type Sprite } from '@vidopix/core';

const THUMBNAIL_SIDE = 96;

/** A small PNG of the flattened sprite as a data URL, scaled with hard edges. */
export function makeThumbnail(sprite: Sprite): string {
  const flat = compositeSprite(sprite);
  const source = document.createElement('canvas');
  source.width = sprite.width;
  source.height = sprite.height;
  const sourceContext = source.getContext('2d');
  if (!sourceContext) return '';
  sourceContext.putImageData(
    new ImageData(new Uint8ClampedArray(flat.data.buffer), sprite.width, sprite.height),
    0,
    0,
  );

  const scale = Math.min(THUMBNAIL_SIDE / sprite.width, THUMBNAIL_SIDE / sprite.height);
  const target = document.createElement('canvas');
  target.width = Math.max(1, Math.round(sprite.width * scale));
  target.height = Math.max(1, Math.round(sprite.height * scale));
  const context = target.getContext('2d');
  if (!context) return '';
  context.imageSmoothingEnabled = false;
  context.drawImage(source, 0, 0, target.width, target.height);
  return target.toDataURL('image/png');
}
