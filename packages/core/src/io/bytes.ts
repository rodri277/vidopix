/** Small byte helpers with no dependency on the browser or Node, so the core stays portable. */

const STANDARD = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const URL_SAFE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

const LOOKUP = new Int16Array(128).fill(-1);
for (let i = 0; i < 64; i++) {
  LOOKUP[STANDARD.charCodeAt(i)] = i;
  LOOKUP[URL_SAFE.charCodeAt(i)] = i;
}

export function bytesToBase64(bytes: Uint8Array, urlSafe = false): string {
  const alphabet = urlSafe ? URL_SAFE : STANDARD;
  const parts: string[] = [];
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i] ?? 0;
    const b = bytes[i + 1] ?? 0;
    const c = bytes[i + 2] ?? 0;
    const chunk = (a << 16) | (b << 8) | c;
    const remaining = bytes.length - i;
    parts.push(
      alphabet.charAt((chunk >> 18) & 63),
      alphabet.charAt((chunk >> 12) & 63),
      remaining > 1 ? alphabet.charAt((chunk >> 6) & 63) : urlSafe ? '' : '=',
      remaining > 2 ? alphabet.charAt(chunk & 63) : urlSafe ? '' : '=',
    );
  }
  return parts.join('');
}

/** Decodes standard or URL-safe base64, with or without padding. Returns null if it is invalid. */
export function base64ToBytes(text: string): Uint8Array | null {
  const clean = text.replace(/=+$/, '');
  if (clean.length % 4 === 1) return null;
  const output = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let buffer = 0;
  let bits = 0;
  let index = 0;
  for (let i = 0; i < clean.length; i++) {
    const code = clean.charCodeAt(i);
    const value = code < 128 ? (LOOKUP[code] ?? -1) : -1;
    if (value < 0) return null;
    buffer = (buffer << 6) | value;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      output[index++] = (buffer >> bits) & 0xff;
    }
  }
  return output;
}

export function utf8Encode(text: string): Uint8Array {
  const bytes: number[] = [];
  for (const char of text) {
    const code = char.codePointAt(0) ?? 0;
    if (code < 0x80) {
      bytes.push(code);
    } else if (code < 0x800) {
      bytes.push(0xc0 | (code >> 6), 0x80 | (code & 63));
    } else if (code < 0x10000) {
      bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 63), 0x80 | (code & 63));
    } else {
      bytes.push(
        0xf0 | (code >> 18),
        0x80 | ((code >> 12) & 63),
        0x80 | ((code >> 6) & 63),
        0x80 | (code & 63),
      );
    }
  }
  return Uint8Array.from(bytes);
}

/** Decodes UTF-8. Returns null on malformed input. */
export function utf8Decode(bytes: Uint8Array): string | null {
  const codes: number[] = [];
  for (let i = 0; i < bytes.length;) {
    const first = bytes[i] ?? 0;
    let extra = 0;
    let code = first;
    if (first >= 0xf0 && first < 0xf8) {
      extra = 3;
      code = first & 0x07;
    } else if (first >= 0xe0) {
      extra = 2;
      code = first & 0x0f;
    } else if (first >= 0xc0) {
      extra = 1;
      code = first & 0x1f;
    } else if (first >= 0x80) {
      return null;
    }
    for (let k = 1; k <= extra; k++) {
      const next = bytes[i + k];
      if (next === undefined || (next & 0xc0) !== 0x80) return null;
      code = (code << 6) | (next & 63);
    }
    if (code > 0x10ffff || (code >= 0xd800 && code <= 0xdfff)) return null;
    codes.push(code);
    i += extra + 1;
  }
  return String.fromCodePoint(...codes);
}
