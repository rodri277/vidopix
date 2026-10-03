/** How the document is placed in the view. Units are screen pixels of whatever surface is used. */
export interface Viewport {
  /** Whole-number screen pixels per document pixel. */
  readonly zoom: number;
  /** Screen position of the document's top-left corner. */
  readonly panX: number;
  readonly panY: number;
}

export const MIN_ZOOM = 1;
export const MAX_ZOOM = 64;

/** Levels reached by the zoom in/out shortcuts. Any whole number from 1 to 64 is still valid. */
export const ZOOM_LEVELS: readonly number[] = [1, 2, 3, 4, 6, 8, 12, 16, 24, 32, 48, 64];

export function clampZoom(zoom: number): number {
  if (Number.isNaN(zoom)) return MIN_ZOOM;
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round(zoom)));
}

export function screenToDocument(
  viewport: Viewport,
  screenX: number,
  screenY: number,
): { x: number; y: number } {
  return {
    x: Math.floor((screenX - viewport.panX) / viewport.zoom),
    y: Math.floor((screenY - viewport.panY) / viewport.zoom),
  };
}

export function nextZoom(zoom: number, direction: 1 | -1): number {
  if (direction === 1) {
    return ZOOM_LEVELS.find((level) => level > zoom) ?? MAX_ZOOM;
  }
  return [...ZOOM_LEVELS].reverse().find((level) => level < zoom) ?? MIN_ZOOM;
}

/** Changes the zoom while keeping the document point under (anchorX, anchorY) where it is. */
export function zoomAt(
  viewport: Viewport,
  targetZoom: number,
  anchorX: number,
  anchorY: number,
): Viewport {
  const zoom = clampZoom(targetZoom);
  const docX = (anchorX - viewport.panX) / viewport.zoom;
  const docY = (anchorY - viewport.panY) / viewport.zoom;
  return {
    zoom,
    panX: Math.round(anchorX - docX * zoom),
    panY: Math.round(anchorY - docY * zoom),
  };
}

export function centerViewport(
  zoom: number,
  viewWidth: number,
  viewHeight: number,
  spriteWidth: number,
  spriteHeight: number,
): Viewport {
  const level = clampZoom(zoom);
  return {
    zoom: level,
    panX: Math.round((viewWidth - spriteWidth * level) / 2),
    panY: Math.round((viewHeight - spriteHeight * level) / 2),
  };
}

/** Largest zoom level at which the sprite fits with `margin` screen pixels around it. */
export function fitViewport(
  viewWidth: number,
  viewHeight: number,
  spriteWidth: number,
  spriteHeight: number,
  margin = 32,
): Viewport {
  const availableWidth = Math.max(1, viewWidth - margin * 2);
  const availableHeight = Math.max(1, viewHeight - margin * 2);
  const fitting = Math.floor(
    Math.min(availableWidth / spriteWidth, availableHeight / spriteHeight),
  );
  const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, fitting));
  return centerViewport(zoom, viewWidth, viewHeight, spriteWidth, spriteHeight);
}

export interface TouchPoint {
  readonly x: number;
  readonly y: number;
}

export interface TouchPair {
  readonly a: TouchPoint;
  readonly b: TouchPoint;
}

const distanceOf = (pair: TouchPair): number =>
  Math.hypot(pair.b.x - pair.a.x, pair.b.y - pair.a.y);
const midpointOf = (pair: TouchPair): TouchPoint => ({
  x: (pair.a.x + pair.b.x) / 2,
  y: (pair.a.y + pair.b.y) / 2,
});

/**
 * The view after two fingers move from `from` to `to`: spreading them zooms, moving them together
 * pans, and the document point that was between the fingers stays between them.
 */
export function pinchViewport(start: Viewport, from: TouchPair, to: TouchPair): Viewport {
  const ratio = distanceOf(to) / Math.max(1, distanceOf(from));
  const zoom = clampZoom(start.zoom * ratio);
  const before = midpointOf(from);
  const after = midpointOf(to);
  const docX = (before.x - start.panX) / start.zoom;
  const docY = (before.y - start.panY) / start.zoom;
  return {
    zoom,
    panX: Math.round(after.x - docX * zoom),
    panY: Math.round(after.y - docY * zoom),
  };
}
