import type { PlotFn } from '../algorithms/line.js';

/**
 * Plots a square brush of `size` pixels anchored on (x, y). Odd sizes are centered; even sizes
 * extend one pixel further to the right and bottom.
 */
export function stampBrush(x: number, y: number, size: number, plot: PlotFn): void {
  const offset = Math.floor((size - 1) / 2);
  const left = x - offset;
  const top = y - offset;
  for (let row = 0; row < size; row++) {
    for (let column = 0; column < size; column++) {
      plot(left + column, top + row);
    }
  }
}
