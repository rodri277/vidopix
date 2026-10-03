import { z } from './zod.js';
import { toHex, parseHex } from '../domain/color.js';
import {
  MAX_PALETTE_COLORS,
  MAX_PALETTE_NAME_LENGTH,
  createPalette,
  paletteColor,
} from '../domain/palette.js';
import { MAX_SPRITE_BYTES } from '../document/frame-ops.js';
import { MAX_CANVAS_SIZE, type PixelBuffer } from '../domain/pixel-buffer.js';
import {
  DEFAULT_FRAME_DURATION,
  MAX_FRAMES,
  MAX_FRAME_DURATION,
  MIN_FRAME_DURATION,
  type Frame,
  type Layer,
  type Sprite,
} from '../domain/sprite.js';
import { err, ok, type Result } from '../result.js';
import { base64ToBytes, bytesToBase64 } from './bytes.js';
import { bytesToPixels, pixelsToBytes } from './pixel-bytes.js';

/** The `.vidopix` file format: a JSON document with the layers' pixels as base64 RGBA bytes. */
export const PROJECT_FORMAT = 'vidopix';
export const PROJECT_SCHEMA_VERSION = 2;
export const MAX_PROJECT_BYTES = 20 * 1024 * 1024;
export const MAX_PROJECT_LAYERS = 64;
const NAME_LENGTH = 60;

export interface ProjectParseError {
  readonly kind: 'invalid-project';
  readonly reason:
    'too-large' | 'not-json' | 'not-a-project' | 'newer-version' | 'invalid' | 'pixels';
  readonly message: string;
}

/** Upgrades the data of one schema version to the next. Keyed by the version it upgrades from. */
export type Migrations = Readonly<
  Record<number, (data: Record<string, unknown>) => Record<string, unknown>>
>;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Version 1 had one image per layer. Version 2 has frames: a list of frames, and one image
 * ("cel") per layer for each of them. A version 1 project becomes a one-frame animation.
 */
function upgradeLayerV1(layer: unknown): unknown {
  if (!isRecord(layer)) return layer;
  const { pixels, ...rest } = layer;
  return { ...rest, cels: [pixels] };
}

function upgradeV1(data: Record<string, unknown>): Record<string, unknown> {
  const sprite = data.sprite;
  if (!isRecord(sprite)) return data;
  const { layers } = sprite;
  return {
    ...data,
    sprite: {
      ...sprite,
      frames: [{ id: 'frame-1', duration: DEFAULT_FRAME_DURATION }],
      layers: Array.isArray(layers) ? (layers as unknown[]).map(upgradeLayerV1) : layers,
    },
  };
}

/** Upgrade steps, keyed by the version they upgrade from. Bump the version when adding one. */
export const MIGRATIONS: Migrations = { 1: upgradeV1 };

