import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { packRgba } from '../domain/color.js';
import { createPalette } from '../domain/palette.js';
import { PixelBuffer } from '../domain/pixel-buffer.js';
import { MAX_FRAMES } from '../domain/sprite.js';
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
      cels: [buffer],
    };
  };
  return {
    id: 'sprite-1',
    name: 'Café 😀',
    width,
    height,
    layers: [layer('a', 0), layer('b', 1), layer('c', 2)],
    frames: [{ id: 'f1', duration: 100 }],
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
      reason({ ...data, sprite: { ...sprite, layers: [{ ...first, cels: ['AAAA'] }, ...others] } }),
    ).toBe('pixels');
    expect(
      reason({ ...data, sprite: { ...sprite, layers: [{ ...first, cels: ['!!!'] }, ...others] } }),
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

/** A project saved by version 1.0, before frames existed. It must keep opening. */
const PROJECT_V1 =
  '{"format":"vidopix","schemaVersion":1,"sprite":{"id":"sprite-fixture","name":"Fixture \u00f1","width":3,"height":2,"palette":{"id":"pal","name":"Warm","colors":[{"hex":"#fa640a","name":"Orange"},{"hex":"#010203"}]},"layers":[{"id":"a","name":"Base","visible":true,"locked":false,"opacity":1,"pixels":"/wAA/wAAAAAAAAAAAAAAAACA/8gAAAAA"},{"id":"b","name":"Top","visible":false,"locked":true,"opacity":0.5,"pixels":"/wAA/wCA/8gAAAAAAAAAAAAAAAAAAAAA"}]}}';

function animated(): Sprite {
  const base = makeSprite(3, 2, [1, 2, 3, 4, 5]);
  const layers = base.layers.map((layer) => {
    const cels = [layer.buffer, layer.buffer.clone(), layer.buffer.clone()];
    cels[1]?.set(0, 0, packRgba(9, 8, 7, 255));
    cels[2]?.fill(0);
    return { ...layer, cels };
  });
  return {
    ...base,
    layers,
    frames: [
      { id: 'f1', duration: 100 },
      { id: 'f2', duration: 250 },
      { id: 'f3', duration: 20 },
    ],
  };
}

describe('frames', () => {
  it('round-trips frames, their durations and every cel', () => {
    const sprite = animated();
    const parsed = parseProject(serializeProject(sprite));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value.frames).toEqual(sprite.frames);
    sprite.layers.forEach((layer, index) => {
      const other = parsed.value.layers[index];
      expect(other?.cels).toHaveLength(3);
      layer.cels.forEach((cel, frame) => {
        expect(other?.cels[frame]?.equals(cel)).toBe(true);
      });
      expect(other?.buffer).toBe(other?.cels[0]);
    });
  });

  it('opens a version 1 project as a one-frame animation', () => {
    const parsed = parseProject(PROJECT_V1);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const sprite = parsed.value;
    expect(sprite.id).toBe('sprite-fixture');
    expect(sprite.name).toBe('Fixture ñ');
    expect([sprite.width, sprite.height]).toEqual([3, 2]);
    expect(sprite.frames).toEqual([{ id: 'frame-1', duration: 100 }]);
    expect(sprite.layers.map((l) => [l.id, l.name, l.visible, l.locked, l.opacity])).toEqual([
      ['a', 'Base', true, false, 1],
      ['b', 'Top', false, true, 0.5],
    ]);
    expect(sprite.layers.every((l) => l.cels.length === 1 && l.buffer === l.cels[0])).toBe(true);
    expect(sprite.palette.colors).toHaveLength(2);
  });

  it('upgrades a version 1 project to the same pixels it had', () => {
    const old = JSON.parse(PROJECT_V1) as { sprite: { layers: { pixels: string }[] } };
    const parsed = parseProject(PROJECT_V1);
    const current = JSON.parse(serializeProject(parsed.ok ? parsed.value : animated())) as {
      schemaVersion: number;
      sprite: { layers: { cels: string[] }[] };
    };
    expect(current.schemaVersion).toBe(PROJECT_SCHEMA_VERSION);
    expect(current.sprite.layers.map((l) => l.cels)).toEqual(
      old.sprite.layers.map((l) => [l.pixels]),
    );
  });

  it('rejects a layer with a different number of cels than frames', () => {
    const data = JSON.parse(serializeProject(animated())) as {
      sprite: { layers: { cels: string[] }[] };
    };
    data.sprite.layers[0]?.cels.pop();
    expect(parseProject(JSON.stringify(data))).toMatchObject({
      ok: false,
      error: { reason: 'invalid' },
    });
  });

  it('rejects repeated frame ids, bad durations and too many frames', () => {
    const edit = (change: (sprite: { frames: { id: string; duration: number }[] }) => void) => {
      const data = JSON.parse(serializeProject(animated())) as {
        sprite: { frames: { id: string; duration: number }[] };
      };
      change(data.sprite);
      const result = parseProject(JSON.stringify(data));
      return result.ok ? 'ok' : result.error.reason;
    };
    expect(edit((s) => (s.frames[1] = { id: 'f1', duration: 100 }))).toBe('invalid');
    expect(edit((s) => (s.frames[0] = { id: 'f1', duration: 5 }))).toBe('invalid');
    expect(edit((s) => (s.frames[0] = { id: 'f1', duration: 20_000 }))).toBe('invalid');
    expect(edit((s) => (s.frames[0] = { id: 'f1', duration: 10.5 }))).toBe('invalid');
    expect(
      edit((s) => {
        s.frames = Array.from({ length: MAX_FRAMES + 1 }, (_, i) => ({
          id: `x${String(i)}`,
          duration: 100,
        }));
      }),
    ).toBe('invalid');
  });

  it('refuses a project that would need more memory than the editor allows', () => {
    const data = JSON.parse(serializeProject(animated())) as {
      sprite: {
        width: number;
        height: number;
        frames: { id: string; duration: number }[];
        layers: { cels: string[] }[];
      };
    };
    data.sprite.width = 1024;
    data.sprite.height = 1024;
    data.sprite.frames = Array.from({ length: 30 }, (_, i) => ({
      id: `x${String(i)}`,
      duration: 100,
    }));
    for (const layer of data.sprite.layers) layer.cels = data.sprite.frames.map(() => '');
    expect(parseProject(JSON.stringify(data))).toMatchObject({
      ok: false,
      error: { reason: 'too-large' },
    });
  });
});

describe('version 1 projects that are damaged', () => {
  const v1 = (): Record<string, unknown> => JSON.parse(PROJECT_V1) as Record<string, unknown>;
  const reason = (value: unknown): string => {
    const result = parseProject(JSON.stringify(value));
    return result.ok ? 'ok' : result.error.reason;
  };

  it('are refused, not crashed on', () => {
    expect(reason({ ...v1(), sprite: 5 })).toBe('invalid');
    expect(reason({ ...v1(), sprite: { ...(v1().sprite as object), layers: 'x' } })).toBe(
      'invalid',
    );
    expect(reason({ ...v1(), sprite: { ...(v1().sprite as object), layers: [7] } })).toBe(
      'invalid',
    );
  });
});
