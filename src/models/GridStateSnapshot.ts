import { FilterCondition } from './ColumnFilter';

/** A saved column's identity, order (by position), and width. */
export interface ColumnStateSnapshot {
  binding: string;
  width: number;
}

/** One column's saved filter: selected values and/or an operator condition. */
export interface FilterStateSnapshot {
  binding: string;
  values: string[] | null;
  condition: FilterCondition | null;
}

/**
 * A serializable snapshot of everything the user can adjust: column order and
 * widths, sort, filters, grouping (and which groups are collapsed), frozen
 * rows/columns, selection, and scroll position. Produced by `grid.toJSON()` and
 * consumed by `grid.loadJSON()`.
 */
export interface GridStateSnapshot {
  version: 1;
  columns?: ColumnStateSnapshot[];
  sort?: { binding: string; ascending: boolean } | null;
  filters?: FilterStateSnapshot[];
  groups?: string[];
  collapsedGroups?: string[];
  frozen?: { columns: number; rows: number };
  selectionMode?: string;
  activeCell?: { row: number; col: number } | null;
  scroll?: { top: number; left: number };
}
