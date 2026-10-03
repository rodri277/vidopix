import type { Sprite } from '../domain/sprite.js';
import { err, ok, type Result } from '../result.js';
import {
  MAX_EXPORT_DIMENSION,
  checkExportSize,
  exportFrame,
  type ExportError,
  type ExportImage,
  type ExportOptions,
} from './export.js';

export const DEFAULT_SHEET_COLUMNS = 8;

export interface SheetOptions extends ExportOptions {
  /** Frames per row, 1 or more. Fewer are used when there are fewer frames. */
  readonly columns: number;
  /** File name of the sheet image, recorded in the JSON so the pair stays together. */
  readonly imageName: string;
}

/** Where one frame sits in the sheet, in pixels of the exported image. */
export interface SheetFrame {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  /** Milliseconds this frame is shown. */
  readonly duration: number;
}

export interface SheetData {
  readonly meta: {
    readonly image: string;
    readonly size: { readonly w: number; readonly h: number };
    readonly frameCount: number;
    readonly scale: number;
  };
  readonly frames: readonly SheetFrame[];
}

export interface Spritesheet {
  readonly image: ExportImage;
  readonly data: SheetData;
}

export type SheetError =
  ExportError | { readonly kind: 'invalid-columns'; readonly columns: number };

/** Grid size for `count` cells of `cellWidth × cellHeight` laid out left to right, top to bottom. */
export function sheetGrid(count: number, columns: number): { columns: number; rows: number } {
  const used = Math.max(1, Math.min(columns, count));
  return { columns: used, rows: Math.ceil(count / used) };
}

/**
 * Every frame of the sprite in one image, plus the coordinates of each frame. Frames have no
 * padding between them; transparent pixels stay transparent unless a background is given.
 */
export function buildSpritesheet(
  sprite: Sprite,
  options: SheetOptions,
): Result<Spritesheet, SheetError> {
  const { columns: requested, imageName, ...exportOptions } = options;
  if (!Number.isInteger(requested) || requested < 1) {
    return err({ kind: 'invalid-columns', columns: requested });
  }
  const cell = checkExportSize(sprite, exportOptions.scale);
  if (!cell.ok) return cell;
  const { columns, rows } = sheetGrid(sprite.frames.length, requested);
  const width = cell.value.width * columns;
  const height = cell.value.height * rows;
  if (width > MAX_EXPORT_DIMENSION || height > MAX_EXPORT_DIMENSION) {
    return err({ kind: 'too-large', width, height, max: MAX_EXPORT_DIMENSION });
  }

  const pixels = new Uint32Array(width * height);
  const frames: SheetFrame[] = [];
  for (const [index, frame] of sprite.frames.entries()) {
    const image = exportFrame(sprite, index, exportOptions);
    if (!image.ok) return image;
    const x = (index % columns) * cell.value.width;
    const y = Math.floor(index / columns) * cell.value.height;
    for (let row = 0; row < cell.value.height; row++) {
      const from = row * cell.value.width;
      pixels.set(image.value.pixels.subarray(from, from + cell.value.width), (y + row) * width + x);
    }
    frames.push({ x, y, w: cell.value.width, h: cell.value.height, duration: frame.duration });
  }

  return ok({
    image: { width, height, pixels, toBytes: () => new Uint8ClampedArray(pixels.buffer) },
    data: {
      meta: {
        image: imageName,
        size: { w: width, h: height },
        frameCount: frames.length,
        scale: exportOptions.scale,
      },
      frames,
    },
  });
}
