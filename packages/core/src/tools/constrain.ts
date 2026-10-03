export interface Point {
  readonly x: number;
  readonly y: number;
}

/** Snaps the end of a line to the nearest of 0, 45 or 90 degrees from the start. */
export function constrainLine(start: Point, end: Point): Point {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const absX = Math.abs(dx);
  const absY = Math.abs(dy);
  if (absX > 2 * absY) return { x: end.x, y: start.y };
  if (absY > 2 * absX) return { x: start.x, y: end.y };
  const length = Math.max(absX, absY);
  return { x: start.x + Math.sign(dx) * length, y: start.y + Math.sign(dy) * length };
}

/** Makes the box between the two points a square, keeping the direction of the drag. */
export function constrainSquare(start: Point, end: Point): Point {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.max(Math.abs(dx), Math.abs(dy));
  return {
    x: start.x + (dx < 0 ? -length : length),
    y: start.y + (dy < 0 ? -length : length),
  };
}
