import { ExportCell, ExportCellStyle, ExportData, ExportFormat, ExportOptions } from '../types';
import { ZipWriter } from '../zip/zip';

/**
 * Zero-dependency XLSX (SpreadsheetML) writer. An .xlsx is an OPC package — a
 * ZIP of XML parts — which {@link ZipWriter} builds by hand. We emit the minimal
 * set of parts Excel/LibreOffice open without repair, use inline strings (so no
 * sharedStrings part is needed), and type each cell (number / boolean / date
 * serial / string). Column groups become merged header cells; column widths, a
 * bold header style, and per-cell styling from a `cellCallback` (bold, italic,
 * color, background, alignment) are all supported by building `styles.xml`
 * dynamically.
 */
export const xlsxFormat: ExportFormat = {
  id: 'xlsx',
  extension: 'xlsx',
  mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',

  render(data: ExportData, options: ExportOptions): Uint8Array {
    const styles = new StyleCollector();
    const sheet = sheetXml(data, options, styles);
    const zip = new ZipWriter();
    zip.add('[Content_Types].xml', CONTENT_TYPES);
    zip.add('_rels/.rels', ROOT_RELS);
    zip.add('xl/workbook.xml', WORKBOOK);
    zip.add('xl/_rels/workbook.xml.rels', WORKBOOK_RELS);
    zip.add('xl/styles.xml', styles.build());
    zip.add('xl/worksheets/sheet1.xml', sheet);
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

// ---- Dynamic styles ---------------------------------------------------------

/** A fully-resolved cell format (base + optional callback style). */
interface XfKey {
  bold: boolean;
  italic: boolean;
  color?: string; // hex without '#'
  fill?: string; // hex without '#'
  align?: 'left' | 'center' | 'right';
  date: boolean;
}

/**
 * Interns fonts, fills, and cell formats (`<xf>`), deduplicating them, and emits
 * a valid `styles.xml`. Callers request a style index for a resolved
 * {@link XfKey}; identical requests reuse the same index.
 */
class StyleCollector {
  private fonts: string[] = ['<font><sz val="11"/><name val="Calibri"/></font>'];
  private fills: string[] = [
    '<fill><patternFill patternType="none"/></fill>',
    '<fill><patternFill patternType="gray125"/></fill>',
  ];
  private xfs: string[] = ['<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'];
  private fontCache = new Map<string, number>();
  private fillCache = new Map<string, number>();
  private xfCache = new Map<string, number>();

  /** Get (or create) a cell-format index for a resolved style. */
  style(key: XfKey): number {
    const id = JSON.stringify(key);
    const cached = this.xfCache.get(id);
    if (cached != null) return cached;

    const fontId = this.font(key);
    const fillId = key.fill ? this.fill(key.fill) : 0;
    const numFmt = key.date ? 14 : 0;

    let xf = `<xf numFmtId="${numFmt}" fontId="${fontId}" fillId="${fillId}" borderId="0" xfId="0"`;
    if (fontId) xf += ' applyFont="1"';
    if (fillId) xf += ' applyFill="1"';
    if (key.date) xf += ' applyNumberFormat="1"';
    if (key.align) {
      xf += ` applyAlignment="1"><alignment horizontal="${key.align}"/></xf>`;
    } else {
      xf += '/>';
    }
    const index = this.xfs.length;
    this.xfs.push(xf);
    this.xfCache.set(id, index);
    return index;
  }

  private font(key: XfKey): number {
    if (!key.bold && !key.italic && !key.color) return 0;
    const id = `${key.bold}|${key.italic}|${key.color ?? ''}`;
    const cached = this.fontCache.get(id);
    if (cached != null) return cached;
    let font = '<font>';
    if (key.bold) font += '<b/>';
    if (key.italic) font += '<i/>';
    font += '<sz val="11"/>';
    if (key.color) font += `<color rgb="FF${key.color}"/>`;
    font += '<name val="Calibri"/></font>';
    const index = this.fonts.length;
    this.fonts.push(font);
    this.fontCache.set(id, index);
    return index;
  }

  private fill(hex: string): number {
    const cached = this.fillCache.get(hex);
    if (cached != null) return cached;
    const fill = `<fill><patternFill patternType="solid"><fgColor rgb="FF${hex}"/><bgColor indexed="64"/></patternFill></fill>`;
    const index = this.fills.length;
    this.fills.push(fill);
    this.fillCache.set(hex, index);
    return index;
  }

  build(): string {
    return (
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
      `<fonts count="${this.fonts.length}">${this.fonts.join('')}</fonts>` +
      `<fills count="${this.fills.length}">${this.fills.join('')}</fills>` +
      '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
      '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
      `<cellXfs count="${this.xfs.length}">${this.xfs.join('')}</cellXfs>` +
      '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
      '</styleSheet>'
    );
  }
}

// Turn an ExportCellStyle + base flags into an interned style index.
function styleIndex(
  styles: StyleCollector,
  base: { bold?: boolean; date?: boolean },
  s: ExportCellStyle | undefined,
): number {
  const key: XfKey = {
    bold: (base.bold ?? false) || (s?.bold ?? false),
    italic: s?.italic ?? false,
    color: hex(s?.color),
    fill: hex(s?.background),
    align: s?.align,
    date: base.date ?? false,
  };
  if (!key.bold && !key.italic && !key.color && !key.fill && !key.align && !key.date) return 0;
  return styles.style(key);
}

// Normalize a CSS color to a 6-hex-digit uppercase string, or undefined.
function hex(color: string | undefined): string | undefined {
  if (!color) return undefined;
  let c = color.trim().replace(/^#/, '');
  const named: Record<string, string> = {
    red: 'FF0000',
    green: '008000',
    blue: '0000FF',
    black: '000000',
    white: 'FFFFFF',
    orange: 'FFA500',
    gray: '808080',
    grey: '808080',
  };
  if (named[c.toLowerCase()]) return named[c.toLowerCase()];
  if (c.length === 3) c = c.replace(/(.)/g, '$1$1');
  return /^[0-9a-fA-F]{6}$/.test(c) ? c.toUpperCase() : undefined;
}

// ---- Worksheet --------------------------------------------------------------

function sheetXml(data: ExportData, options: ExportOptions, styles: StyleCollector): string {
  const includeHeaders = options.includeHeaders ?? true;
  const headerRows = data.headerRows ?? 0;
  const headerStyle = styles.style({ bold: true, italic: false, date: false });
  const outline = data.outline ?? false;
  const parts: string[] = [];
  parts.push('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>');
  parts.push('<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">');

  // sheetPr with outline summary-above so group headers sit above their rows,
  // matching how the grid renders grouping.
  if (outline) {
    parts.push('<sheetPr><outlinePr summaryBelow="0" summaryRight="0"/></sheetPr>');
  }
  if (outline && data.outlineLevels) {
    parts.push(`<sheetFormatPr defaultRowHeight="15" outlineLevelRow="${data.outlineLevels}"/>`);
  }

  parts.push(colsXml(data));

  parts.push('<sheetData>');
  let rowNum = 1;

  if (includeHeaders && headerRows > 0 && data.headerGroups?.length) {
    for (let hr = 0; hr < headerRows; hr++) {
      const cells: string[] = [];
      for (const g of data.headerGroups) {
        if (g.row !== hr) continue;
        cells.push(headerCellXml(colLetter(g.startCol) + rowNum, headerStyle, g.header));
      }
      parts.push(`<row r="${rowNum}">${cells.join('')}</row>`);
      rowNum++;
    }
  }

  if (includeHeaders) {
    const cells = data.columns.map((c, i) =>
      headerCellXml(colLetter(i) + rowNum, headerStyle, c.header),
    );
    parts.push(`<row r="${rowNum}">${cells.join('')}</row>`);
    rowNum++;
  }
  // The header row that carries the AutoFilter (last header row).
  const filterHeaderRow = includeHeaders ? rowNum - 1 : 0;

  for (const row of data.rows) {
    const cells = row.cells.map((cell, i) => bodyCellXml(colLetter(i) + rowNum, cell, styles));
    // Excel row outlining: outline level for grouped data rows (group-header
    // summary rows stay at level 0 so they head their section).
    let attrs =
      outline && row.kind === 'data' && row.level ? ` outlineLevel="${row.level}"` : '';
    // Rows filtered out by the active AutoFilter are hidden but still present.
    if (row.hidden) attrs += ' hidden="1"';
    parts.push(`<row r="${rowNum}"${attrs}>${cells.join('')}</row>`);
    rowNum++;
  }

  const dataStartRow =
    1 +
    (includeHeaders && headerRows > 0 && data.headerGroups?.length ? headerRows : 0) +
    (includeHeaders ? 1 : 0);
  parts.push('</sheetData>');
  // Schema order: autoFilter precedes mergeCells.
  parts.push(autoFilterXml(data, includeHeaders, filterHeaderRow, rowNum - 1));
  parts.push(mergeXml(data, includeHeaders, dataStartRow));
  parts.push('</worksheet>');
  return parts.join('');
}

function colsXml(data: ExportData): string {
  const cols = data.columns
    .map((c, i) => {
      const chars = Math.min(80, Math.max(6, Math.round(c.width / 7)));
      return `<col min="${i + 1}" max="${i + 1}" width="${chars}" customWidth="1"/>`;
    })
    .join('');
  return `<cols>${cols}</cols>`;
}

function bodyCellXml(ref: string, cell: ExportCell, styles: StyleCollector): string {
  if (cell.value == null && (cell.text === '' || cell.text == null)) {
    const s = styleIndex(styles, {}, cell.style);
    return s ? `<c r="${ref}" s="${s}"/>` : `<c r="${ref}"/>`;
  }
  switch (cell.type) {
    case 'Number': {
      const n = Number(cell.value);
      if (!Number.isFinite(n)) return inlineStr(ref, cell.text, styleIndex(styles, {}, cell.style));
      return `<c r="${ref}"${sAttr(styleIndex(styles, {}, cell.style))}><v>${n}</v></c>`;
    }
    case 'Boolean': {
      if (typeof cell.value !== 'boolean')
        return inlineStr(ref, cell.text, styleIndex(styles, {}, cell.style));
      return `<c r="${ref}" t="b"${sAttr(styleIndex(styles, {}, cell.style))}><v>${cell.value ? 1 : 0}</v></c>`;
    }
    case 'Date': {
      const serial = toExcelSerial(cell.value);
      const s = styleIndex(styles, { date: true }, cell.style);
      if (serial == null) return inlineStr(ref, cell.text, styleIndex(styles, {}, cell.style));
      return `<c r="${ref}" s="${s}"><v>${serial}</v></c>`;
    }
    default:
      return cell.text === ''
        ? `<c r="${ref}"${sAttr(styleIndex(styles, {}, cell.style))}/>`
        : inlineStr(ref, cell.text, styleIndex(styles, {}, cell.style));
  }
}

function headerCellXml(ref: string, style: number, text: string): string {
  return `<c r="${ref}"${sAttr(style)} t="inlineStr"><is><t xml:space="preserve">${escapeXml(text)}</t></is></c>`;
}

function inlineStr(ref: string, text: string, style: number): string {
  return `<c r="${ref}"${sAttr(style)} t="inlineStr"><is><t xml:space="preserve">${escapeXml(text)}</t></is></c>`;
}

function sAttr(style: number): string {
  return style ? ` s="${style}"` : '';
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

function autoFilterXml(
  data: ExportData,
  includeHeaders: boolean,
  headerRow: number,
  lastRow: number,
): string {
  // AutoFilter needs a header row to anchor the dropdowns.
  if (!data.autoFilter || !includeHeaders || data.columns.length === 0) return '';
  const left = colLetter(0);
  const right = colLetter(data.columns.length - 1);
  const bottom = Math.max(headerRow, lastRow);
  const ref = `${left}${headerRow}:${right}${bottom}`;

  // Per-column value filters (the checkbox list). colId is 0-based within the
  // AutoFilter range, which starts at column 0 here.
  const inner = (data.filters ?? [])
    .filter((f) => f.values.length > 0)
    .map((f) => {
      const filters = f.values.map((v) => `<filter val="${escapeXml(v)}"/>`).join('');
      return `<filterColumn colId="${f.col}"><filters>${filters}</filters></filterColumn>`;
    })
    .join('');

  return inner ? `<autoFilter ref="${ref}">${inner}</autoFilter>` : `<autoFilter ref="${ref}"/>`;
}

function mergeXml(data: ExportData, includeHeaders: boolean, dataStartRow: number): string {
  const cells: string[] = [];

  // Header-group band merges (only when headers are emitted).
  if (includeHeaders && data.headerGroups?.length) {
    for (const g of data.headerGroups) {
      const top = g.row + 1;
      const bottom = g.row + g.rowSpan;
      const left = colLetter(g.startCol);
      const right = colLetter(g.endCol);
      if (left === right && top === bottom) continue;
      cells.push(`<mergeCell ref="${left}${top}:${right}${bottom}"/>`);
    }
  }

  // Data-region merges (from a merge manager), offset by the header rows.
  if (data.merges?.length) {
    for (const m of data.merges) {
      const top = dataStartRow + m.topRow;
      const bottom = dataStartRow + m.bottomRow;
      const left = colLetter(m.leftCol);
      const right = colLetter(m.rightCol);
      if (left === right && top === bottom) continue;
      cells.push(`<mergeCell ref="${left}${top}:${right}${bottom}"/>`);
    }
  }

  if (cells.length === 0) return '';
  return `<mergeCells count="${cells.length}">${cells.join('')}</mergeCells>`;
}

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
