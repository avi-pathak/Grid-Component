import { Column } from '../models/Column';
import { computeAggregate } from '../data/aggregate';
import { CollectionViewGroup } from '../data/CollectionViewGroup';
import {
  ExportCell,
  ExportColumn,
  ExportData,
  ExportHeaderGroup,
  ExportMerge,
  ExportOptions,
  ExportRow,
} from './types';

/** The minimal row-source the builder reads — a subset of {@link DataView}. */
export interface ExportSource {
  /** Number of display rows (data rows plus visible group headers). */
  readonly length: number;
  /** Whether the source is grouped (has group-header rows). */
  readonly grouped?: boolean;
  item(index: number): Record<string, unknown> | undefined;
  rowType(index: number): 'group' | 'data';
  groupRow(index: number): { group: CollectionViewGroup; level: number } | null;
}

/** A resolved column group band for multi-level header export. */
export interface ExportColumnGroupSpan {
  header: string;
  startCol: number;
  endCol: number;
  row: number;
  rowSpan: number;
}

export interface BuildExportInput {
  /** The columns to export, already ordered/filtered. */
  columns: Column[];
  source: ExportSource;
  /** Rectangle to limit rows/cols to, or null for the whole grid. */
  selection?: { topRow: number; bottomRow: number; leftCol: number; rightCol: number } | null;
  /** Optional multi-level header bands (from grid column groups). */
  headerGroups?: ExportColumnGroupSpan[];
  headerRows?: number;
  /**
   * Optional cell-merge lookup in grid coordinates: given a (displayRow,
   * gridCol) it returns the span that cell belongs to, or null. Used to emit
   * merged cells in the export. `gridColOf` maps an export-column index back to
   * the grid-column index the lookup expects.
   */
  merge?: (displayRow: number, gridCol: number) => ExportMergeRange | null;
  /** Map an export-column index to its grid-column index (identity by default). */
  gridColOf?: (exportCol: number) => number;
  /** Whether the grid has column filtering enabled (drives AutoFilter default). */
  filterable?: boolean;
  /** Active value-filters (export-column index → passing display values). */
  filters?: { col: number; values: string[] }[];
}

/** A merge span in grid coordinates, as returned by the grid's merge manager. */
export interface ExportMergeRange {
  topRow: number;
  bottomRow: number;
  leftCol: number;
  rightCol: number;
}

/**
 * Turn grid columns + a row source into the format-agnostic {@link ExportData}.
 * Pure and grid-free: each cell carries its raw value, its formatted text, its
 * type, and alignment, so any writer can render it. Group-header rows (with
 * aggregates) are included when `options.includeGroups` is set and the source
 * is grouped.
 */
export function buildExportData(input: BuildExportInput, options: ExportOptions): ExportData {
  const ctx = prepare(input, options);
  for (let r = ctx.firstRow; r <= ctx.lastRow; r++) {
    const row = ctx.buildRow(r);
    if (row) ctx.rows.push(row);
  }
  return ctx.finish();
}

/**
 * Async variant of {@link buildExportData}: builds rows in chunks, yielding to
 * the event loop between chunks so a large export doesn't freeze the page.
 * Reports progress (0..1) and honors an AbortSignal. Rejects with an
 * `AbortError` if the signal fires.
 */
export async function buildExportDataAsync(
  input: BuildExportInput,
  options: ExportOptions,
): Promise<ExportData> {
  const ctx = prepare(input, options);
  const chunk = Math.max(1, options.chunkSize ?? 2000);
  const total = Math.max(1, ctx.lastRow - ctx.firstRow + 1);
  let done = 0;

  for (let r = ctx.firstRow; r <= ctx.lastRow; r++) {
    if (options.signal?.aborted) throw abortError();
    const row = ctx.buildRow(r);
    if (row) ctx.rows.push(row);
    done++;
    if (done % chunk === 0) {
      options.onProgress?.(Math.min(1, done / total));
      await yieldToEventLoop();
      if (options.signal?.aborted) throw abortError();
    }
  }
  options.onProgress?.(1);
  return ctx.finish();
}

