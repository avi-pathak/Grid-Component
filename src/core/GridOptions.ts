import { Column, ColumnDef, CellStyle } from '../models/Column';
import { ColumnGroupDef } from '../models/ColumnGroup';
import { SelectionMode } from '../selection/SelectionModel';
import { CollectionView } from '../data/CollectionView';
import { GroupHeaderTemplate } from '../rendering/GroupHeader';
import { GroupPanelOptions, ResolvedGroupPanel } from '../rendering/GroupPanel';
import { MergeManager } from '../models/MergeManager';

export type HeadersVisibility = 'None' | 'Column' | 'Row' | 'All';

/** Context passed to row-level conditional styling callbacks. */
export interface RowStyleContext<T = Record<string, unknown>> {
  item: T;
  row: number;
}

export type RowClass<T = Record<string, unknown>> =
  string | string[] | ((ctx: RowStyleContext<T>) => string | string[] | null | undefined);

export type RowStyle<T = Record<string, unknown>> =
  CellStyle | ((ctx: RowStyleContext<T>) => CellStyle | null | undefined);

export interface GridOptions<T = Record<string, unknown>> {
  columns: ColumnDef<T>[];
  itemsSource?: T[] | CollectionView<T>;
  /** Alias for `itemsSource`, kept for compatibility with the original grid. */
  dataSource?: T[] | CollectionView<T>;
  rowHeight?: number;
  headerHeight?: number;
  rowHeaderWidth?: number;
  /** Multi-level column-header groups: bands that span a run of leaf columns. */
  columnGroups?: ColumnGroupDef[];
  /** Height of the column-group header row. Defaults to `headerHeight`. */
  groupHeaderRowHeight?: number;
  /** Animate column-group headers when they collapse/expand. Default false. */
  columnGroupAnimation?: boolean;
  /** Number of leading columns kept pinned to the left while the rest scroll. Default 0. */
  frozenColumns?: number;
  /** Number of leading rows kept pinned to the top while the rest scroll. Default 0. */
  frozenRows?: number;
  selectionMode?: SelectionMode;
  headersVisibility?: HeadersVisibility;
  /** Regular rows between alternating-colored rows. 0 disables. Default 1. */
  alternatingRowStep?: number;
  /** Allow users to drag column headers to reorder them. Default true. */
  allowColumnReorder?: boolean;
  /** Allow clicking a column header to sort by it. Default true. */
  allowSorting?: boolean;
  /** Enable copy/paste shortcuts (Ctrl+C / Ctrl+V). Default false. */
  allowClipboard?: boolean;
  /** Show a filter button on each column header. Per-column `filter` overrides it. Default false. */
  allowFiltering?: boolean;
  /** Merge adjacent equal-valued cells. Per-column `allowMerging` overrides it. Default false. */
  allowMerging?: boolean;
  /** Custom rule for how cells merge. Replaces the default content-driven merge. */
  mergeManager?: MergeManager;
  /**
   * Show the grouping bar; drag column headers into it to group. `true` enables
   * everything, `false` (default) hides it, or pass an options object to switch
   * individual capabilities on and off.
   */
  groupPanel?: boolean | GroupPanelOptions;
  /** Text shown in the empty grouping bar. Also settable via `groupPanel.placeholder`. */
  groupPanelPlaceholder?: string;
  /** Maximum number of grouping levels. Default 6. Also settable via `groupPanel.maxGroups`. */
  maxGroups?: number;
  /** Custom renderer for the label on group-header rows (after the chevron). */
  groupHeaderTemplate?: GroupHeaderTemplate<T>;
  /** CSS class(es) for each data row. A function enables conditional styling. */
  rowClass?: RowClass<T>;
  /** Inline styles for each data row. A function enables conditional styling. */
  rowStyle?: RowStyle<T>;
  /** Track added/removed/edited rows on the collection view. Default false. */
  trackChanges?: boolean;
  /** Block all editing grid-wide, regardless of column/row settings. Default false. */
  isReadOnly?: boolean;
  /** Block editing for rows matching this predicate. Column `editable` still applies. */
  rowReadOnly?: (ctx: RowStyleContext<T>) => boolean;
}

