import { unpackRgba, type Color } from '@vidopix/core';

/** A packed color as a CSS `rgb()` string, for swatches. */
export function toCssColor(color: Color): string {
  const { r, g, b, a } = unpackRgba(color);
  return a === 255
    ? `rgb(${String(r)} ${String(g)} ${String(b)})`
    : `rgb(${String(r)} ${String(g)} ${String(b)} / ${String(Math.round((a / 255) * 100) / 100)})`;
}
