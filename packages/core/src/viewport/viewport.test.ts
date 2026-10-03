import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  MAX_ZOOM,
  MIN_ZOOM,
  centerViewport,
  clampZoom,
  fitViewport,
  nextZoom,
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
