import { crc32 } from './crc32';

/**
 * A minimal ZIP (PKZIP / OPC) writer built from scratch — no dependencies. It
 * emits STORED entries (compression method 0, i.e. no compression), which is a
 * fully valid ZIP that Excel and every unzip tool open without complaint;
 * DEFLATE would only reduce size. Enough to package an .xlsx (an OPC ZIP of
 * XML parts).
 *
 * All multi-byte fields are little-endian, per the ZIP spec.
 */

interface Entry {
  nameBytes: Uint8Array;
  data: Uint8Array;
  crc: number;
  offset: number; // byte offset of this entry's local header
}

const LOCAL_SIG = 0x04034b50;
const CENTRAL_SIG = 0x02014b50;
const EOCD_SIG = 0x06054b50;
const VERSION = 20; // 2.0 — needed for STORED with data descriptor-less entries

const utf8 = new TextEncoder();

export class ZipWriter {
  private entries: Entry[] = [];
  private chunks: Uint8Array[] = [];
  private offset = 0;

  /** Add a file. `content` is UTF-8 text or raw bytes. */
  add(path: string, content: string | Uint8Array): void {
    const data = typeof content === 'string' ? utf8.encode(content) : content;
    const nameBytes = utf8.encode(path);
    const crc = crc32(data);
    const entry: Entry = { nameBytes, data, crc, offset: this.offset };
    this.entries.push(entry);

    // Local file header (30 bytes + name), then the stored data.
    const header = new Uint8Array(30 + nameBytes.length);
    const v = new DataView(header.buffer);
    v.setUint32(0, LOCAL_SIG, true);
    v.setUint16(4, VERSION, true);
    v.setUint16(6, 0, true); // general purpose flags
    v.setUint16(8, 0, true); // method 0 = stored
    v.setUint16(10, 0, true); // mod time
    v.setUint16(12, 0x21, true); // mod date (1980-01-01 is 0x21)
    v.setUint32(14, crc, true);
    v.setUint32(18, data.length, true); // compressed size == size (stored)
    v.setUint32(22, data.length, true); // uncompressed size
    v.setUint16(26, nameBytes.length, true);
    v.setUint16(28, 0, true); // extra field length
    header.set(nameBytes, 30);

    this.push(header);
    this.push(data);
  }

  /** Finish the archive and return the complete ZIP bytes. */
  build(): Uint8Array {
    const centralStart = this.offset;

    for (const e of this.entries) {
      const rec = new Uint8Array(46 + e.nameBytes.length);
      const v = new DataView(rec.buffer);
      v.setUint32(0, CENTRAL_SIG, true);
      v.setUint16(4, VERSION, true); // version made by
      v.setUint16(6, VERSION, true); // version needed
      v.setUint16(8, 0, true); // flags
      v.setUint16(10, 0, true); // method (stored)
      v.setUint16(12, 0, true); // mod time
      v.setUint16(14, 0x21, true); // mod date
      v.setUint32(16, e.crc, true);
      v.setUint32(20, e.data.length, true); // compressed size
      v.setUint32(24, e.data.length, true); // uncompressed size
      v.setUint16(28, e.nameBytes.length, true);
      v.setUint16(30, 0, true); // extra length
      v.setUint16(32, 0, true); // comment length
      v.setUint16(34, 0, true); // disk number start
      v.setUint16(36, 0, true); // internal attributes
      v.setUint32(38, 0, true); // external attributes
      v.setUint32(42, e.offset, true); // local header offset
      rec.set(e.nameBytes, 46);
      this.push(rec);
    }

    const centralSize = this.offset - centralStart;

    // End of central directory record (22 bytes, no comment).
    const eocd = new Uint8Array(22);
    const v = new DataView(eocd.buffer);
    v.setUint32(0, EOCD_SIG, true);
    v.setUint16(4, 0, true); // disk number
    v.setUint16(6, 0, true); // disk with central dir
    v.setUint16(8, this.entries.length, true); // entries on this disk
    v.setUint16(10, this.entries.length, true); // total entries
    v.setUint32(12, centralSize, true);
    v.setUint32(16, centralStart, true);
    v.setUint16(20, 0, true); // comment length
    this.push(eocd);

    return this.concat();
  }

  private push(chunk: Uint8Array): void {
    this.chunks.push(chunk);
    this.offset += chunk.length;
  }

  private concat(): Uint8Array {
    const out = new Uint8Array(this.offset);
    let pos = 0;
    for (const c of this.chunks) {
      out.set(c, pos);
      pos += c.length;
    }
    return out;
  }
}
