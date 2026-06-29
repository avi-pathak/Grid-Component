import { Column, ColumnDef } from '../models/Column';
import { SelectionMode } from '../selection/SelectionModel';

export type HeadersVisibility = 'None' | 'Column' | 'Row' | 'All';

export interface GridOptions<T = Record<string, unknown>> {
  columns: ColumnDef<T>[];
  itemsSource?: T[];
  /** Alias for `itemsSource`, kept for compatibility with the original grid. */
  dataSource?: T[];
  rowHeight?: number;
  headerHeight?: number;
  rowHeaderWidth?: number;
  selectionMode?: SelectionMode;
  headersVisibility?: HeadersVisibility;
  /** Regular rows between alternating-colored rows. 0 disables. Default 1 (FlexGrid). */
  alternatingRowStep?: number;
}

export interface ResolvedOptions<T> {
  columns: Column<T>[];
  items: T[];
  rowHeight: number;
  headerHeight: number;
  rowHeaderWidth: number;
  selectionMode: SelectionMode;
  headersVisibility: HeadersVisibility;
  alternatingRowStep: number;
}

const DEFAULT_ROW_HEIGHT = 24;
const DEFAULT_HEADER_HEIGHT = 28;
const DEFAULT_ROW_HEADER_WIDTH = 48;

export function resolveOptions<T>(options: GridOptions<T>): ResolvedOptions<T> {
  return {
    columns: options.columns.map((def) => new Column<T>(def)),
    items: options.itemsSource ?? options.dataSource ?? [],
    rowHeight: options.rowHeight ?? DEFAULT_ROW_HEIGHT,
    headerHeight: options.headerHeight ?? DEFAULT_HEADER_HEIGHT,
    rowHeaderWidth: options.rowHeaderWidth ?? DEFAULT_ROW_HEADER_WIDTH,
    selectionMode: options.selectionMode ?? 'Cell',
    headersVisibility: options.headersVisibility ?? 'All',
    alternatingRowStep: options.alternatingRowStep ?? 1,
  };
}
