import { packRgba, unpackRgba, type Color } from './color.js';
import { PixelBuffer } from './pixel-buffer.js';
import type { Rect } from './rect.js';
import type { Sprite } from './sprite.js';

/** Flattens the visible layers, bottom to top, into one buffer. */
export function compositeSprite(sprite: Sprite): PixelBuffer {
  const result = PixelBuffer.create(sprite.width, sprite.height);
  compositeRegion(sprite, result, { x: 0, y: 0, width: sprite.width, height: sprite.height });
  return result;
}

/**
 * Recomputes only `region` of `target` from the visible layers, so a small edit does not cost a
 * full composite. The region is clipped to the sprite.
 */
export function compositeRegion(sprite: Sprite, target: PixelBuffer, region: Rect): void {
  const x0 = Math.max(0, region.x);
  const y0 = Math.max(0, region.y);
  const x1 = Math.min(sprite.width, region.x + region.width);
  const y1 = Math.min(sprite.height, region.y + region.height);
  if (x1 <= x0 || y1 <= y0) return;

  for (let y = y0; y < y1; y++) {
    target.data.fill(0, y * sprite.width + x0, y * sprite.width + x1);
  }
  for (const layer of sprite.layers) {
    if (!layer.visible || layer.opacity <= 0) continue;
    blendOnto(target, layer.buffer, layer.opacity, x0, y0, x1, y1);
  }
}

export function blendOnto(
  target: PixelBuffer,
  source: PixelBuffer,
  opacity: number,
  x0 = 0,
  y0 = 0,
  x1 = target.width,
  y1 = target.height,
): void {
  const out = target.data;
  const input = source.data;
  const width = target.width;
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const i = y * width + x;
      const src = input[i] ?? 0;
      if (src >>> 24 === 0) continue;
      const dst = out[i] ?? 0;
      if (dst >>> 24 === 0 && opacity === 1) {
        out[i] = src;
        continue;
      }
      const s = unpackRgba(src);
      const d = unpackRgba(dst);
      const sa = (s.a / 255) * opacity;
      const da = d.a / 255;
      const outAlpha = sa + da * (1 - sa);
      const mix = (sc: number, dc: number): number =>
        Math.round((sc * sa + dc * da * (1 - sa)) / outAlpha);
      out[i] = packRgba(mix(s.r, d.r), mix(s.g, d.g), mix(s.b, d.b), Math.round(outAlpha * 255));
    }
  }
}

/** The color of one pixel of the flattened sprite. */
export function compositePixel(sprite: Sprite, x: number, y: number): Color {
  if (x < 0 || y < 0 || x >= sprite.width || y >= sprite.height) return 0;
  const target = PixelBuffer.create(1, 1);
  const single = PixelBuffer.create(1, 1);
  for (const layer of sprite.layers) {
    if (!layer.visible || layer.opacity <= 0) continue;
    single.data[0] = layer.buffer.get(x, y);
    blendOnto(target, single, layer.opacity);
  }
  return target.data[0] ?? 0;
}

/** Source-over blend of one straight-alpha pixel onto another. */
export function blendPixel(source: Color, backdrop: Color): Color {
  const sa = source >>> 24;
  if (sa === 0) return backdrop;
  const da = backdrop >>> 24;
  if (sa === 255 || da === 0) return source;
  const s = unpackRgba(source);
  const d = unpackRgba(backdrop);
  const a1 = sa / 255;
  const a2 = da / 255;
  const outAlpha = a1 + a2 * (1 - a1);
  const mix = (sc: number, dc: number): number =>
    Math.round((sc * a1 + dc * a2 * (1 - a1)) / outAlpha);
  return packRgba(mix(s.r, d.r), mix(s.g, d.g), mix(s.b, d.b), Math.round(outAlpha * 255));
}

/** The same color with its alpha multiplied by `opacity` (0 to 1). */
export function scaleAlpha(color: Color, opacity: number): Color {
  if (opacity >= 1) return color;
  const alpha = Math.round((color >>> 24) * Math.max(0, opacity));
  return ((alpha << 24) | (color & 0xffffff)) >>> 0;
}
