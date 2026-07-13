import { describe, it, expect } from 'vitest';
import { ZipWriter } from './zip';

const dec = new TextDecoder();

// Read a little-endian uint from a byte array.
function u32(b: Uint8Array, o: number): number {
  return (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0;
}
function u16(b: Uint8Array, o: number): number {
  return b[o] | (b[o + 1] << 8);
}

describe('ZipWriter', () => {
  it('writes a valid local header + EOCD for one stored entry', () => {
    const zip = new ZipWriter();
    zip.add('hello.txt', 'hello');
    const bytes = zip.build();

    // Local file header signature.
    expect(u32(bytes, 0)).toBe(0x04034b50);
    // Method 0 (stored).
    expect(u16(bytes, 8)).toBe(0);
    // Uncompressed size == compressed size == 5.
    expect(u32(bytes, 18)).toBe(5);
    expect(u32(bytes, 22)).toBe(5);
    // Name length 9 ("hello.txt").
    expect(u16(bytes, 26)).toBe(9);
    expect(dec.decode(bytes.slice(30, 39))).toBe('hello.txt');
    // The stored data follows the name.
    expect(dec.decode(bytes.slice(39, 44))).toBe('hello');

    // EOCD signature is the last 22 bytes.
    const eocd = bytes.length - 22;
    expect(u32(bytes, eocd)).toBe(0x06054b50);
    expect(u16(bytes, eocd + 8)).toBe(1); // one entry
    expect(u16(bytes, eocd + 10)).toBe(1);
  });

  it('records every entry in the central directory', () => {
    const zip = new ZipWriter();
    zip.add('a.txt', 'aaa');
    zip.add('dir/b.txt', 'bb');
    const bytes = zip.build();

    const eocd = bytes.length - 22;
    expect(u16(bytes, eocd + 10)).toBe(2); // total entries
    const centralOffset = u32(bytes, eocd + 16);
    expect(u32(bytes, centralOffset)).toBe(0x02014b50); // central dir signature
  });

  it('accepts binary content', () => {
    const zip = new ZipWriter();
    const data = new Uint8Array([0, 1, 2, 255, 128]);
    zip.add('bin', data);
    const bytes = zip.build();
    expect(u32(bytes, 0)).toBe(0x04034b50);
    expect(u32(bytes, 22)).toBe(5); // 5 bytes uncompressed
  });
});
