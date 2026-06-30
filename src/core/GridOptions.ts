import { Column, ColumnDef } from '../models/Column';
import { SelectionMode } from '../selection/SelectionModel';
import { CollectionView } from '../data/CollectionView';

export type HeadersVisibility = 'None' | 'Column' | 'Row' | 'All';

export interface GridOptions<T = Record<string, unknown>> {
  columns: ColumnDef<T>[];
  itemsSource?: T[] | CollectionView<T>;
  /** Alias for `itemsSource`, kept for compatibility with the original grid. */
  dataSource?: T[] | CollectionView<T>;
  rowHeight?: number;
  headerHeight?: number;
  rowHeaderWidth?: number;
  selectionMode?: SelectionMode;
  headersVisibility?: HeadersVisibility;
  /** Regular rows between alternating-colored rows. 0 disables. Default 1. */
  alternatingRowStep?: number;
  /** Allow users to drag column headers to reorder them. Default true. */
  allowColumnReorder?: boolean;
  /** Allow clicking a column header to sort by it. Default true. */
  allowSorting?: boolean;
  /** Track added/removed/edited rows on the collection view. Default false. */
  trackChanges?: boolean;
}

export interface ResolvedOptions<T> {
  columns: Column<T>[];
  view: CollectionView<T>;
  rowHeight: number;
  headerHeight: number;
  rowHeaderWidth: number;
  selectionMode: SelectionMode;
  headersVisibility: HeadersVisibility;
  alternatingRowStep: number;
  allowColumnReorder: boolean;
  allowSorting: boolean;
}

const DEFAULT_ROW_HEIGHT = 24;
const DEFAULT_HEADER_HEIGHT = 28;
const DEFAULT_ROW_HEADER_WIDTH = 48;

export function resolveOptions<T>(options: GridOptions<T>): ResolvedOptions<T> {
  const source = options.itemsSource ?? options.dataSource ?? [];
  const view = source instanceof CollectionView ? source : new CollectionView<T>(source);
  if (options.trackChanges != null) view.trackChanges = options.trackChanges;
  return {
    columns: options.columns.map((def) => new Column<T>(def)),
    view,
    rowHeight: options.rowHeight ?? DEFAULT_ROW_HEIGHT,
    headerHeight: options.headerHeight ?? DEFAULT_HEADER_HEIGHT,
    rowHeaderWidth: options.rowHeaderWidth ?? DEFAULT_ROW_HEADER_WIDTH,
    selectionMode: options.selectionMode ?? 'Cell',
    headersVisibility: options.headersVisibility ?? 'All',
    alternatingRowStep: options.alternatingRowStep ?? 1,
    allowColumnReorder: options.allowColumnReorder ?? true,
    allowSorting: options.allowSorting ?? true,
  };
}