const projectSchema = z.object({
  format: z.literal(PROJECT_FORMAT),
  schemaVersion: z.number().int(),
  sprite: z.object({
    id: z.string().min(1).max(100),
    name: z.string().max(NAME_LENGTH),
    width: z.number().int().min(1).max(MAX_CANVAS_SIZE),
    height: z.number().int().min(1).max(MAX_CANVAS_SIZE),
    palette: z.object({
      id: z.string().min(1).max(100),
      name: z.string().max(MAX_PALETTE_NAME_LENGTH),
      colors: z
        .array(
          z.object({
            hex: z.string().regex(/^#[0-9a-fA-F]{6}$/),
            name: z.string().max(MAX_PALETTE_NAME_LENGTH).optional(),
          }),
        )
        .max(MAX_PALETTE_COLORS),
    }),
    frames: z
      .array(
        z.object({
          id: z.string().min(1).max(100),
          duration: z.number().int().min(MIN_FRAME_DURATION).max(MAX_FRAME_DURATION),
        }),
      )
      .min(1)
      .max(MAX_FRAMES),
    layers: z
      .array(
        z.object({
          id: z.string().min(1).max(100),
          name: z.string().max(NAME_LENGTH),
          visible: z.boolean(),
          locked: z.boolean(),
          opacity: z.number().min(0).max(1),
          cels: z.array(z.string()).min(1).max(MAX_FRAMES),
        }),
      )
      .min(1)
      .max(MAX_PROJECT_LAYERS),
  }),
});

function failure(
  reason: ProjectParseError['reason'],
  message: string,
): Result<never, ProjectParseError> {
  return err({ kind: 'invalid-project', reason, message });
}

// ---- Writing ----

export function serializeProject(sprite: Sprite): string {
  return JSON.stringify({
    format: PROJECT_FORMAT,
    schemaVersion: PROJECT_SCHEMA_VERSION,
    sprite: {
      id: sprite.id,
      name: sprite.name,
      width: sprite.width,
      height: sprite.height,
      palette: {
        id: sprite.palette.id,
        name: sprite.palette.name,
        colors: sprite.palette.colors.map(({ color, name }) =>
          name === undefined ? { hex: toHex(color) } : { hex: toHex(color), name },
        ),
      },
      frames: sprite.frames.map(({ id, duration }) => ({ id, duration })),
      layers: sprite.layers.map((layer) => ({
        id: layer.id,
        name: layer.name,
        visible: layer.visible,
        locked: layer.locked,
        opacity: layer.opacity,
        cels: layer.cels.map((cel) => bytesToBase64(pixelsToBytes(cel))),
      })),
    },
  });
}

// ---- Reading ----

/**
 * Reads a `.vidopix` file. Files from older versions are upgraded step by step, files from newer
 * versions are refused with a clear message, and anything malformed comes back as an error
 * instead of an exception.
 */
export function parseProject(
  text: string,
  migrations: Migrations = MIGRATIONS,
  currentVersion: number = PROJECT_SCHEMA_VERSION,
): Result<Sprite, ProjectParseError> {
  if (text.length > MAX_PROJECT_BYTES) {
    return failure('too-large', 'This file is larger than 20 MB, the most Vidopix will open');
  }
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return failure('not-json', 'The file is not valid JSON');
  }
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    return failure('not-a-project', 'The file is not a Vidopix project');
  }

  let record = data as Record<string, unknown>;
  if (record.format !== PROJECT_FORMAT || typeof record.schemaVersion !== 'number') {
    return failure('not-a-project', 'The file is not a Vidopix project');
  }
  let version = record.schemaVersion;
  if (!Number.isInteger(version) || version < 1) {
    return failure('invalid', 'The file has an invalid schemaVersion');
  }
  if (version > currentVersion) {
    return failure('newer-version', 'This project was saved by a newer version of Vidopix');
  }
  while (version < currentVersion) {
    const step = migrations[version];
    if (!step) return failure('invalid', `No way to upgrade a version ${String(version)} project`);
    record = { ...step(record), format: PROJECT_FORMAT, schemaVersion: version + 1 };
    version++;
  }

  const parsed = projectSchema.safeParse(record);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const where = issue?.path.join('.');
    return failure('invalid', `${where ? `${where}: ` : ''}${issue?.message ?? 'Invalid project'}`);
  }

  const { sprite } = parsed.data;
  const ids = new Set<string>();
  const layers: Layer[] = [];
  const expectedBytes = sprite.width * sprite.height * 4;
  const frameIds = new Set(sprite.frames.map((frame) => frame.id));
  if (frameIds.size !== sprite.frames.length) return failure('invalid', 'Two frames share an id');
  if (expectedBytes * sprite.layers.length * sprite.frames.length > MAX_SPRITE_BYTES) {
    return failure('too-large', 'This project needs more memory than Vidopix will use');
  }
  for (const layer of sprite.layers) {
    if (ids.has(layer.id)) return failure('invalid', `Two layers share the id ${layer.id}`);
    ids.add(layer.id);
    if (layer.cels.length !== sprite.frames.length) {
      return failure(
        'invalid',
        `Layer "${layer.name}" has ${String(layer.cels.length)} images for ${String(sprite.frames.length)} frames`,
      );
    }
    const cels: PixelBuffer[] = [];
    for (const cel of layer.cels) {
      const bytes = base64ToBytes(cel);
      if (!bytes)
        return failure('pixels', `The pixels of layer "${layer.name}" are not valid base64`);
      if (bytes.length !== expectedBytes) {
        return failure(
          'pixels',
          `Layer "${layer.name}" has ${String(bytes.length)} bytes of pixels, expected ${String(expectedBytes)}`,
        );
      }
      cels.push(bytesToPixels(bytes, sprite.width, sprite.height));
    }
    const [first] = cels;
    if (!first) return failure('invalid', `Layer "${layer.name}" has no images`);
    layers.push({
      id: layer.id,
      name: layer.name,
      visible: layer.visible,
      locked: layer.locked,
      opacity: layer.opacity,
      blendMode: 'normal',
      buffer: first,
      cels,
    });
  }
  const frames: Frame[] = sprite.frames.map(({ id, duration }) => ({ id, duration }));

  const colors = sprite.palette.colors.map(({ hex, name }) => {
    const color = parseHex(hex);
    return paletteColor(color.ok ? color.value : 0xff000000, name);
  });
  return ok({
    id: sprite.id,
    name: sprite.name,
    width: sprite.width,
    height: sprite.height,
    layers,
    frames,
    palette: createPalette(sprite.palette.id, sprite.palette.name, colors),
  });
}
