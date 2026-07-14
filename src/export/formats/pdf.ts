import { ExportData, ExportFormat, ExportOptions, ExportRow } from '../types';

/**
 * Zero-dependency PDF writer that lays the export out as a paginated table with
 * gridlines, a bold-ish header row, and one of the 14 standard fonts (Helvetica)
 * so no font file needs embedding. The PDF object model (catalog → pages →
 * page(s) → content stream) is assembled by hand with a correct xref table.
 *
 * Coordinate system: origin is bottom-left, y increases upward.
 */
export const pdfFormat: ExportFormat = {
  id: 'pdf',
  extension: 'pdf',
  mimeType: 'application/pdf',

  render(data: ExportData, options: ExportOptions): Uint8Array {
    return new PdfDoc(data, options).build();
  },
};

// US Letter in points (72 per inch).
const PAGE = { portrait: { w: 612, h: 792 }, landscape: { w: 792, h: 612 } };
const MARGIN = 36;
const CHAR_W = 0.5; // Helvetica avg glyph width ≈ 0.5em, for width estimates

class PdfDoc {
  private page: { w: number; h: number };
  private fontSize: number;
  private rowH: number;
  private includeHeaders: boolean;
  private colX: number[] = [];
  private tableWidth: number;

  constructor(
    private data: ExportData,
    options: ExportOptions,
  ) {
    const pdf = options.pdf ?? {};
    this.page = PAGE[pdf.orientation ?? 'landscape'];
    this.fontSize = pdf.fontSize ?? 9;
    this.rowH = this.fontSize + 6;
    this.includeHeaders = options.includeHeaders ?? true;

    // Scale column pixel widths to fit the printable width.
    const printable = this.page.w - MARGIN * 2;
    const totalPx = data.columns.reduce((s, c) => s + c.width, 0) || 1;
    const scale = printable / totalPx;
    let x = MARGIN;
    this.colX = [x];
    for (const c of data.columns) {
      x += c.width * scale;
      this.colX.push(x);
    }
    this.tableWidth = x - MARGIN;
  }

