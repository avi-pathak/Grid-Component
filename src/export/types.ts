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

/** Optional per-cell styling honored by typed writers (xlsx, pdf). */
export interface ExportCellStyle {
  bold?: boolean;
  italic?: boolean;
  /** Text color as a hex string, e.g. '#c00' or 'red'. */
  color?: string;
  /** Background fill as a hex string. */
  background?: string;
  /** Override the cell's horizontal alignment. */
  align?: CellAlign;
}

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
  /** Optional styling, typically set by a `cellCallback`. */
  style?: ExportCellStyle;
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
  /**
   * Outline depth. For a group-header row this is its own nesting level
   * (0 = outermost). For a data row this is the depth of the group it sits in
   * (the number of group levels above it), used to emit Excel row grouping.
   */
  level?: number;
  /** Excel hides this row (it doesn't pass the active AutoFilter criteria). */
  hidden?: boolean;
}

/** A merged cell span in the data region, in export-row/column coordinates. */
export interface ExportMerge {
  /** Inclusive row range, indexing into `ExportData.rows`. */
  topRow: number;
  bottomRow: number;
  /** Inclusive column range, indexing into `ExportData.columns`. */
  leftCol: number;
  rightCol: number;
}

/**
 * An active column filter carried into the exported AutoFilter. `values` is the
 * set of display values that pass (a checkbox-style filter). Cells not in the
 * set are filtered out in Excel; the exporter also hides non-matching rows so
 * the file opens showing the filtered result.
 */
export interface ExportColumnFilter {
  /** Export-column index this filter applies to. */
  col: number;
  /** Display values that pass the filter. */
  values: string[];
}

/** The full, format-agnostic export payload. */
export interface ExportData {
  columns: ExportColumn[];
  rows: ExportRow[];
  /** Multi-level header bands above the columns, when column groups are active. */
  headerGroups?: ExportHeaderGroup[];
  /** Number of header rows the `headerGroups` occupy above the column row. */
  headerRows?: number;
  /** Merged cell spans in the data region (from a merge manager). */
  merges?: ExportMerge[];
  /** When true, the writer adds a filter dropdown to the header row (xlsx). */
  autoFilter?: boolean;
  /** Active column filter criteria to reflect in the exported AutoFilter. */
  filters?: ExportColumnFilter[];
  /** When true, the export used Excel row grouping (rows carry outline levels). */
  outline?: boolean;
  /** The deepest outline level used, so the writer can size the outline pane. */
  outlineLevels?: number;
  /** Optional document/sheet title. */
  title?: string;
}

/**
 * Context passed to a {@link CellCallback} for each exported cell, mirroring
 * Wijmo's `formatItem`. Mutate `cell.value` / `cell.text` / `cell.style` to
 * customize what is written. `binding` and `rowKind` help target specific cells.
 */
export interface ExportCellContext {
  cell: ExportCell;
  /** The cell's column. */
  column: ExportColumn;
  /** Visible-column index. */
  col: number;
  /** Export-row index. */
  row: number;
  /** Whether this row is a data row or a group-header row. */
  rowKind: 'data' | 'group';
  /** The source data item for data rows, or null for group rows. */
  item: Record<string, unknown> | null;
}

/** Context passed to a {@link HeaderCallback} for each header cell. */
export interface ExportHeaderContext {
  column: ExportColumn;
  col: number;
  /** Mutate to change the exported header text. */
  text: string;
}

/**
 * Customize each exported cell. Runs after the value/text are resolved, before
 * the writer renders. Return nothing — mutate `ctx.cell` in place.
 */
export type CellCallback = (ctx: ExportCellContext) => void;

/** Customize each header cell's text. Return a string, or mutate `ctx.text`. */
export type HeaderCallback = (ctx: ExportHeaderContext) => string | void;

/** Progress notification during an async export (fraction in 0..1). */
export type ExportProgress = (fraction: number) => void;

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
  /**
   * Add a native Excel AutoFilter dropdown to the header row (xlsx only).
   * Defaults to true when the grid has filtering enabled.
   */
  autoFilter?: boolean;
  /**
   * Use native Excel row grouping (collapsible outline) for grouped data
   * instead of plain group-header text rows (xlsx only). Implies
   * `includeGroups`. Defaults to true when the grid is grouped.
   */
  outlineGroups?: boolean;
  /** Trigger a browser download. Default true. Set false to just get the Blob back. */
  download?: boolean;
  /** Optional title placed above the table (used by pdf/xlsx). */
  title?: string;
  /** Customize every cell (value / text / style) before it is written. */
  cellCallback?: CellCallback;
  /** Customize every header cell's text before it is written. */
  headerCallback?: HeaderCallback;
  /** Progress callback for `exportAsync` (0..1). */
  onProgress?: ExportProgress;
  /**
   * Show the built-in progress overlay during `exportAsync`. Default false
   * (hidden) — enable when exporting large datasets.
   */
  showProgress?: boolean;
  /** Abort an in-flight `exportAsync`. */
  signal?: AbortSignal;
  /** Rows processed per async chunk before yielding. Default 2000. */
  chunkSize?: number;
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