// Shared setup + per-row builder used by both the sync and async paths.
function prepare(input: BuildExportInput, options: ExportOptions) {
  const { columns, source, selection } = input;
  // Detect whether the source is grouped by probing for any group row.
  const grouped = hasGroupRows(source);
  // Outline grouping (native Excel row grouping) defaults on when grouped; it
  // implies emitting the group-header rows as summary rows.
  const outline = grouped && (options.outlineGroups ?? true);
  const includeGroups = outline || (options.includeGroups ?? false);
  const cellCallback = options.cellCallback;

  const exportColumns: ExportColumn[] = columns.map((c) => ({
    header: c.header,
    key: c.binding,
    type: c.dataType,
    align: c.align,
    width: c.width,
  }));

  // Apply the header callback once, up front.
  if (options.headerCallback) {
    exportColumns.forEach((column, col) => {
      const out = options.headerCallback!({ column, col, text: column.header });
      column.header = typeof out === 'string' ? out : column.header;
    });
  }

  const firstRow = selection ? Math.max(0, selection.topRow) : 0;
  const lastRow = selection ? Math.min(source.length - 1, selection.bottomRow) : source.length - 1;
  const rows: ExportRow[] = [];
  // Source display-row index for each pushed export row (data rows only carry a
  // meaningful value; group rows record -1). Used to resolve merge spans.
  const displayRows: number[] = [];
  // Running group depth: a data row sits `currentDepth` levels deep (the level
  // of the most recent group header + 1). Drives Excel row outlining.
  let currentDepth = 0;
  let maxOutline = 0;

  const runCellCallbacks = (
    row: ExportRow,
    rowIndex: number,
    item: Record<string, unknown> | null,
  ): void => {
    if (!cellCallback) return;
    row.cells.forEach((cell, col) => {
      cellCallback({
        cell,
        column: exportColumns[col],
        col,
        row: rowIndex,
        rowKind: row.kind,
        item,
      });
    });
  };

  const buildRow = (r: number): ExportRow | null => {
    if (source.rowType(r) === 'group') {
      if (!includeGroups) return null;
      const gr = source.groupRow(r);
      if (!gr) return null;
      const row = groupRow(gr.group, gr.level, columns);
      // Data rows following this header sit one level deeper.
      currentDepth = gr.level + 1;
      if (currentDepth > maxOutline) maxOutline = currentDepth;
      runCellCallbacks(row, r, null);
      displayRows.push(-1);
      return row;
    }
    const item = source.item(r);
    if (!item) return null;
    const row: ExportRow = {
      kind: 'data',
      cells: columns.map((c) => dataCell(c, item)),
      level: outline && currentDepth > 0 ? currentDepth : undefined,
    };
    runCellCallbacks(row, r, item);
    displayRows.push(r);
    return row;
  };

  const finish = (): ExportData => {
    const merges = input.merge ? collectMerges(rows, displayRows, input) : undefined;
    // AutoFilter defaults to on when the caller enabled filtering support.
    const autoFilter = options.autoFilter ?? (input.filterable ?? false);

    // Reflect active value-filters: hide non-matching data rows so Excel opens
    // showing the filtered result, while the AutoFilter keeps the criteria.
    const filters = input.filters?.length ? input.filters : undefined;
    if (filters) {
      const sets = filters.map((f) => ({ col: f.col, set: new Set(f.values) }));
      for (const row of rows) {
        if (row.kind !== 'data') continue;
        const passes = sets.every(({ col, set }) => set.has(row.cells[col]?.text ?? ''));
        if (!passes) row.hidden = true;
      }
    }

    return {
      columns: exportColumns,
      rows,
      headerGroups: input.headerGroups as ExportHeaderGroup[] | undefined,
      headerRows: input.headerRows,
      merges,
      autoFilter,
      filters,
      outline: outline && maxOutline > 0,
      outlineLevels: maxOutline,
      title: options.title,
    };
  };

  return { firstRow, lastRow, rows, buildRow, finish };
}

// Cheap probe: does the source have any group rows? (grouped view)
function hasGroupRows(source: ExportSource): boolean {
  const n = Math.min(source.length, 500);
  for (let i = 0; i < n; i++) if (source.rowType(i) === 'group') return true;
  return false;
}

