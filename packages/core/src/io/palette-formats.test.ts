import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { packRgba, toHex } from '../domain/color.js';
import { MAX_PALETTE_COLORS, createPalette, type Palette } from '../domain/palette.js';
import {
  detectPaletteFormat,
  exportGpl,
  exportHex,
  exportJson,
  parseGpl,
  parseHexList,
  parseJson,
  parsePaletteFile,
} from './palette-formats.js';

const paletteArbitrary = fc
  .record({
    name: fc.stringMatching(/^[A-Za-z0-9][A-Za-z0-9 _.#-]{0,30}$/),
    colors: fc.uniqueArray(
      fc.record({
        rgb: fc.integer({ min: 0, max: 0xffffff }),
        name: fc.option(fc.stringMatching(/^[A-Za-z0-9][A-Za-z0-9 _.#-]{0,20}$/), {
          nil: undefined,
        }),
      }),
      { selector: (entry) => entry.rgb, maxLength: 80 },
    ),
  })
  .map(({ name, colors }) =>
    createPalette(
      'p',
      name,
      colors.map(({ rgb, name: colorName }) =>
        colorName === undefined
          ? { color: (rgb | 0xff000000) >>> 0 }
          : { color: (rgb | 0xff000000) >>> 0, name: colorName },
      ),
    ),
  );

const sample: Palette = createPalette('p', 'Sunset', [
  { color: packRgba(255, 0, 0, 255), name: 'Red' },
  { color: packRgba(0, 128, 255, 255) },
  { color: packRgba(1, 2, 3, 255), name: 'Dark blue grey' },
]);

describe('GIMP palette (.gpl)', () => {
  it('writes the standard layout', () => {
    expect(exportGpl(sample)).toBe(
      [
        'GIMP Palette',
        'Name: Sunset',
        'Columns: 8',
        '#',
        '255   0   0\tRed',
        '  0 128 255',
        '  1   2   3\tDark blue grey',
        '',
      ].join('\n'),
    );
  });

  it('round-trips any palette without losing a color or a name', () => {
    fc.assert(
      fc.property(paletteArbitrary, (palette) => {
        const parsed = parseGpl(exportGpl(palette));
        expect(parsed.ok).toBe(true);
        if (!parsed.ok) return;
        expect(parsed.value.name).toBe(palette.name);
        expect(parsed.value.colors).toEqual(palette.colors);
      }),
    );
  });

  it('reads files written by other tools: comments, windows line endings, tabs and spaces', () => {
    const text =
      'GIMP Palette\r\nName: Other\r\nColumns: 4\r\n# made elsewhere\r\n 10  20\t30   Sky blue \r\n\r\n40 50 60\r\n';
    const parsed = parseGpl(text);
    expect(parsed.ok && parsed.value).toEqual({
      name: 'Other',
      colors: [
        { color: packRgba(10, 20, 30, 255), name: 'Sky blue' },
        { color: packRgba(40, 50, 60, 255) },
      ],
    });
  });

  it('reports a missing header, bad numbers and short lines with the line number', () => {
    expect(parseGpl('Palette\n1 2 3')).toMatchObject({ ok: false, error: { line: 1 } });
    expect(parseGpl('GIMP Palette\n#\n1 2')).toMatchObject({ ok: false, error: { line: 3 } });
    expect(parseGpl('GIMP Palette\n1 2 300')).toMatchObject({ ok: false, error: { line: 2 } });
    expect(parseGpl('GIMP Palette\n1 x 3')).toMatchObject({ ok: false, error: { line: 2 } });
    expect(parseGpl('')).toMatchObject({ ok: false });
  });

  it('refuses more colors than a palette can hold', () => {
    const lines = Array.from(
      { length: MAX_PALETTE_COLORS + 1 },
      (_, i) => `${String(i % 256)} 0 0`,
    );
    expect(parseGpl(['GIMP Palette', ...lines].join('\n'))).toMatchObject({
      ok: false,
      error: { message: expect.stringContaining('256') as string },
    });
  });

  it('accepts a file with only a header', () => {
    const parsed = parseGpl('GIMP Palette\nName: Empty\n');
    expect(parsed.ok && parsed.value).toEqual({ name: 'Empty', colors: [] });
  });
});

describe('hex list (.hex)', () => {
  it('writes one lowercase six-digit color per line, without #', () => {
    expect(exportHex(sample)).toBe('ff0000\n0080ff\n010203\n');
  });

  it('round-trips the colors of any palette that has some', () => {
    fc.assert(
      fc.property(
        paletteArbitrary.filter((palette) => palette.colors.length > 0),
        (palette) => {
          const parsed = parseHexList(exportHex(palette));
          expect(parsed.ok && parsed.value.colors.map((c) => c.color)).toEqual(
            palette.colors.map((c) => c.color),
          );
        },
      ),
    );
  });

  it('accepts #, uppercase, blank lines and Windows line endings', () => {
    const parsed = parseHexList('#FF0000\r\n\r\n 00ff00 \r\n0000FF');
    expect(parsed.ok && parsed.value.colors.map((c) => toHex(c.color))).toEqual([
      '#ff0000',
      '#00ff00',
      '#0000ff',
    ]);
    expect(parsed.ok && parsed.value.name).toBeUndefined();
  });

  it('points at the first bad line', () => {
    expect(parseHexList('ff0000\nnope\n00ff00')).toMatchObject({ ok: false, error: { line: 2 } });
    expect(parseHexList('ff00')).toMatchObject({ ok: false, error: { line: 1 } });
    expect(parseHexList('')).toMatchObject({ ok: false });
  });
});

describe('JSON', () => {
  it('writes a versioned document', () => {
    expect(JSON.parse(exportJson(sample))).toEqual({
      schemaVersion: 1,
      name: 'Sunset',
      colors: [
        { hex: '#ff0000', name: 'Red' },
        { hex: '#0080ff' },
        { hex: '#010203', name: 'Dark blue grey' },
      ],
    });
  });

  it('round-trips any palette', () => {
    fc.assert(
      fc.property(paletteArbitrary, (palette) => {
        const parsed = parseJson(exportJson(palette));
        expect(parsed.ok).toBe(true);
        if (!parsed.ok) return;
        expect(parsed.value.name).toBe(palette.name);
        expect(parsed.value.colors).toEqual(palette.colors);
      }),
    );
  });

  it('explains what is wrong with a file', () => {
    const bad = (value: unknown): string => {
      const result = parseJson(JSON.stringify(value));
      return result.ok ? 'ok' : result.error.message;
    };
    expect(parseJson('{oops')).toMatchObject({ ok: false });
    expect(bad([])).not.toBe('ok');
    expect(bad({ schemaVersion: 1, colors: [{ hex: 'red' }] })).toContain('hex');
    expect(bad({ schemaVersion: 1, colors: 'no' })).not.toBe('ok');
    expect(bad({ colors: [] })).toContain('schemaVersion');
    expect(bad({ schemaVersion: 2, colors: [] })).toContain('newer');
    expect(
      bad({ schemaVersion: 1, colors: Array.from({ length: 300 }, () => ({ hex: '#000000' })) }),
    ).toContain('256');
  });

  it('ignores unknown fields and accepts colors without the #', () => {
    const parsed = parseJson(
      JSON.stringify({ schemaVersion: 1, extra: true, colors: [{ hex: 'AABBCC', note: 'x' }] }),
    );
    expect(parsed.ok && parsed.value.colors).toEqual([{ color: packRgba(0xaa, 0xbb, 0xcc, 255) }]);
  });
});

describe('byte order mark', () => {
  it('is ignored at the start of any text format', () => {
    const bom = String.fromCharCode(0xfeff);
    expect(parseGpl(`${bom}GIMP Palette\n1 2 3`)).toMatchObject({ ok: true });
    expect(parseHexList(`${bom}ff0000`)).toMatchObject({ ok: true });
    expect(detectPaletteFormat(`${bom}GIMP Palette`)).toBe('gpl');
  });
});

describe('detection', () => {
  it('uses the content first, then the extension', () => {
    expect(detectPaletteFormat('GIMP Palette\n1 2 3', 'x.txt')).toBe('gpl');
    expect(detectPaletteFormat('  {"a":1}', 'x.hex')).toBe('json');
    expect(detectPaletteFormat('ff0000', 'x.json')).toBe('json');
    expect(detectPaletteFormat('ff0000', 'x.gpl')).toBe('gpl');
    expect(detectPaletteFormat('ff0000', 'x.hex')).toBe('hex');
    expect(detectPaletteFormat('ff0000', 'noextension')).toBe('hex');
  });

  it('parses any supported file and reports the format it read', () => {
    expect(parsePaletteFile(exportGpl(sample), 'a.gpl')).toMatchObject({
      ok: true,
      value: { format: 'gpl' },
    });
    expect(parsePaletteFile(exportHex(sample), 'a.hex')).toMatchObject({
      ok: true,
      value: { format: 'hex' },
    });
    expect(parsePaletteFile(exportJson(sample), 'a.json')).toMatchObject({
      ok: true,
      value: { format: 'json' },
    });
    expect(parsePaletteFile('garbage', 'a.gpl')).toMatchObject({ ok: false });
  });
});
