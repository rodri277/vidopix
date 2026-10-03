import type { Color } from '../domain/color.js';
import { packRgba } from '../domain/color.js';
import { colorToOklch } from '../domain/oklch.js';

export const MIN_EXTRACT_COLORS = 2;
export const MAX_EXTRACT_COLORS = 64;
/** Pixels with less alpha than this count as transparent and are ignored. */
const OPAQUE_ALPHA = 128;

export type ProgressFn = (done: number, total: number) => void;

interface Box {
  start: number;
  end: number;
  population: number;
  /** Channel with the widest spread (0 red, 1 green, 2 blue) and that spread. */
  channel: number;
  range: number;
}

const SHIFTS = [0, 8, 16] as const;

/** Largest size no bigger than `maxSide` on either side that keeps the aspect ratio. */
export function fitWithin(
  width: number,
  height: number,
  maxSide: number,
): { width: number; height: number } {
  const scale = Math.min(1, maxSide / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

/**
 * Median cut color quantization. Splits the set of colors, weighted by how many pixels use each,
 * along its widest channel until there are `count` groups, then averages each group. Transparent
 * pixels are ignored. The result is opaque and sorted from dark to light.
 */
export function medianCut(pixels: Uint32Array, count: number, onProgress?: ProgressFn): Color[] {
  const target = Math.min(MAX_EXTRACT_COLORS, Math.max(MIN_EXTRACT_COLORS, Math.floor(count)));

  const histogram = new Map<number, number>();
  for (const pixel of pixels) {
    if (pixel >>> 24 < OPAQUE_ALPHA) continue;
    const rgb = pixel & 0xffffff;
    histogram.set(rgb, (histogram.get(rgb) ?? 0) + 1);
  }
  if (histogram.size === 0) return [];

  const colors = Uint32Array.from(histogram.keys());
  const counts = Uint32Array.from(histogram.values());
  const order = Uint32Array.from({ length: colors.length }, (_, i) => i);

  if (colors.length <= target) {
    onProgress?.(1, 1);
    return sortByLightness(Array.from(colors, (rgb) => opaqueOf(rgb)));
  }

  const channelOf = (index: number, channel: number): number =>
    ((colors[order[index] ?? 0] ?? 0) >>> (SHIFTS[channel] ?? 0)) & 0xff;

  const measure = (start: number, end: number): Box => {
    const low = [255, 255, 255];
    const high = [0, 0, 0];
    let population = 0;
    for (let i = start; i < end; i++) {
      population += counts[order[i] ?? 0] ?? 0;
      for (let channel = 0; channel < 3; channel++) {
        const value = channelOf(i, channel);
        if (value < (low[channel] ?? 255)) low[channel] = value;
        if (value > (high[channel] ?? 0)) high[channel] = value;
      }
    }
    let best = 0;
    let bestRange = -1;
    for (let channel = 0; channel < 3; channel++) {
      const range = (high[channel] ?? 0) - (low[channel] ?? 0);
      if (range > bestRange) {
        best = channel;
        bestRange = range;
      }
    }
    return { start, end, population, channel: best, range: bestRange };
  };

  const boxes: Box[] = [measure(0, colors.length)];
  const total = target - 1;

  while (boxes.length < target) {
    let chosen = -1;
    let chosenScore = -1;
    boxes.forEach((box, index) => {
      if (box.end - box.start < 2 || box.range === 0) return;
      const score = box.population * box.range;
      if (score > chosenScore) {
        chosen = index;
        chosenScore = score;
      }
    });
    if (chosen < 0) break;

    const box = boxes[chosen];
    if (!box) break;
    const slice = Array.from(order.subarray(box.start, box.end));
    slice.sort(
      (a, b) =>
        (((colors[a] ?? 0) >>> (SHIFTS[box.channel] ?? 0)) & 0xff) -
          (((colors[b] ?? 0) >>> (SHIFTS[box.channel] ?? 0)) & 0xff) || a - b,
    );
    order.set(slice, box.start);

    let cumulative = 0;
    let split = box.start + 1;
    for (let i = box.start; i < box.end - 1; i++) {
      cumulative += counts[order[i] ?? 0] ?? 0;
      split = i + 1;
      if (cumulative * 2 >= box.population) break;
    }

    boxes.splice(chosen, 1, measure(box.start, split), measure(split, box.end));
    onProgress?.(boxes.length - 1, total);
  }
  onProgress?.(1, 1);

  const averaged = boxes.map((box) => {
    const sums = [0, 0, 0];
    for (let i = box.start; i < box.end; i++) {
      const weight = counts[order[i] ?? 0] ?? 0;
      for (let channel = 0; channel < 3; channel++) {
        sums[channel] = (sums[channel] ?? 0) + channelOf(i, channel) * weight;
      }
    }
    const [r, g, b] = sums.map((sum) => Math.round(sum / box.population));
    return packRgba(r ?? 0, g ?? 0, b ?? 0, 255);
  });
  return sortByLightness([...new Set(averaged)]);
}

function opaqueOf(rgb: number): Color {
  return (rgb | 0xff000000) >>> 0;
}

function sortByLightness(colors: Color[]): Color[] {
  return colors
    .map((color) => ({ color, l: colorToOklch(color).l }))
    .sort((a, b) => a.l - b.l || a.color - b.color)
    .map((entry) => entry.color);
}
