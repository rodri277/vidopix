import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { packRgba } from '../domain/color.js';
import { PixelBuffer } from '../domain/pixel-buffer.js';
import { applyPatch, createPatch, patchSizeBytes, revertPatch } from './pixel-patch.js';

const RED = packRgba(255, 0, 0, 255);
const BLUE = packRgba(0, 0, 255, 255);

describe('createPatch', () => {
  it('returns null when nothing changed', () => {
    const buffer = PixelBuffer.create(4, 4);
    buffer.set(1, 1, RED);
    expect(createPatch(buffer, [5], [RED])).toBeNull();
    expect(createPatch(buffer, [], [])).toBeNull();
  });

  it('prefers the sparse form for a few scattered pixels', () => {
    const buffer = PixelBuffer.create(64, 64);
    buffer.set(0, 0, RED);
    buffer.set(63, 63, RED);
    const patch = createPatch(buffer, [0, 63 * 64 + 63], [0, 0]);
    expect(patch?.kind).toBe('sparse');
    expect(patch?.bounds).toEqual({ x: 0, y: 0, width: 64, height: 64 });
  });

  it('prefers the rectangle form when most of the box changed', () => {
    const buffer = PixelBuffer.create(8, 8);
    buffer.fill(RED);
    const indices = Array.from({ length: 64 }, (_, i) => i);
    const patch = createPatch(buffer, indices, new Array<number>(64).fill(0));
    expect(patch?.kind).toBe('rect');
    expect(patch).not.toBeNull();
    if (patch) expect(patchSizeBytes(patch)).toBe(64 * 8);
  });

  it('keeps the cheaper representation', () => {
    const buffer = PixelBuffer.create(100, 100);
    buffer.set(10, 10, RED);
    buffer.set(20, 30, RED);
    const patch = createPatch(buffer, [10 * 100 + 10, 30 * 100 + 20], [0, 0]);
    expect(patch).not.toBeNull();
    if (patch) expect(patchSizeBytes(patch)).toBe(2 * 12);
  });
});

describe('applyPatch / revertPatch', () => {
  it('round-trips random edits byte for byte, whichever form is chosen', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            x: fc.integer({ min: 0, max: 15 }),
            y: fc.integer({ min: 0, max: 15 }),
            color: fc.constantFrom(0, RED, BLUE),
          }),
          { minLength: 1, maxLength: 300 },
        ),
        (edits) => {
          const buffer = PixelBuffer.create(16, 16);
          for (let i = 0; i < 40; i++) buffer.set(i % 16, Math.floor(i / 16), BLUE);
          const original = buffer.clone();

          const firstSeen = new Map<number, number>();
          for (const { x, y, color } of edits) {
            const index = y * 16 + x;
            if (!firstSeen.has(index)) firstSeen.set(index, buffer.get(x, y));
            buffer.set(x, y, color);
          }
          const edited = buffer.clone();

          const patch = createPatch(buffer, [...firstSeen.keys()], [...firstSeen.values()]);
          if (!patch) {
            expect(edited.equals(original)).toBe(true);
            return;
          }
          revertPatch(buffer, patch);
          expect(buffer.equals(original)).toBe(true);
          applyPatch(buffer, patch);
          expect(buffer.equals(edited)).toBe(true);
        },
      ),
    );
  });
});
