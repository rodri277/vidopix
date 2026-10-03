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
