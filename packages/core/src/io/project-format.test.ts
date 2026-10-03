import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { packRgba } from '../domain/color.js';
import { createPalette } from '../domain/palette.js';
import { PixelBuffer } from '../domain/pixel-buffer.js';
import type { Layer, Sprite } from '../domain/sprite.js';
import {
  MAX_PROJECT_BYTES,
  PROJECT_SCHEMA_VERSION,
  parseProject,
  serializeProject,
} from './project-format.js';
import { bytesToPixels, pixelsToBytes } from './pixel-bytes.js';

function makeSprite(
  width: number,
  height: number,
  pixelSeed: number[],
  extra: Partial<Sprite> = {},
): Sprite {
  const layer = (id: string, offset: number): Layer => {
    const buffer = PixelBuffer.create(width, height);
    for (let i = 0; i < buffer.data.length; i++) {
      const seed = pixelSeed[(i + offset) % pixelSeed.length] ?? 0;
      buffer.data[i] =
        seed % 3 === 0
          ? 0
          : packRgba(seed % 256, (seed * 7) % 256, (seed * 13) % 256, 40 + (seed % 200));
    }
    return {
      id,
      name: `Layer ${id}`,
      visible: offset % 2 === 0,
      locked: offset % 3 === 0,
      opacity: offset === 0 ? 1 : 0.5,
      blendMode: 'normal',
      buffer,
    };
  };
  return {
    id: 'sprite-1',
    name: 'Café 😀',
    width,
    height,
    layers: [layer('a', 0), layer('b', 1), layer('c', 2)],
    palette: createPalette('pal-1', 'Mine', [
      { color: packRgba(255, 0, 0, 255), name: 'Red' },
      { color: packRgba(0, 128, 255, 255) },
    ]),
    ...extra,
  };
}

function sameSprite(a: Sprite, b: Sprite): void {
  expect(b.id).toBe(a.id);
  expect(b.name).toBe(a.name);
  expect(b.width).toBe(a.width);
  expect(b.height).toBe(a.height);
  expect(b.palette).toEqual(a.palette);
  expect(b.layers).toHaveLength(a.layers.length);
  a.layers.forEach((layer, index) => {
    const other = b.layers[index];
    expect(other).toMatchObject({
      id: layer.id,
      name: layer.name,
      visible: layer.visible,
      locked: layer.locked,
      opacity: layer.opacity,
    });
    expect(other?.buffer.equals(layer.buffer)).toBe(true);
  });
}

describe('pixel bytes', () => {
  it('uses R, G, B, A order whatever the CPU', () => {
    const buffer = PixelBuffer.create(1, 1);
    buffer.set(0, 0, packRgba(1, 2, 3, 4));
    expect([...pixelsToBytes(buffer)]).toEqual([1, 2, 3, 4]);
    expect(bytesToPixels(Uint8Array.from([1, 2, 3, 4]), 1, 1).get(0, 0)).toBe(packRgba(1, 2, 3, 4));
  });
});

describe('serializeProject / parseProject', () => {
  it('round-trips a sprite byte for byte', () => {
    const sprite = makeSprite(5, 4, [1, 2, 3, 4, 5, 6, 7, 8, 9]);
    const parsed = parseProject(serializeProject(sprite));
    expect(parsed.ok).toBe(true);
    if (parsed.ok) sameSprite(sprite, parsed.value);
  });

  it('round-trips random sprites of any small size', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 12 }),
        fc.integer({ min: 1, max: 12 }),
        fc.array(fc.integer({ min: 0, max: 1000 }), { minLength: 1, maxLength: 40 }),
        (width, height, seed) => {
          const sprite = makeSprite(width, height, seed);
          const parsed = parseProject(serializeProject(sprite));
          expect(parsed.ok).toBe(true);
          if (parsed.ok) sameSprite(sprite, parsed.value);
        },
      ),
    );
  });

  it('writes a readable header', () => {
    const data = JSON.parse(serializeProject(makeSprite(2, 2, [1]))) as Record<string, unknown>;
    expect(data.format).toBe('vidopix');
    expect(data.schemaVersion).toBe(PROJECT_SCHEMA_VERSION);
  });

  it('keeps an empty palette and unnamed colors as they are', () => {
    const sprite = makeSprite(2, 2, [1], { palette: createPalette('p', 'Empty') });
    const parsed = parseProject(serializeProject(sprite));
    expect(parsed.ok && parsed.value.palette.colors).toEqual([]);
  });
});

