import { describe, expect, it } from 'vitest';
import { createSequentialIdGenerator } from '../ports/id-generator.js';
import { MAX_CANVAS_SIZE } from './pixel-buffer.js';
import { createSprite } from './sprite.js';

describe('createSprite', () => {
  it('creates a sprite with one empty, visible, opaque layer', () => {
    const result = createSprite({ width: 32, height: 16 }, createSequentialIdGenerator());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const sprite = result.value;
    expect(sprite.width).toBe(32);
    expect(sprite.height).toBe(16);
    expect(sprite.name).toBe('Untitled');
    expect(sprite.layers).toHaveLength(1);
    const layer = sprite.layers[0];
    expect(layer).toMatchObject({
      name: 'Layer 1',
      visible: true,
      locked: false,
      opacity: 1,
      blendMode: 'normal',
    });
    expect(layer?.buffer.width).toBe(32);
    expect(layer?.buffer.height).toBe(16);
  });

  it('uses the given name and generated ids', () => {
    const result = createSprite(
      { width: 8, height: 8, name: 'Hero' },
      createSequentialIdGenerator('x'),
    );
    expect(result.ok && result.value.name).toBe('Hero');
    expect(result.ok && result.value.id).toBe('x-1');
    expect(result.ok && result.value.layers[0]?.id).toBe('x-2');
  });

  it.each([
    [0, 8],
    [8, 0],
    [2.5, 8],
    [MAX_CANVAS_SIZE + 1, 8],
  ])('returns an error for size %d x %d instead of throwing', (width, height) => {
    const result = createSprite({ width, height }, createSequentialIdGenerator());
    expect(result).toEqual({
      ok: false,
      error: { kind: 'invalid-size', width, height, max: MAX_CANVAS_SIZE },
    });
  });
});
