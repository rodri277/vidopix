import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  MAX_ZOOM,
  MIN_ZOOM,
  centerViewport,
  clampZoom,
  fitViewport,
  nextZoom,
  pinchViewport,
  screenToDocument,
  zoomAt,
} from './viewport.js';

describe('screenToDocument', () => {
  it('maps screen points to the pixel underneath, rounding down', () => {
    const viewport = { zoom: 4, panX: 10, panY: 20 };
    expect(screenToDocument(viewport, 10, 20)).toEqual({ x: 0, y: 0 });
    expect(screenToDocument(viewport, 13, 23)).toEqual({ x: 0, y: 0 });
    expect(screenToDocument(viewport, 14, 24)).toEqual({ x: 1, y: 1 });
    expect(screenToDocument(viewport, 9, 19)).toEqual({ x: -1, y: -1 });
  });
});

describe('zoom levels', () => {
  it('clamps to the supported range and to whole numbers', () => {
    expect(clampZoom(0)).toBe(MIN_ZOOM);
    expect(clampZoom(200)).toBe(MAX_ZOOM);
    expect(clampZoom(3.6)).toBe(4);
    expect(clampZoom(Number.NaN)).toBe(MIN_ZOOM);
  });

  it('steps through the levels in both directions and stops at the ends', () => {
    expect(nextZoom(1, 1)).toBe(2);
    expect(nextZoom(2, 1)).toBe(3);
    expect(nextZoom(8, 1)).toBe(12);
    expect(nextZoom(8, -1)).toBe(6);
    expect(nextZoom(MAX_ZOOM, 1)).toBe(MAX_ZOOM);
    expect(nextZoom(MIN_ZOOM, -1)).toBe(MIN_ZOOM);
  });

  it('moves between levels even from a zoom that is not a listed level', () => {
    expect(nextZoom(10, 1)).toBe(12);
    expect(nextZoom(10, -1)).toBe(8);
  });
});

describe('zoomAt', () => {
  it('keeps the pixel under the anchor in place, within one screen pixel', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: MIN_ZOOM, max: MAX_ZOOM }),
        fc.integer({ min: MIN_ZOOM, max: MAX_ZOOM }),
        fc.integer({ min: -500, max: 500 }),
        fc.integer({ min: -500, max: 500 }),
        fc.integer({ min: 0, max: 800 }),
        fc.integer({ min: 0, max: 600 }),
        (from, to, panX, panY, anchorX, anchorY) => {
          const before = { zoom: from, panX, panY };
          const after = zoomAt(before, to, anchorX, anchorY);
          expect(after.zoom).toBe(to);
          const docBeforeX = (anchorX - before.panX) / before.zoom;
          const docAfterX = (anchorX - after.panX) / after.zoom;
          expect(Math.abs(docBeforeX - docAfterX) * to).toBeLessThanOrEqual(0.5 + 1e-9);
          const docBeforeY = (anchorY - before.panY) / before.zoom;
          const docAfterY = (anchorY - after.panY) / after.zoom;
          expect(Math.abs(docBeforeY - docAfterY) * to).toBeLessThanOrEqual(0.5 + 1e-9);
        },
      ),
    );
  });

  it('keeps whole-number pan so pixels stay crisp', () => {
    const result = zoomAt({ zoom: 3, panX: 7, panY: 11 }, 5, 101, 57);
    expect(Number.isInteger(result.panX)).toBe(true);
    expect(Number.isInteger(result.panY)).toBe(true);
  });

  it('clamps an out-of-range target', () => {
    expect(zoomAt({ zoom: 2, panX: 0, panY: 0 }, 500, 0, 0).zoom).toBe(MAX_ZOOM);
  });
});

describe('centerViewport / fitViewport', () => {
  it('centers a sprite in the view', () => {
    expect(centerViewport(4, 100, 80, 10, 10)).toEqual({ zoom: 4, panX: 30, panY: 20 });
  });

  it('fits the sprite at the largest level that leaves a margin', () => {
    const viewport = fitViewport(800, 600, 64, 64, 32);
    expect(viewport.zoom).toBe(8);
    expect(64 * viewport.zoom).toBeLessThanOrEqual(600 - 64);
    expect(viewport.panX).toBe(Math.round((800 - 64 * 8) / 2));
  });

  it('falls back to the minimum zoom when the sprite does not fit', () => {
    expect(fitViewport(100, 100, 1024, 1024, 8).zoom).toBe(MIN_ZOOM);
  });

  it('never exceeds the maximum zoom for tiny sprites', () => {
    expect(fitViewport(4000, 4000, 1, 1, 0).zoom).toBe(MAX_ZOOM);
  });
});

describe('pinchViewport', () => {
  const start = { zoom: 4, panX: 20, panY: 30 };
  const pair = (ax: number, ay: number, bx: number, by: number) => ({
    a: { x: ax, y: ay },
    b: { x: bx, y: by },
  });

  it('leaves the view alone when the fingers do not move', () => {
    const fingers = pair(100, 100, 200, 100);
    expect(pinchViewport(start, fingers, fingers)).toEqual(start);
  });

  it('pans when both fingers move together', () => {
    expect(pinchViewport(start, pair(100, 100, 200, 100), pair(130, 90, 230, 90))).toEqual({
      zoom: 4,
      panX: 50,
      panY: 20,
    });
  });

  it('zooms in when the fingers spread and out when they come together', () => {
    const spread = pinchViewport(start, pair(100, 100, 200, 100), pair(50, 100, 250, 100));
    expect(spread.zoom).toBe(8);
    const squeeze = pinchViewport(start, pair(100, 100, 300, 100), pair(150, 100, 250, 100));
    expect(squeeze.zoom).toBe(2);
  });

  it('keeps the document point between the fingers between the fingers', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: MIN_ZOOM, max: MAX_ZOOM }),
        fc.integer({ min: -300, max: 300 }),
        fc.integer({ min: -300, max: 300 }),
        fc.integer({ min: 50, max: 300 }),
        fc.integer({ min: 50, max: 300 }),
        fc.integer({ min: -100, max: 100 }),
        (zoom, panX, panY, width, newWidth, shift) => {
          const view = { zoom, panX, panY };
          const from = pair(200, 200, 200 + width, 200);
          const to = pair(200 + shift, 210, 200 + shift + newWidth, 210);
          const result = pinchViewport(view, from, to);
          const mid = (p: ReturnType<typeof pair>) => ({
            x: (p.a.x + p.b.x) / 2,
            y: (p.a.y + p.b.y) / 2,
          });
          const docBefore = { x: (mid(from).x - panX) / zoom, y: (mid(from).y - panY) / zoom };
          const docAfter = {
            x: (mid(to).x - result.panX) / result.zoom,
            y: (mid(to).y - result.panY) / result.zoom,
          };
          expect(Math.abs(docBefore.x - docAfter.x) * result.zoom).toBeLessThanOrEqual(0.5 + 1e-9);
          expect(Math.abs(docBefore.y - docAfter.y) * result.zoom).toBeLessThanOrEqual(0.5 + 1e-9);
        },
      ),
    );
  });

  it('stays inside the zoom range, and copes with fingers on the same spot', () => {
    expect(pinchViewport(start, pair(100, 100, 110, 100), pair(0, 100, 900, 100)).zoom).toBe(64);
    expect(pinchViewport(start, pair(0, 100, 900, 100), pair(100, 100, 101, 100)).zoom).toBe(1);
    expect(Number.isFinite(pinchViewport(start, pair(5, 5, 5, 5), pair(9, 9, 20, 20)).zoom)).toBe(
      true,
    );
  });
});
