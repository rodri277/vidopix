import { traceLine, type PlotFn } from './line.js';

/** Rectangle between two opposite corners, in any order. Both corners are included. */
export function traceRect(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  filled: boolean,
  plot: PlotFn,
): void {
  const minX = Math.min(x0, x1);
  const maxX = Math.max(x0, x1);
  const minY = Math.min(y0, y1);
  const maxY = Math.max(y0, y1);

  if (filled) {
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) plot(x, y);
    }
    return;
  }

  traceLine(minX, minY, maxX, minY, plot);
  if (maxY > minY) traceLine(minX, maxY, maxX, maxY, plot);
  if (maxY - minY > 1) {
    traceLine(minX, minY + 1, minX, maxY - 1, plot);
    if (maxX > minX) traceLine(maxX, minY + 1, maxX, maxY - 1, plot);
  }
}

/**
 * Ellipse inscribed in the box between two opposite corners, in any order.
 * Integer-only midpoint algorithm (Zingl), so any box size gives a symmetric result.
 */
export function traceEllipse(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  filled: boolean,
  plot: PlotFn,
): void {
  if (filled) {
    const rows = new Map<number, { min: number; max: number }>();
    traceEllipseOutline(x0, y0, x1, y1, (x, y) => {
      const row = rows.get(y);
      if (row) {
        row.min = Math.min(row.min, x);
        row.max = Math.max(row.max, x);
      } else {
        rows.set(y, { min: x, max: x });
      }
    });
    for (const [y, { min, max }] of rows) {
      for (let x = min; x <= max; x++) plot(x, y);
    }
    return;
  }
  traceEllipseOutline(x0, y0, x1, y1, plot);
}

function traceEllipseOutline(
  cornerAX: number,
  cornerAY: number,
  cornerBX: number,
  cornerBY: number,
  plot: PlotFn,
): void {
  let left = Math.min(cornerAX, cornerBX);
  let right = Math.max(cornerAX, cornerBX);
  let top = Math.min(cornerAY, cornerBY);
  const width = right - left;
  const height = Math.max(cornerAY, cornerBY) - top;
  const oddHeight = height & 1;

  let dx = 4 * (1 - width) * height * height;
  let dy = 4 * (oddHeight + 1) * width * width;
  let error = dx + dy + oddHeight * width * width;
  top += Math.trunc((height + 1) / 2);
  let bottom = top - oddHeight;
  const stepY = 8 * width * width;
  const stepX = 8 * height * height;

  do {
    plot(right, top);
    plot(left, top);
    plot(left, bottom);
    plot(right, bottom);
    const doubled = 2 * error;
    if (doubled <= dy) {
      top++;
      bottom--;
      dy += stepY;
      error += dy;
    }
    if (doubled >= dx || 2 * error > dy) {
      left++;
      right--;
      dx += stepX;
      error += dx;
    }
  } while (left <= right);

  // Very flat ellipses stop early; finish the vertical tips.
  while (top - bottom < height) {
    plot(left - 1, top);
    plot(right + 1, top++);
    plot(left - 1, bottom);
    plot(right + 1, bottom--);
  }
}
