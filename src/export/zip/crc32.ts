/**
 * CRC-32 (IEEE 802.3, polynomial 0xEDB88370 reflected) used by the ZIP file
 * format. Zero-dependency: the lookup table is built once on first use.
 */

let table: Uint32Array | null = null;

function buildTable(): Uint32Array {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    t[n] = c >>> 0;
  }
  return t;
}

/** Compute the CRC-32 of a byte array. Returns an unsigned 32-bit integer. */
export function crc32(bytes: Uint8Array): number {
  if (!table) table = buildTable();
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    crc = table[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