describe('parseProject errors', () => {
  const valid = (): Record<string, unknown> =>
    JSON.parse(serializeProject(makeSprite(2, 2, [5, 6, 7]))) as Record<string, unknown>;
  const reason = (value: unknown, ...rest: unknown[]): string => {
    const result = parseProject(
      typeof value === 'string' ? value : JSON.stringify(value),
      ...(rest as []),
    );
    return result.ok ? 'ok' : result.error.reason;
  };
  const spriteOf = (data: Record<string, unknown>): Record<string, unknown> =>
    data.sprite as Record<string, unknown>;

  it('refuses files that are too large before reading them', () => {
    expect(reason('x'.repeat(MAX_PROJECT_BYTES + 1))).toBe('too-large');
  });

  it('refuses anything that is not a project', () => {
    expect(reason('{oops')).toBe('not-json');
    expect(reason('[]')).toBe('not-a-project');
    expect(reason('42')).toBe('not-a-project');
    expect(reason({ format: 'other', schemaVersion: 1 })).toBe('not-a-project');
    expect(reason({ format: 'vidopix' })).toBe('not-a-project');
  });

  it('explains versions it cannot read', () => {
    expect(reason({ ...valid(), schemaVersion: PROJECT_SCHEMA_VERSION + 1 })).toBe('newer-version');
    expect(reason({ ...valid(), schemaVersion: 0 })).toBe('invalid');
    expect(reason({ ...valid(), schemaVersion: 1.5 })).toBe('invalid');
  });

  it('rejects sprites outside the supported limits', () => {
    for (const change of [{ width: 0 }, { width: 2000 }, { height: 1.5 }, { layers: [] }]) {
      const data = valid();
      expect(reason({ ...data, sprite: { ...spriteOf(data), ...change } })).toBe('invalid');
    }
  });

  it('rejects layers whose pixels do not match the sprite size', () => {
    const data = valid();
    const sprite = spriteOf(data);
    const layers = sprite.layers as Record<string, unknown>[];
    const [first, ...others] = layers;
    expect(
      reason({ ...data, sprite: { ...sprite, layers: [{ ...first, pixels: 'AAAA' }, ...others] } }),
    ).toBe('pixels');
    expect(
      reason({ ...data, sprite: { ...sprite, layers: [{ ...first, pixels: '!!!' }, ...others] } }),
    ).toBe('pixels');
  });

  it('rejects layers that share an id', () => {
    const data = valid();
    const sprite = spriteOf(data);
    const layers = sprite.layers as Record<string, unknown>[];
    const [first] = layers;
    expect(reason({ ...data, sprite: { ...sprite, layers: [first, first] } })).toBe('invalid');
  });

  it('rejects bad palette colors', () => {
    const data = valid();
    const sprite = spriteOf(data);
    const palette = { id: 'p', name: 'x', colors: [{ hex: 'red' }] };
    expect(reason({ ...data, sprite: { ...sprite, palette } })).toBe('invalid');
  });

  it('ignores fields it does not know, so newer minor additions stay readable', () => {
    const data = valid();
    expect(reason({ ...data, extra: 1, sprite: { ...spriteOf(data), note: 'x' } })).toBe('ok');
  });
});

describe('migrations', () => {
  it('upgrades an older file one version at a time', () => {
    const data = JSON.parse(serializeProject(makeSprite(2, 2, [5, 6, 7]))) as Record<
      string,
      unknown
    >;
    const sprite = data.sprite as Record<string, unknown>;
    // Pretend version 1 called the sprite title "title" and that version 2 renamed it to "name".
    const { name, ...withoutName } = sprite;
    const old = { ...data, schemaVersion: 1, sprite: { ...withoutName, title: name } };
    const migrations = {
      1: (value: Record<string, unknown>) => {
        const { title, ...rest } = value.sprite as Record<string, unknown>;
        return { ...value, sprite: { ...rest, name: title } };
      },
    };
    const parsed = parseProject(JSON.stringify(old), migrations, 2);
    expect(parsed.ok && parsed.value.name).toBe('Café 😀');
  });

  it('fails clearly when a step is missing', () => {
    const data = JSON.parse(serializeProject(makeSprite(2, 2, [5]))) as Record<string, unknown>;
    const result = parseProject(JSON.stringify(data), {}, 3);
    expect(result).toMatchObject({ ok: false, error: { reason: 'invalid' } });
  });
});