/**
 * Resolve merge spans (in grid coordinates) into export-coordinate spans, and
 * blank the non-origin cells of each span so writers don't repeat the value.
 * Only spans that cover ≥2 exported cells are emitted; a span partly outside the
 * export (e.g. clipped by a selection or reordered columns) is truncated to the
 * exported portion.
 */
function collectMerges(
  rows: ExportRow[],
  displayRows: number[],
  input: BuildExportInput,
): ExportMerge[] {
  const merge = input.merge!;
  const gridColOf = input.gridColOf ?? ((c: number) => c);
  const colCount = input.columns.length;

  // Map a grid display-row → export-row index (data rows only).
  const displayToExport = new Map<number, number>();
  displayRows.forEach((d, exportRow) => {
    if (d >= 0) displayToExport.set(d, exportRow);
  });

  const merges: ExportMerge[] = [];
  const seen = new Set<string>();

  for (let exportRow = 0; exportRow < rows.length; exportRow++) {
    if (rows[exportRow].kind !== 'data') continue;
    const displayRow = displayRows[exportRow];
    for (let exportCol = 0; exportCol < colCount; exportCol++) {
      const span = merge(displayRow, gridColOf(exportCol));
      if (!span) continue;
      // A span may cover several grid columns; find the exported columns whose
      // grid index falls in [leftCol, rightCol].
      const exportCols: number[] = [];
      for (let c = 0; c < colCount; c++) {
        const gc = gridColOf(c);
        if (gc >= span.leftCol && gc <= span.rightCol) exportCols.push(c);
      }
      // Rows of the span that are present in the export, in export order.
      const exportRows: number[] = [];
      for (let dr = span.topRow; dr <= span.bottomRow; dr++) {
        const er = displayToExport.get(dr);
        if (er != null) exportRows.push(er);
      }
      if (exportRows.length === 0 || exportCols.length === 0) continue;
      const top = Math.min(...exportRows);
      const bottom = Math.max(...exportRows);
      const left = Math.min(...exportCols);
      const right = Math.max(...exportCols);
      if (top === bottom && left === right) continue; // not a real span here

      const key = `${top}:${left}`;
      if (seen.has(key)) continue;
      seen.add(key);
      merges.push({ topRow: top, bottomRow: bottom, leftCol: left, rightCol: right });

      // Blank the non-origin cells within the exported span.
      for (const er of exportRows) {
        for (const ec of exportCols) {
          if (er === top && ec === left) continue;
          const cell = rows[er].cells[ec];
          if (cell) {
            cell.value = null;
            cell.text = '';
          }
        }
      }
    }
  }
  return merges;
}

function yieldToEventLoop(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function abortError(): Error {
  const err = new Error('Export aborted');
  err.name = 'AbortError';
  return err;
}

function dataCell(column: Column, item: Record<string, unknown>): ExportCell {
  const value = column.getValue(item);
  return {
    value,
    text: cellText(column, value, item),
    type: column.dataType,
    align: column.align,
  };
}

// Formatted display text, with a readable fallback for booleans (which the grid
// renders as a checkbox glyph and so formats to '').
function cellText(column: Column, value: unknown, item: Record<string, unknown>): string {
  if (column.dataType === 'Boolean') {
    return value === true ? 'TRUE' : value === false ? 'FALSE' : '';
  }
  return column.formatValue(value, item);
}

// A group-header row: the group label in the first cell, then any per-column
// aggregates in their columns (mirrors what the grid draws on group rows).
function groupRow(group: CollectionViewGroup, level: number, columns: Column[]): ExportRow {
  const cells: ExportCell[] = columns.map((column, i) => {
    if (i === 0) {
      const indent = '  '.repeat(level);
      return {
        value: group.name,
        text: `${indent}${group.name} (${group.itemCount})`,
        type: 'String',
        align: 'left',
      };
    }
    if (column.aggregate) {
      const agg = computeAggregate(group.items, column.aggregate, (it) => column.getValue(it));
      return {
        value: agg,
        text: agg == null ? '' : column.formatValue(agg),
        type: agg == null ? 'String' : 'Number',
        align: column.align,
      };
    }
    return { value: null, text: '', type: 'String', align: column.align };
  });
  return { kind: 'group', level, cells };
}
