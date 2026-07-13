import { CellAlign, DataType } from '../models/Column';

/**
 * The export module works against a format-agnostic intermediate
 * representation (IR) so that reading the grid is decoupled from writing any
 * particular file format. The grid builds an {@link ExportData} once, then each
 * {@link ExportFormat} renders it — new formats (csv, xlsx, pdf, …) plug in by
 * implementing the interface, never by touching the grid.
 */

/** How a value should be encoded in typed formats (Excel cells, etc.). */
export type ExportCellType = DataType; // 'String' | 'Number' | 'Boolean' | 'Date'

/** One exported cell: the raw typed value plus its formatted display text. */
export interface ExportCell {
  /** The raw value (number, string, boolean, Date, or null). */
  value: unknown;
  /** The formatted text the grid would display for this value. */
  text: string;
  /** Value type, used by typed writers (Excel) to emit the right cell kind. */
  type: ExportCellType;
  /** Horizontal alignment inherited from the column. */
  align: CellAlign;
  /** Column span (for group-header/aggregate rows); defaults to 1. */
  colSpan?: number;
}

/** A column in the export, derived from a grid {@link Column}. */
export interface ExportColumn {
  /** Header text. */
  header: string;
  /** The column's binding/key. */
  key: string;
  type: ExportCellType;
  align: CellAlign;
  /** Preferred width in pixels (writers convert to their own units). */
  width: number;
}

/** A group-header band spanning leaf columns, for multi-level headers. */
export interface ExportHeaderGroup {
  header: string;
  /** Inclusive leaf-column index range this band covers. */
  startCol: number;
  endCol: number;
  /** Header row, 0 = topmost. */
  row: number;
  /** Rows this cell spans down (shallow leaves reach the bottom). */
  rowSpan: number;
}

/** One exported row: data, or a group-header/aggregate row. */
export interface ExportRow {
  kind: 'data' | 'group';
  cells: ExportCell[];
  /** Nesting depth for group rows (0 = outermost). */
  level?: number;
}

/** The full, format-agnostic export payload. */
export interface ExportData {
  columns: ExportColumn[];
  rows: ExportRow[];
  /** Multi-level header bands above the columns, when column groups are active. */
  headerGroups?: ExportHeaderGroup[];
  /** Number of header rows the `headerGroups` occupy above the column row. */
  headerRows?: number;
  /** Optional document/sheet title. */
  title?: string;
}

/** Per-export options; superset consumed by the manager and the writers. */
export interface ExportOptions {
  /** Registered format id: 'csv' | 'xlsx' | 'pdf' | … Default 'csv'. */
  format?: string;
  /** File name without extension. Default 'export'. */
  fileName?: string;
  /** Which rows to export. Default 'all'. */
  rows?: 'all' | 'selection';
  /** Bindings of the columns to include, in order. Default: all visible columns. */
  columns?: string[];
  /** Emit a header row. Default true. */
  includeHeaders?: boolean;
  /** Include group-header rows (with aggregates) when the grid is grouped. Default false. */
  includeGroups?: boolean;
  /** Trigger a browser download. Default true. Set false to just get the Blob back. */
  download?: boolean;
  /** Optional title placed above the table (used by pdf/xlsx). */
  title?: string;
  /** CSV-specific tuning. */
  csv?: CsvOptions;
  /** PDF-specific tuning. */
  pdf?: PdfOptions;
}

export interface CsvOptions {
  /** Field delimiter. Default ','. */
  delimiter?: string;
  /** Prefix a UTF-8 BOM so Excel opens it as UTF-8. Default true. */
  bom?: boolean;
  /** Line terminator. Default '\r\n' (RFC 4180). */
  newline?: string;
}

export interface PdfOptions {
  /** Page orientation. Default 'landscape'. */
  orientation?: 'portrait' | 'landscape';
  /** Body font size in points. Default 9. */
  fontSize?: number;
}

/**
 * A pluggable output format. Implementations are pure: they turn the IR into
 * text (csv) or bytes (xlsx, pdf) and know their own file metadata.
 */
export interface ExportFormat {
  /** Stable id used to select the format, e.g. 'csv'. */
  readonly id: string;
  /** File extension without the dot, e.g. 'csv'. */
  readonly extension: string;
  /** MIME type for the download / Blob. */
  readonly mimeType: string;
  /** Render the IR to the final artifact. */
  render(data: ExportData, options: ExportOptions): string | Uint8Array;
}
