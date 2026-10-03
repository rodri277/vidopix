import { z } from './zod.js';
import { packRgba, parseHex, toHex } from '../domain/color.js';
import {
  MAX_PALETTE_COLORS,
  MAX_PALETTE_NAME_LENGTH,
  cleanName,
  opaque,
  paletteColor,
  type Palette,
  type PaletteColor,
} from '../domain/palette.js';
import { err, ok, type Result } from '../result.js';

export type PaletteFormat = 'gpl' | 'hex' | 'json';

/** The contents of a palette file, before it becomes part of a sprite. */
export interface PaletteFile {
  /** The palette's name, when the format has one. */
  readonly name: string | undefined;
  readonly colors: readonly PaletteColor[];
}

export interface PaletteParseError {
  readonly kind: 'invalid-palette';
  readonly format: PaletteFormat;
  readonly message: string;
  /** 1-based line of the problem, for the text formats. */
  readonly line?: number;
}

type Parsed = Result<PaletteFile, PaletteParseError>;

const TOO_MANY = `A palette can have at most ${String(MAX_PALETTE_COLORS)} colors`;

function failure(format: PaletteFormat, message: string, line?: number): Parsed {
  return err(
    line === undefined
      ? { kind: 'invalid-palette', format, message }
      : { kind: 'invalid-palette', format, message, line },
  );
}

/** Removes a byte order mark, which some editors put at the start of a text file. */
function stripBom(text: string): string {
  return text.startsWith(String.fromCharCode(0xfeff)) ? text.slice(1) : text;
}

function splitLines(text: string): string[] {
  return stripBom(text).split(/\r\n|\r|\n/);
}

// ---- GIMP palette ----

const GPL_COLOR = /^(\S+)\s+(\S+)\s+(\S+)(?:\s+(.*))?$/;

export function exportGpl(palette: Palette): string {
  const lines = ['GIMP Palette', `Name: ${palette.name}`, 'Columns: 8', '#'];
  for (const { color, name } of palette.colors) {
    const r = color & 0xff;
    const g = (color >>> 8) & 0xff;
    const b = (color >>> 16) & 0xff;
    const channels = [r, g, b].map((value) => String(value).padStart(3, ' ')).join(' ');
    lines.push(name === undefined ? channels : `${channels}\t${name}`);
  }
  return `${lines.join('\n')}\n`;
}

export function parseGpl(text: string): Parsed {
  const lines = splitLines(text);
  if (lines[0]?.trim() !== 'GIMP Palette') {
    return failure('gpl', 'Missing the "GIMP Palette" header on the first line', 1);
  }

  let name: string | undefined;
  const colors: PaletteColor[] = [];
  for (let index = 1; index < lines.length; index++) {
    const line = (lines[index] ?? '').trim();
    const number = index + 1;
    if (line === '' || line.startsWith('#')) continue;
    if (/^name\s*:/i.test(line)) {
      name = cleanName(line.slice(line.indexOf(':') + 1), MAX_PALETTE_NAME_LENGTH);
      continue;
    }
    if (/^columns\s*:/i.test(line)) continue;

    const match = GPL_COLOR.exec(line);
    if (!match) return failure('gpl', 'Expected three numbers (red green blue)', number);
    const channels = [match[1], match[2], match[3]].map((value) => Number(value));
    if (channels.some((value) => !Number.isInteger(value) || value < 0 || value > 255)) {
      return failure('gpl', 'Red, green and blue must be whole numbers from 0 to 255', number);
    }
    if (colors.length >= MAX_PALETTE_COLORS) return failure('gpl', TOO_MANY, number);
    const [r = 0, g = 0, b = 0] = channels;
    colors.push(paletteColor(packRgba(r, g, b, 255), match[4]));
  }
  return ok({ name, colors });
}

// ---- Hex list (Lospec) ----

export function exportHex(palette: Palette): string {
  return palette.colors.map(({ color }) => `${toHex(color).slice(1)}\n`).join('');
}

export function parseHexList(text: string): Parsed {
  const colors: PaletteColor[] = [];
  const lines = splitLines(text);
  for (let index = 0; index < lines.length; index++) {
    const line = (lines[index] ?? '').trim();
    if (line === '') continue;
    const parsed = /^#?[0-9a-fA-F]{6}$/.test(line) ? parseHex(line) : null;
    if (!parsed?.ok)
      return failure('hex', 'Expected a six-digit hex color such as ff8800', index + 1);
    if (colors.length >= MAX_PALETTE_COLORS) return failure('hex', TOO_MANY, index + 1);
    colors.push(paletteColor(parsed.value));
  }
  if (colors.length === 0) return failure('hex', 'The file has no colors');
  return ok({ name: undefined, colors });
}

// ---- JSON ----

const SCHEMA_VERSION = 1;

const jsonColor = z.object({
  hex: z.string().regex(/^#?[0-9a-fA-F]{6}$/, 'hex must be a six-digit color such as #ff8800'),
  name: z.string().max(MAX_PALETTE_NAME_LENGTH).optional(),
});

const jsonPalette = z.object({
  schemaVersion: z.number().int(),
  name: z.string().max(MAX_PALETTE_NAME_LENGTH).optional(),
  colors: z.array(jsonColor).max(MAX_PALETTE_COLORS, TOO_MANY),
});

export function exportJson(palette: Palette): string {
  return `${JSON.stringify(
    {
      schemaVersion: SCHEMA_VERSION,
      name: palette.name,
      colors: palette.colors.map(({ color, name }) =>
        name === undefined ? { hex: toHex(color) } : { hex: toHex(color), name },
      ),
    },
    null,
    2,
  )}\n`;
}

export function parseJson(text: string): Parsed {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return failure('json', 'The file is not valid JSON');
  }

  const version = z.object({ schemaVersion: z.number().int() }).safeParse(data);
  if (!version.success) return failure('json', 'Missing the schemaVersion field');
  if (version.data.schemaVersion > SCHEMA_VERSION) {
    return failure('json', 'This file was made by a newer version of Vidopix');
  }

  const result = jsonPalette.safeParse(data);
  if (!result.success) {
    const issue = result.error.issues[0];
    const where = issue?.path.join('.');
    return failure('json', `${where ? `${where}: ` : ''}${issue?.message ?? 'Invalid palette'}`);
  }

  const colors = result.data.colors.map(({ hex, name }) => {
    const parsed = parseHex(hex);
    return paletteColor(parsed.ok ? opaque(parsed.value) : 0xff000000, name);
  });
  return ok({ name: cleanName(result.data.name, MAX_PALETTE_NAME_LENGTH), colors });
}

// ---- Detection ----

export function detectPaletteFormat(text: string, fileName = ''): PaletteFormat {
  const start = stripBom(text).trimStart();
  if (start.startsWith('GIMP Palette')) return 'gpl';
  if (start.startsWith('{')) return 'json';
  const extension = fileName.toLowerCase().split('.').pop();
  if (extension === 'gpl') return 'gpl';
  if (extension === 'json') return 'json';
  return 'hex';
}

/** Reads a palette file in any supported format and says which one it was. */
export function parsePaletteFile(
  text: string,
  fileName?: string,
): Result<PaletteFile & { readonly format: PaletteFormat }, PaletteParseError> {
  const format = detectPaletteFormat(text, fileName);
  const parsed =
    format === 'gpl' ? parseGpl(text) : format === 'json' ? parseJson(text) : parseHexList(text);
  return parsed.ok ? ok({ ...parsed.value, format }) : parsed;
}
