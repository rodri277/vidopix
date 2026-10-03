import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { base64ToBytes, bytesToBase64, utf8Decode, utf8Encode } from './bytes.js';

const ascii = (text: string): Uint8Array => Uint8Array.from(text, (c) => c.charCodeAt(0));

describe('base64', () => {
  it.each([
    ['', ''],
    ['f', 'Zg=='],
    ['fo', 'Zm8='],
    ['foo', 'Zm9v'],
    ['foob', 'Zm9vYg=='],
    ['fooba', 'Zm9vYmE='],
    ['foobar', 'Zm9vYmFy'],
  ])('matches the RFC 4648 vector for %j', (plain, encoded) => {
    expect(bytesToBase64(ascii(plain))).toBe(encoded);
    expect(base64ToBytes(encoded)).toEqual(ascii(plain));
  });

  it('round-trips any bytes in both alphabets', () => {
    fc.assert(
      fc.property(fc.uint8Array({ maxLength: 300 }), fc.boolean(), (bytes, urlSafe) => {
        const text = bytesToBase64(bytes, urlSafe);
        expect(base64ToBytes(text)).toEqual(bytes);
        if (urlSafe) expect(text).toMatch(/^[A-Za-z0-9_-]*$/);
      }),
    );
  });

  it('accepts text without padding and mixed alphabets', () => {
    expect(base64ToBytes('Zm9vYg')).toEqual(ascii('foob'));
    expect(base64ToBytes('-_-_')).toEqual(base64ToBytes('+/+/'));
  });

  it('rejects characters outside the alphabet and impossible lengths', () => {
    expect(base64ToBytes('Zm9v!')).toBeNull();
    expect(base64ToBytes('Zm 9v')).toBeNull();
    expect(base64ToBytes('Z')).toBeNull();
    expect(base64ToBytes('é===')).toBeNull();
  });
});

describe('utf8', () => {
  it('encodes known characters', () => {
    expect([...utf8Encode('A')]).toEqual([0x41]);
    expect([...utf8Encode('é')]).toEqual([0xc3, 0xa9]);
    expect([...utf8Encode('€')]).toEqual([0xe2, 0x82, 0xac]);
    expect([...utf8Encode('😀')]).toEqual([0xf0, 0x9f, 0x98, 0x80]);
  });

  it('round-trips any text without lone surrogates', () => {
    fc.assert(
      fc.property(fc.string({ unit: 'binary', maxLength: 60 }), (text) => {
        expect(utf8Decode(utf8Encode(text))).toBe(text);
      }),
    );
  });

  it('rejects malformed sequences', () => {
    expect(utf8Decode(Uint8Array.from([0x80]))).toBeNull();
    expect(utf8Decode(Uint8Array.from([0xc3]))).toBeNull();
    expect(utf8Decode(Uint8Array.from([0xe2, 0x82]))).toBeNull();
    expect(utf8Decode(Uint8Array.from([0xc3, 0x28]))).toBeNull();
    expect(utf8Decode(Uint8Array.from([0xed, 0xa0, 0x80]))).toBeNull();
    expect(utf8Decode(Uint8Array.from([0xf4, 0x90, 0x80, 0x80]))).toBeNull();
  });
});