  build(): Uint8Array {
    const pages = this.paginate();
    const streams = pages.map((rows, i) => this.pageStream(rows, i === 0));

    // Object layout: 1 catalog, 2 pages, 3 font, then per-page [pageObj, contentObj].
    const pageObjIds: number[] = [];
    const objects: string[] = [];
    const firstPageObj = 5;
    for (let i = 0; i < pages.length; i++) pageObjIds.push(firstPageObj + i * 2);

    objects[1] = `<< /Type /Catalog /Pages 2 0 R >>`;
    objects[2] = `<< /Type /Pages /Kids [${pageObjIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pages.length} >>`;
    objects[3] = `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>`;
    objects[4] = `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>`;

    for (let i = 0; i < pages.length; i++) {
      const pageId = firstPageObj + i * 2;
      const contentId = pageId + 1;
      objects[pageId] =
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${this.page.w} ${this.page.h}] ` +
        `/Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentId} 0 R >>`;
      objects[contentId] = `<< /Length ${byteLen(streams[i])} >>\nstream\n${streams[i]}\nendstream`;
    }

    return this.serialize(objects);
  }

  // Split rows into pages by available vertical space.
  private paginate(): ExportRow[][] {
    const top = this.page.h - MARGIN - (this.data.title ? this.rowH + 6 : 0);
    const bottom = MARGIN;
    const headerH = this.includeHeaders ? this.rowH : 0;
    const rowsPerPage = Math.max(1, Math.floor((top - bottom - headerH) / this.rowH));
    const pages: ExportRow[][] = [];
    for (let i = 0; i < this.data.rows.length; i += rowsPerPage) {
      pages.push(this.data.rows.slice(i, i + rowsPerPage));
    }
    return pages.length ? pages : [[]];
  }

  private pageStream(rows: ExportRow[], firstPage: boolean): string {
    const ops: string[] = [];
    let y = this.page.h - MARGIN;

    if (firstPage && this.data.title) {
      ops.push(text(MARGIN, y - this.fontSize - 2, this.data.title, this.fontSize + 3));
      y -= this.rowH + 6;
    }

    const tableTop = y;

    if (this.includeHeaders) {
      ops.push(`0.93 0.95 0.98 rg`);
      ops.push(rect(MARGIN, y - this.rowH, this.tableWidth, this.rowH, true));
      ops.push(`0 0 0 rg`);
      this.data.columns.forEach((c, i) => {
        ops.push(this.cellText(c.header, i, y, c.align, { bold: true }));
      });
      y -= this.rowH;
    }

    for (const row of rows) {
      if (row.kind === 'group') {
        ops.push(`0.90 0.92 0.97 rg`);
        ops.push(rect(MARGIN, y - this.rowH, this.tableWidth, this.rowH, true));
        ops.push(`0 0 0 rg`);
      }
      // Per-cell backgrounds first, so text draws on top.
      row.cells.forEach((cell, i) => {
        if (i >= this.data.columns.length) return;
        const bg = cell.style?.background && rgb(cell.style.background);
        if (bg) {
          ops.push(`${bg} rg`);
          ops.push(rect(this.colX[i], y - this.rowH, this.colX[i + 1] - this.colX[i], this.rowH, true));
          ops.push(`0 0 0 rg`);
        }
      });
      row.cells.forEach((cell, i) => {
        if (i >= this.data.columns.length) return;
        ops.push(this.cellText(cell.text, i, y, cell.style?.align ?? cell.align, cell.style));
      });
      y -= this.rowH;
    }

    // Gridlines.
    ops.push(`0.8 0.8 0.8 RG`);
    ops.push(`0.5 w`);
    for (let i = 0; i <= this.data.columns.length; i++) {
      ops.push(line(this.colX[i], tableTop, this.colX[i], y));
    }
    for (let ry = tableTop, r = 0; ry >= y - 0.1; ry -= this.rowH, r++) {
      ops.push(line(MARGIN, ry, MARGIN + this.tableWidth, ry));
    }

    return ops.join('\n');
  }

  private cellText(
    value: string,
    col: number,
    y: number,
    align: string,
    style?: { bold?: boolean; italic?: boolean; color?: string },
  ): string {
    const left = this.colX[col];
    const right = this.colX[col + 1];
    const cellW = right - left - 8;
    const clipped = this.clip(value, cellW);
    const textW = clipped.length * this.fontSize * CHAR_W;
    let x = left + 4;
    if (align === 'right') x = right - 4 - textW;
    else if (align === 'center') x = left + (right - left - textW) / 2;

    const font = style?.bold ? 'F2' : 'F1';
    const color = style?.color && rgb(style.color);
    const drawn = text(x, y - this.fontSize - 3, clipped, this.fontSize, font);
    if (!color) return drawn;
    // Set fill color, draw, reset to black.
    return `${color} rg\n${drawn}\n0 0 0 rg`;
  }

  private clip(value: string, maxWidth: number): string {
    const per = this.fontSize * CHAR_W;
    const max = Math.max(1, Math.floor(maxWidth / per));
    if (value.length <= max) return value;
    return value.slice(0, Math.max(1, max - 1)) + '…';
  }

  // Emit the object table + xref + trailer with correct byte offsets.
  private serialize(objects: string[]): Uint8Array {
    const count = objects.length; // objects[0] unused; ids are 1..count-1
    let out = '%PDF-1.4\n%\xFF\xFF\xFF\xFF\n';
    const offsets: number[] = [];
    for (let id = 1; id < count; id++) {
      offsets[id] = byteLen(out);
      out += `${id} 0 obj\n${objects[id]}\nendobj\n`;
    }
    const xrefStart = byteLen(out);
    const total = count; // entries 0..count-1
    out += `xref\n0 ${total}\n`;
    out += `0000000000 65535 f \n`;
    for (let id = 1; id < count; id++) {
      out += `${String(offsets[id]).padStart(10, '0')} 00000 n \n`;
    }
    out += `trailer\n<< /Size ${total} /Root 1 0 R >>\n`;
    out += `startxref\n${xrefStart}\n%%EOF`;
    return latin1(out);
  }
}

// ---- PDF content-stream helpers ---------------------------------------------

function text(x: number, y: number, value: string, size: number, font = 'F1'): string {
  return `BT /${font} ${size} Tf ${fixed(x)} ${fixed(y)} Td (${escapePdf(value)}) Tj ET`;
}

// Convert a CSS color to a PDF "r g b" fill triple (0..1), or '' if unknown.
function rgb(color: string): string {
  const named: Record<string, [number, number, number]> = {
    red: [204, 0, 0],
    green: [0, 128, 0],
    blue: [0, 0, 204],
    black: [0, 0, 0],
    white: [255, 255, 255],
    orange: [255, 165, 0],
    gray: [128, 128, 128],
    grey: [128, 128, 128],
  };
  let c = color.trim().replace(/^#/, '');
  let r: number, g: number, b: number;
  if (named[c.toLowerCase()]) {
    [r, g, b] = named[c.toLowerCase()];
  } else {
    if (c.length === 3) c = c.replace(/(.)/g, '$1$1');
    if (!/^[0-9a-fA-F]{6}$/.test(c)) return '';
    r = parseInt(c.slice(0, 2), 16);
    g = parseInt(c.slice(2, 4), 16);
    b = parseInt(c.slice(4, 6), 16);
  }
  return `${(r / 255).toFixed(3)} ${(g / 255).toFixed(3)} ${(b / 255).toFixed(3)}`;
}

function rect(x: number, y: number, w: number, h: number, fill: boolean): string {
  return `${fixed(x)} ${fixed(y)} ${fixed(w)} ${fixed(h)} re ${fill ? 'f' : 'S'}`;
}

function line(x1: number, y1: number, x2: number, y2: number): string {
  return `${fixed(x1)} ${fixed(y1)} m ${fixed(x2)} ${fixed(y2)} l S`;
}

function fixed(n: number): string {
  return n.toFixed(2);
}

function escapePdf(value: string): string {
  // Escape the three special chars; drop non-Latin1 so the standard font renders.
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
    .replace(/[^\x20-\x7e]/g, '?');
}

// Byte length of a latin1/binary string.
function byteLen(s: string): number {
  return s.length; // all chars are < 256 (latin1) by construction
}

function latin1(s: string): Uint8Array {
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i) & 0xff;
  return out;
}
