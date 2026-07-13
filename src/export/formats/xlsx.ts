import { ExportCell, ExportData, ExportFormat, ExportOptions } from '../types';
import { ZipWriter } from '../zip/zip';

/**
 * Zero-dependency XLSX (SpreadsheetML) writer. An .xlsx is an OPC package — a
 * ZIP of XML parts — which {@link ZipWriter} builds by hand. We emit the minimal
 * set of parts Excel/LibreOffice open without repair, use inline strings (so no
 * sharedStrings part is needed), and type each cell (number / boolean / date
 * serial / string). Column groups become merged header cells; column widths and
 * a bold header style are included.
 */
export const xlsxFormat: ExportFormat = {
  id: 'xlsx',
  extension: 'xlsx',
  mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',

  render(data: ExportData, options: ExportOptions): Uint8Array {
    const zip = new ZipWriter();
    zip.add('[Content_Types].xml', CONTENT_TYPES);
    zip.add('_rels/.rels', ROOT_RELS);
    zip.add('xl/workbook.xml', WORKBOOK);
    zip.add('xl/_rels/workbook.xml.rels', WORKBOOK_RELS);
    zip.add('xl/styles.xml', STYLES);
    zip.add('xl/worksheets/sheet1.xml', sheetXml(data, options));
    return zip.build();
  },
};

// ---- Static package parts ---------------------------------------------------

const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`;

const ROOT_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;

const WORKBOOK = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets><sheet name="Sheet1" sheetId="1" r:id="rId1"/></sheets>
</workbook>`;

const WORKBOOK_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;

// Style indices used by the sheet:
//   0 = default, 1 = bold header, 2 = date (numFmt 14 = m/d/yyyy), 3 = bold+date (unused but valid)
const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>
<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>
<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="4">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="14" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="14" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1" applyNumberFormat="1"/>
</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;

const STYLE_DEFAULT = 0;
const STYLE_HEADER = 1;
const STYLE_DATE = 2;

// ---- Worksheet --------------------------------------------------------------

function sheetXml(data: ExportData, options: ExportOptions): string {
  const includeHeaders = options.includeHeaders ?? true;
  const headerRows = data.headerRows ?? 0;
  const parts: string[] = [];
  parts.push('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>');
  parts.push('<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">');

  parts.push(colsXml(data));

  parts.push('<sheetData>');
  let rowNum = 1;

  // Multi-level header band rows (group headers), if any.
  if (includeHeaders && headerRows > 0 && data.headerGroups?.length) {
    for (let hr = 0; hr < headerRows; hr++) {
      const cells: string[] = [];
      for (const g of data.headerGroups) {
        if (g.row !== hr) continue;
        cells.push(cellXml(colLetter(g.startCol) + rowNum, STYLE_HEADER, g.header));
      }
      parts.push(`<row r="${rowNum}">${cells.join('')}</row>`);
      rowNum++;
    }
  }

  // Column header row.
  if (includeHeaders) {
    const cells = data.columns.map((c, i) =>
      cellXml(colLetter(i) + rowNum, STYLE_HEADER, c.header),
    );
    parts.push(`<row r="${rowNum}">${cells.join('')}</row>`);
    rowNum++;
  }

  // Data + group rows.
  for (const row of data.rows) {
    const cells = row.cells.map((cell, i) => bodyCellXml(colLetter(i) + rowNum, cell));
    parts.push(`<row r="${rowNum}">${cells.join('')}</row>`);
    rowNum++;
  }

  parts.push('</sheetData>');
  parts.push(mergeXml(data, includeHeaders, headerRows));
  parts.push('</worksheet>');
  return parts.join('');
}

function colsXml(data: ExportData): string {
  const cols = data.columns
    .map((c, i) => {
      // Approx Excel width: characters ≈ px / 7. Clamp to a sane range.
      const chars = Math.min(80, Math.max(6, Math.round(c.width / 7)));
      return `<col min="${i + 1}" max="${i + 1}" width="${chars}" customWidth="1"/>`;
    })
    .join('');
  return `<cols>${cols}</cols>`;
}

function bodyCellXml(ref: string, cell: ExportCell): string {
  // A truly empty cell: no value. Typed cells (number/bool/date) with a value
  // are written even when their display text is blank.
  if (cell.value == null) return `<c r="${ref}"/>`;
  switch (cell.type) {
    case 'Number': {
      const n = Number(cell.value);
      if (!Number.isFinite(n)) return inlineStr(ref, cell.text);
      return `<c r="${ref}"><v>${n}</v></c>`;
    }
    case 'Boolean': {
      if (typeof cell.value !== 'boolean') return inlineStr(ref, cell.text);
      return `<c r="${ref}" t="b"><v>${cell.value ? 1 : 0}</v></c>`;
    }
    case 'Date': {
      const serial = toExcelSerial(cell.value);
      if (serial == null) return inlineStr(ref, cell.text);
      return `<c r="${ref}" s="${STYLE_DATE}"><v>${serial}</v></c>`;
    }
    default:
      return cell.text === '' ? `<c r="${ref}"/>` : inlineStr(ref, cell.text);
  }
}

function cellXml(ref: string, style: number, text: string): string {
  const s = style === STYLE_DEFAULT ? '' : ` s="${style}"`;
  return `<c r="${ref}"${s} t="inlineStr"><is><t xml:space="preserve">${escapeXml(text)}</t></is></c>`;
}

function inlineStr(ref: string, text: string): string {
  return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(text)}</t></is></c>`;
}

// Excel dates are serial days since 1899-12-30 (the 1900 date system, including
// the historical leap-year bug baked into the epoch offset).
function toExcelSerial(value: unknown): number | null {
  const d = value instanceof Date ? value : typeof value === 'string' ? new Date(value) : null;
  if (!d || Number.isNaN(d.getTime())) return null;
  const epoch = Date.UTC(1899, 11, 30);
  const utc = Date.UTC(
    d.getFullYear(),
    d.getMonth(),
    d.getDate(),
    d.getHours(),
    d.getMinutes(),
    d.getSeconds(),
  );
  return (utc - epoch) / 86400000;
}

function mergeXml(data: ExportData, includeHeaders: boolean, headerRows: number): string {
  if (!includeHeaders || !data.headerGroups?.length) return '';
  const cells = data.headerGroups
    .map((g) => {
      const top = g.row + 1;
      const bottom = g.row + g.rowSpan;
      const left = colLetter(g.startCol);
      const right = colLetter(g.endCol);
      if (left === right && top === bottom) return '';
      return `<mergeCell ref="${left}${top}:${right}${bottom}"/>`;
    })
    .filter(Boolean);
  void headerRows;
  if (cells.length === 0) return '';
  return `<mergeCells count="${cells.length}">${cells.join('')}</mergeCells>`;
}

// Column index (0-based) → Excel column letters (A, B, …, Z, AA, …).
function colLetter(index: number): string {
  let n = index;
  let s = '';
  do {
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return s;
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
