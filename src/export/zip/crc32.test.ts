import { describe, it, expect } from 'vitest';
import { crc32 } from './crc32';

const enc = new TextEncoder();

describe('crc32', () => {
  it('matches known CRC-32 vectors', () => {
    // Standard test vectors (IEEE 802.3).
    expect(crc32(enc.encode(''))).toBe(0x00000000);
    expect(crc32(enc.encode('123456789'))).toBe(0xcbf43926);
    expect(crc32(enc.encode('The quick brown fox jumps over the lazy dog'))).toBe(0x414fa339);
  });

  it('returns an unsigned 32-bit integer', () => {
    const c = crc32(enc.encode('hello world'));
    expect(c).toBeGreaterThanOrEqual(0);
    expect(c).toBeLessThanOrEqual(0xffffffff);
    expect(Number.isInteger(c)).toBe(true);
  });
});