export interface ResolvedOptions<T> {
  columns: Column<T>[];
  view: CollectionView<T>;
  rowHeight: number;
  headerHeight: number;
  rowHeaderWidth: number;
  columnGroups: ColumnGroupDef[];
  groupHeaderRowHeight: number;
  columnGroupAnimation: boolean;
  frozenColumns: number;
  frozenRows: number;
  selectionMode: SelectionMode;
  headersVisibility: HeadersVisibility;
  alternatingRowStep: number;
  allowColumnReorder: boolean;
  allowSorting: boolean;
  allowClipboard: boolean;
  allowFiltering: boolean;
  allowMerging: boolean;
  mergeManager?: MergeManager;
  groupPanel: boolean;
  groupPanelOptions: ResolvedGroupPanel;
  maxGroups: number;
  groupHeaderTemplate?: GroupHeaderTemplate<T>;
  rowClass?: RowClass<T>;
  rowStyle?: RowStyle<T>;
  isReadOnly: boolean;
  rowReadOnly?: (ctx: RowStyleContext<T>) => boolean;
}

const DEFAULT_ROW_HEIGHT = 24;
const DEFAULT_HEADER_HEIGHT = 28;
const DEFAULT_ROW_HEADER_WIDTH = 48;
const DEFAULT_MAX_GROUPS = 6;
const DEFAULT_GROUP_PLACEHOLDER = 'Drag a column header here to group by that column';

export function resolveOptions<T>(options: GridOptions<T>): ResolvedOptions<T> {
  const source = options.itemsSource ?? options.dataSource ?? [];
  const view = source instanceof CollectionView ? source : new CollectionView<T>(source);
  if (options.trackChanges != null) view.trackChanges = options.trackChanges;
  const groupPanelOptions = resolveGroupPanel(
    options.groupPanel,
    options.groupPanelPlaceholder ?? DEFAULT_GROUP_PLACEHOLDER,
    options.maxGroups ?? DEFAULT_MAX_GROUPS,
  );
  const allowFiltering = options.allowFiltering ?? false;
  const allowMerging = options.allowMerging ?? false;
  const columns = options.columns.map((def) => {
    const col = new Column<T>(def);
    col.filterable = def.filter ?? allowFiltering;
    col.allowMerging = def.allowMerging ?? allowMerging;
    return col;
  });
  const headerHeight = options.headerHeight ?? DEFAULT_HEADER_HEIGHT;
  return {
    columns,
    view,
    rowHeight: options.rowHeight ?? DEFAULT_ROW_HEIGHT,
    headerHeight,
    rowHeaderWidth: options.rowHeaderWidth ?? DEFAULT_ROW_HEADER_WIDTH,
    columnGroups: options.columnGroups ?? [],
    groupHeaderRowHeight: options.groupHeaderRowHeight ?? headerHeight,
    columnGroupAnimation: options.columnGroupAnimation ?? false,
    frozenColumns: Math.max(0, options.frozenColumns ?? 0),
    frozenRows: Math.max(0, options.frozenRows ?? 0),
    selectionMode: options.selectionMode ?? 'Cell',
    headersVisibility: options.headersVisibility ?? 'All',
    alternatingRowStep: options.alternatingRowStep ?? 1,
    allowColumnReorder: options.allowColumnReorder ?? true,
    allowSorting: options.allowSorting ?? true,
    allowClipboard: options.allowClipboard ?? false,
    allowFiltering,
    allowMerging,
    mergeManager: options.mergeManager,
    groupPanel: !!options.groupPanel,
    groupPanelOptions,
    maxGroups: groupPanelOptions.maxGroups,
    groupHeaderTemplate: options.groupHeaderTemplate,
    rowClass: options.rowClass,
    rowStyle: options.rowStyle,
    isReadOnly: options.isReadOnly ?? false,
    rowReadOnly: options.rowReadOnly,
  };
}

// Grouping bar toggles: an options object overrides these, `true`/`false`/absent
// fall back to defaults. Everything is on by default.
function resolveGroupPanel(
  opt: boolean | GroupPanelOptions | undefined,
  placeholder: string,
  maxGroups: number,
): ResolvedGroupPanel {
  const o: GroupPanelOptions = typeof opt === 'object' && opt != null ? opt : {};
  return {
    placeholder: o.placeholder ?? placeholder,
    maxGroups: o.maxGroups ?? maxGroups,
    allowDragToGroup: o.allowDragToGroup ?? true,
    allowReorder: o.allowReorder ?? true,
    allowSort: o.allowSort ?? true,
    allowRemove: o.allowRemove ?? true,
    contextMenu: o.contextMenu ?? true,
  };
}
