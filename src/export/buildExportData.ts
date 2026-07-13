import { Column } from '../models/Column';
import { computeAggregate } from '../data/aggregate';
import { CollectionViewGroup } from '../data/CollectionViewGroup';
import {
  ExportCell,
  ExportColumn,
  ExportData,
  ExportHeaderGroup,
  ExportOptions,
  ExportRow,
} from './types';

/** The minimal row-source the builder reads — a subset of {@link DataView}. */
export interface ExportSource {
  /** Number of display rows (data rows plus visible group headers). */
  readonly length: number;
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
}

/**
 * Turn grid columns + a row source into the format-agnostic {@link ExportData}.
 * Pure and grid-free: each cell carries its raw value, its formatted text, its
 * type, and alignment, so any writer can render it. Group-header rows (with
 * aggregates) are included when `options.includeGroups` is set and the source
 * is grouped.
 */
export function buildExportData(input: BuildExportInput, options: ExportOptions): ExportData {
  const { columns, source, selection } = input;
  const includeGroups = options.includeGroups ?? false;

  const exportColumns: ExportColumn[] = columns.map((c) => ({
    header: c.header,
    key: c.binding,
    type: c.dataType,
    align: c.align,
    width: c.width,
  }));

  const firstRow = selection ? Math.max(0, selection.topRow) : 0;
  const lastRow = selection ? Math.min(source.length - 1, selection.bottomRow) : source.length - 1;

  const rows: ExportRow[] = [];
  for (let r = firstRow; r <= lastRow; r++) {
    if (source.rowType(r) === 'group') {
      if (!includeGroups) continue;
      const gr = source.groupRow(r);
      if (gr) rows.push(groupRow(gr.group, gr.level, columns));
      continue;
    }
    const item = source.item(r);
    if (!item) continue;
    rows.push({ kind: 'data', cells: columns.map((c) => dataCell(c, item)) });
  }

  return {
    columns: exportColumns,
    rows,
    headerGroups: input.headerGroups as ExportHeaderGroup[] | undefined,
    headerRows: input.headerRows,
    title: options.title,
  };
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
