import { GridOptions, resolveOptions } from './GridOptions';
import { GridState } from './GridState';
import { GridViewport } from './GridViewport';
import { Column, ColumnDef } from '../models/Column';
import { ColumnGroup, ColumnGroupDef, ColumnGroupNode } from '../models/ColumnGroup';
import { buildColumnGroups, buildColumnGroupLayout } from '../data/buildColumnGroups';
import { CellAddress, CellRange } from '../models/Cell';
import { DataView } from '../data/DataView';
import { CollectionView } from '../data/CollectionView';
import { SortDescription } from '../models/SortDescription';
import { PropertyGroupDescription } from '../models/GroupDescription';
import { LayoutEngine } from '../virtualization/LayoutEngine';
import { ViewportRenderer } from '../rendering/ViewportRenderer';
import { RowRenderer } from '../rendering/RowRenderer';
import { HeaderRenderer } from '../rendering/HeaderRenderer';
import { ColumnGroupRenderer } from '../rendering/ColumnGroupRenderer';
import { RowHeaderRenderer } from '../rendering/RowHeaderRenderer';
import { CellRenderer } from '../rendering/CellRenderer';
import { Renderer } from '../rendering/Renderer';
import { RenderContext } from '../rendering/RenderContext';
import { ScrollManager } from '../scrolling/ScrollManager';
import { SelectionModel, SelectionMode, GridBounds } from '../selection/SelectionModel';
import { EventBus, EventHandler } from '../events/EventBus';
import { GridEvents } from '../events/GridEvents';
import { MouseHandler } from '../events/MouseHandler';
import { KeyboardHandler, NavAction } from '../events/KeyboardHandler';
import { ColumnResizer } from '../events/ColumnResizer';
import { ColumnDragger } from '../events/ColumnDragger';
import { ClipboardHandler } from '../events/ClipboardHandler';
import { ExportManager, ExportResult } from '../export/ExportManager';
import { ExportOptions, ExportData } from '../export/types';
import { GroupPanel, GroupChip } from '../rendering/GroupPanel';
import { GroupHeaderTemplate } from '../rendering/GroupHeader';
import { FilterModel } from '../data/FilterModel';
import { FilterEditor } from '../rendering/FilterEditor';
import { EditPopup } from '../rendering/EditPopup';
import { UndoStack } from '../commands/UndoStack';
import { ResizeColumnAction } from '../commands/ResizeColumnAction';
import { EditAction } from '../commands/EditAction';
import { BatchAction } from '../commands/BatchAction';
import { MoveColumnAction, moveColumn } from '../commands/MoveColumnAction';
import { EditorManager } from '../editing/EditorManager';
import { MergeManager, contentMerge } from '../models/MergeManager';
import { GridStateSnapshot, ColumnGroupStateSnapshot } from '../models/GridStateSnapshot';
import { clamp } from '../utils/Math';

type Row = Record<string, unknown>;

// Event names whose payload carries a `cancel` flag (the "-ing"/before events).
type CancelableEvent = {
  [K in keyof GridEvents]: GridEvents[K] extends { cancel: boolean } ? K : never;
}[keyof GridEvents];

const GROUP_PANEL_HEIGHT = 40;

// Serialize a resolved column-group node back into a plain def, preserving
// nesting and collapse state. A leaf becomes its binding string (the shorthand
// form), a group becomes a def object with recursively-serialized children.
function nodeToDef(node: ColumnGroupNode): string | ColumnGroupDef {
  if (node.kind === 'leaf') return node.binding;
  return groupToDef(node);
}

function groupToDef(group: ColumnGroup): ColumnGroupDef {
  return {
    header: group.header,
    key: group.key,
    collapsed: group.collapsed,
    collapsible: group.collapsible,
    collapseTo: group.collapseTo,
    columns: group.children.map(nodeToDef),
  };
}

// Serialize a group subtree for persistence. Leaves become binding strings,
// subgroups nest recursively — so collapse state round-trips at every level.
function groupToSnapshot(group: ColumnGroup): ColumnGroupStateSnapshot {
  return {
    key: group.key,
    header: group.header,
    collapsed: group.collapsed,
    collapseTo: group.collapseTo,
    columns: group.children.map((child) =>
      child.kind === 'leaf' ? child.binding : groupToSnapshot(child),
    ),
  };
}

/**
 * The grid facade. Constructs and owns every subsystem, drives the
 * scroll/resize render loop, and exposes the public API.
 */
export class Grid {
  private host: HTMLElement;
  private state = new GridState();
  private data: DataView;
  /** The authored columns in stable order, including any currently hidden by a collapsed group. */
  private allColumns: Column[];
  /** The visible columns (`allColumns` minus hidden). Everything indexed by column reads this. */
  private columns: Column[];
  private rowHeight: number;
  private headerHeight: number;
  private showRowHeader: boolean;

  private layout: LayoutEngine;
  private viewport: GridViewport;
  private viewportRenderer: ViewportRenderer;
  private rowRenderer: RowRenderer;
  private headerRenderer: HeaderRenderer;
  private columnGroupRenderer?: ColumnGroupRenderer;
  private rowHeaderRenderer: RowHeaderRenderer;
  private renderer: Renderer;
  private scroll: ScrollManager;
  private resizeObserver?: ResizeObserver;

  private selectionModel = new SelectionModel();
  private events = new EventBus<GridEvents>();
  private mouse: MouseHandler;
  private keyboard: KeyboardHandler;
  private resizer: ColumnResizer;
  private dragger?: ColumnDragger;
  private clipboard?: ClipboardHandler;
  private exportManager: ExportManager;
  private groupPanel?: GroupPanel;
  private groupHeaderTemplate?: GroupHeaderTemplate;
  /** Active multi-level column-header groups, in authored order. Empty when none. */
  private columnGroupList: ColumnGroup[] = [];
  /** Number of header rows the group band shows (deepest group nesting). */
  private columnGroupDepth = 0;
  /** Height of the group-header row (only shown when there are column groups). */
  private groupHeaderRowHeight: number;
  private rowClass?: RenderContext['rowClass'];
  private rowStyle?: RenderContext['rowStyle'];
  private rowReadOnlyFn?: (ctx: { item: Row; row: number }) => boolean;
  private _isReadOnly = false;
  private alwaysEdit = false;
  private highlightEdits = false;
  /** Per-item snapshot of a binding's value the first time it's edited, keyed by item reference. */
  private editSnapshots = new WeakMap<Row, Record<string, unknown>>();
  // Set by the onEnding closure just before EditorManager.commit() consults
  // stayOpenOnReject — both calls happen synchronously within the same commit.
  private pendingStayInEditMode = false;
  private pendingErrorMessage: string | undefined;
  private mergeManager?: MergeManager;
  private anyMergeable = false;
  private filterModel?: FilterModel;
  private filterEditor?: FilterEditor;
  private editPopup?: EditPopup;
  private popupEditors = false;
  private maxGroups: number;
  private allowSorting: boolean;
  private headerDownX = -1;
  private undoStack = new UndoStack();
  private editor: EditorManager;
  private unsubscribeData: () => void = () => {};

  constructor(host: string | HTMLElement, options: GridOptions) {
    const el = typeof host === 'string' ? document.querySelector<HTMLElement>(host) : host;
    if (!el) throw new Error(`apgrid: host element not found for "${String(host)}"`);
    this.host = el;

    const resolved = resolveOptions(options);
    this.allColumns = resolved.columns;
    this.columnGroupList = buildColumnGroups(this.allColumns, resolved.columnGroups);
    this.columns = this.syncHiddenColumns();
    this.data = new DataView(resolved.view);
    this.rowHeight = resolved.rowHeight;
    this.headerHeight = resolved.headerHeight;
    this.groupHeaderRowHeight = resolved.groupHeaderRowHeight;
    this.maxGroups = resolved.maxGroups;
    this.groupHeaderTemplate = resolved.groupHeaderTemplate;
    this.rowClass = resolved.rowClass;
    this.rowStyle = resolved.rowStyle;
    this.rowReadOnlyFn = resolved.rowReadOnly;
    this._isReadOnly = resolved.isReadOnly;
    this.alwaysEdit = resolved.alwaysEdit;
    this.highlightEdits = resolved.highlightEdits;
    this.popupEditors = resolved.popupEditors;
    this.mergeManager = resolved.mergeManager;
    this.anyMergeable = this.allColumns.some((c) => c.allowMerging);
    this.selectionModel = new SelectionModel(resolved.selectionMode);
    this.state.alternatingRowStep = resolved.alternatingRowStep;
    this.state.frozenCols = resolved.frozenColumns;
    this.state.frozenRows = resolved.frozenRows;

    const showColumnHeader =
      resolved.headersVisibility === 'All' || resolved.headersVisibility === 'Column';
    this.showRowHeader =
      resolved.headersVisibility === 'All' || resolved.headersVisibility === 'Row';
    const hasColumnGroups = this.columnGroupList.length > 0;
    // Header depth (rows) is fixed by the authored tree — collapsing hides
    // columns but never changes how many header rows the band shows.
    this.columnGroupDepth = this.columnGroupList.reduce((m, g) => Math.max(m, g.depth()), 0);

    this.host.style.setProperty('--apg-row-height', `${this.rowHeight}px`);
    this.host.style.setProperty('--apg-header-height', `${this.headerHeight}px`);
    this.host.style.setProperty('--apg-group-header-height', `${this.groupHeaderRowHeight}px`);
    if (resolved.columnGroupAnimation) this.host.classList.add('apg-animated');
    this.host.tabIndex = 0;

    this.layout = new LayoutEngine(this.data.length, this.rowHeight, this.columns);
    this.viewport = new GridViewport(this.state, this.layout);

    this.viewportRenderer = new ViewportRenderer(this.host, {
      showColumnHeader,
      showRowHeader: this.showRowHeader,
      headerHeight: this.headerHeight,
      rowHeaderWidth: resolved.rowHeaderWidth,
      showGroupPanel: resolved.groupPanel,
      groupPanelHeight: GROUP_PANEL_HEIGHT,
      // The band is as tall as the deepest group nesting requires.
      columnGroupHeight: this.columnGroupDepth * this.groupHeaderRowHeight,
    });
    this.rowRenderer = new RowRenderer(this.viewportRenderer.cells, new CellRenderer());
    this.headerRenderer = new HeaderRenderer(this.viewportRenderer.headerInner);
    if (hasColumnGroups && this.viewportRenderer.columnGroupInner) {
      this.columnGroupRenderer = new ColumnGroupRenderer(
        this.viewportRenderer.columnGroupInner,
        (key) => this.toggleColumnGroup(key),
        this.groupHeaderRowHeight,
      );
    }
    this.rowHeaderRenderer = new RowHeaderRenderer(this.viewportRenderer.rowHeaderInner);
    this.renderer = new Renderer(
      this.viewportRenderer,
      this.rowRenderer,
      this.headerRenderer,
      this.rowHeaderRenderer,
      this.showRowHeader,
      this.columnGroupRenderer,
    );

    this.scroll = new ScrollManager(this.viewportRenderer.viewport, () => this.onScroll());
    this.mouse = new MouseHandler(
      this.viewportRenderer.viewport,
      this.layout,
      (cell, extend, isPress) => this.onSelect(cell, extend, isPress),
      (cell) => this.onDoubleClick(cell),
      this.viewportRenderer.gutterLeft,
      this.viewportRenderer.gutterTop,
    );
    this.keyboard = new KeyboardHandler(
      this.host,
      (action, extend) => this.onNav(action, extend),
      (action) => (action === 'undo' ? this.undo() : this.redo()),
      () => this.onActivate(),
      (key) => this.onType(key),
    );
    this.resizer = new ColumnResizer(
      this.viewportRenderer.headerInner,
      this.layout,
      () => this.columns,
      () => this.refresh(),
      (col, width) => this.resizeColumn(col, width),
    );
    if (this.viewportRenderer.groupPanel) {
      this.groupPanel = new GroupPanel(
        this.viewportRenderer.groupPanel,
        {
          chips: () => this.groupChips(),
          onRemove: (b) => this.removeGroup(b),
          onReorder: (from, to) => this.moveGroup(from, to),
          onToggleSort: (b) => this.sort(b),
          onSort: (b, dir) => this.sort(b, dir),
          onExpandAll: () => this.expandAllGroups(),
          onCollapseAll: () => this.collapseAllGroups(),
        },
        resolved.groupPanelOptions,
      );
    }
    // The header dragger also handles dropping a column onto the group bar, so
    // build it when either column reordering or drag-to-group is enabled, and
    // gate each behavior on its own flag.
    const dragToGroup = this.groupPanel != null && resolved.groupPanelOptions.allowDragToGroup;
    if (resolved.allowColumnReorder || dragToGroup) {
      const panel = this.groupPanel;
      this.dragger = new ColumnDragger(
        this.viewportRenderer.headerInner,
        this.layout,
        () => this.columns,
        resolved.allowColumnReorder ? (from, to) => this.moveColumn(from, to) : () => {},
        dragToGroup ? () => panel!.hostElement.getBoundingClientRect() : undefined,
        dragToGroup ? (col) => this.addGroup(this.columns[col]?.binding ?? '') : undefined,
        dragToGroup ? (active) => panel!.highlight(active) : undefined,
      );
    }
    this.allowSorting = resolved.allowSorting;
    const header = this.viewportRenderer.headerInner;
    header.addEventListener('mousedown', this.onHeaderMouseDown);
    header.addEventListener('click', this.onHeaderClick);

    if (this.columns.some((c) => c.filterable)) {
      this.filterModel = new FilterModel(this.data.collectionView);
      this.filterEditor = new FilterEditor();
    }

    if (this.popupEditors) {
      this.editPopup = new EditPopup();
      this.viewportRenderer.rowHeaderInner.addEventListener('click', this.onRowHeaderClick);
    }

    this.editor = new EditorManager({
      cells: this.viewportRenderer.cells,
      layout: this.layout,
      scrollTop: () => this.viewportRenderer.viewport.scrollTop,
      data: this.data,
      columns: this.columns,
      undo: this.undoStack,
      isReadOnly: () => this._isReadOnly,
      isRowReadOnly: (row) => this.rowReadOnlyFn?.({ item: this.data.item(row), row }) ?? false,
      showPlaceholders: resolved.showPlaceholders,
      onApplied: () => this.draw(),
      onBeginning: (cell) => {
        if (this.emitCancel('beginningEdit', { row: cell.row, col: cell.col })) return false;
        if (this.highlightEdits) this.captureEditSnapshot(cell);
        return true;
      },
      onStart: (cell) => {
        this.events.emit('cellEditStart', cell);
        this.events.emit('cellEditPreparing', {
          row: cell.row,
          col: cell.col,
          column: this.columns[cell.col],
        });
      },
      onEnding: (cell, value) => {
        const e: GridEvents['cellEditEnding'] = {
          row: cell.row,
          col: cell.col,
          value,
          cancel: false,
        };
        this.events.emit('cellEditEnding', e);
        this.pendingStayInEditMode = e.cancel && !!e.stayInEditMode;
        this.pendingErrorMessage = e.errorMessage;
        return !e.cancel;
      },
      stayOpenOnReject: () => this.pendingStayInEditMode,
      rejectMessage: () => this.pendingErrorMessage,
      getError: resolved.getError,
      onEnded: (cell, value) =>
        this.events.emit('cellEditEnded', { row: cell.row, col: cell.col, value }),
      onEnd: (cell) => this.events.emit('cellEditEnd', cell),
      onMove: (direction) => {
        this.onNav(direction, false);
        // At the first/last row or column the move clamps to the same cell, so
        // applyMove bails out before re-opening the editor. Restore always-edit's
        // invariant here instead of leaving the cell stranded out of edit mode.
        const active = this.selectionModel.getActive();
        if (this.alwaysEdit && active && !this.editor.isEditing) {
          this.editor.begin(active, { mode: 'quick' });
        }
      },
      restoreFocus: () => this.host.focus(),
    });
    this.undoStack.onStateChanged = () =>
      this.events.emit('undoStackChanged', { canUndo: this.canUndo, canRedo: this.canRedo });

    if (resolved.allowClipboard) {
      this.clipboard = new ClipboardHandler(this.host, {
        isEditing: () => this.editor.isEditing,
        getClip: () => this.copyForClipboard(),
        applyClip: (text) => this.setClipString(text),
      });
    }

    this.exportManager = new ExportManager({
      columns: () => this.columns,
      source: () => this.data,
      fullSource: () => this.fullExportSource(),
      selection: () => this.selection,
      headerGroups: () => this.exportHeaderGroups(),
      merge: () => this.mergeLookup(),
      filterable: () => this.filterModel != null,
      activeFilters: () => this.activeExportFilters(),
      host: () => this.host,
      onExporting: (opts) =>
        !this.emitCancel('exporting', {
          format: opts.format ?? 'csv',
          fileName: `${opts.fileName ?? 'export'}.${opts.format ?? 'csv'}`,
        }),
      onExported: (opts) =>
        this.events.emit('exported', {
          format: opts.format ?? 'csv',
          fileName: `${opts.fileName ?? 'export'}.${opts.format ?? 'csv'}`,
        }),
    });

    this.unsubscribeData = this.data.collectionView.on('collectionChanged', (e) => {
      // Edits keep the same rows, so only redraw; add/remove/reset change totals.
      if (e.action === 'change') this.draw();
      else this.refresh();
      this.events.emit('collectionChanged', { action: e.action });
    });

    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => this.measure());
      this.resizeObserver.observe(this.host);
    }

    this.syncViewportSize();
    this.refresh();
  }

  /** Subscribe to a grid event. Returns a function that removes the handler. */
  on<K extends keyof GridEvents>(type: K, handler: EventHandler<GridEvents[K]>): () => void {
    return this.events.on(type, handler);
  }

  /** The collection view behind the grid. Use it to read tracked changes or add/remove rows. */
  get collectionView(): CollectionView {
    return this.data.collectionView;
  }

  /** The active (current) cell, or null when nothing is selected. */
  get selectedCell(): CellAddress | null {
    return this.selectionModel.getActive();
  }

  /** The highlighted rectangle for the current selection mode, or null. */
  get selection(): CellRange | null {
    return this.selectionModel.getRange(this.bounds());
  }

  get selectionMode(): SelectionMode {
    return this.selectionModel.getMode();
  }

  set selectionMode(mode: SelectionMode) {
    if (!this.selectionModel.setMode(mode)) return;
    this.syncSelectionState();
    this.draw();
    this.events.emit('selectionChanged', this.selectionModel.getActive());
  }

  /** Blocks all editing grid-wide when true, regardless of column/row settings. */
  get isReadOnly(): boolean {
    return this._isReadOnly;
  }

  set isReadOnly(value: boolean) {
    this._isReadOnly = value;
  }

  select(row: number, col: number, extend = false): void {
    if (this.selectionModel.getMode() === 'None') return;
    const cell = {
      row: clamp(row, 0, this.layout.rowCount - 1),
      col: clamp(col, 0, this.layout.colCount - 1),
    };
    this.applyMove(cell, extend);
    this.scrollIntoView(cell);
  }

  /** Recompute totals and redraw. Call after the data or columns change. */
  refresh(): void {
    this.data.refreshGroups();
    // Re-derive visible columns from the authored list in case group membership
    // or the authored order changed since the last refresh.
    this.columns = this.syncHiddenColumns();
    this.layout.setColumns(this.columns);
    this.layout.setRowCount(this.data.length);
    this.renderer.resize(this.context());
    this.syncFrozen();
    this.draw();
  }

  /** Redraw the current window without recomputing totals. */
  invalidate(): void {
    this.draw();
  }

  /** Number of columns pinned to the left. */
  get frozenColumns(): number {
    return this.state.frozenCols;
  }

  /** Number of rows pinned to the top. */
  get frozenRows(): number {
    return this.state.frozenRows;
  }

  /** Pin the first `count` columns to the left. Pass 0 to unfreeze. */
  freezeColumns(count: number): void {
    const c = clamp(Math.floor(count), 0, this.layout.colCount);
    if (c === this.state.frozenCols) return;
    if (this.emitCancel('freezingColumns', { count: c })) return;
    this.state.frozenCols = c;
    this.syncFrozen();
    this.draw();
    this.events.emit('frozenColumnsChanged', { count: c });
  }

  /** Pin the first `count` rows to the top. Pass 0 to unfreeze. */
  freezeRows(count: number): void {
    const c = clamp(Math.floor(count), 0, this.layout.rowCount);
    if (c === this.state.frozenRows) return;
    if (this.emitCancel('freezingRows', { count: c })) return;
    this.state.frozenRows = c;
    this.syncFrozen();
    this.draw();
    this.events.emit('frozenRowsChanged', { count: c });
  }

  // Clamp the freeze counts to the current grid size and size the pinned panels.
  private syncFrozen(): void {
    const cols = clamp(this.state.frozenCols, 0, this.layout.colCount);
    const rows = clamp(this.state.frozenRows, 0, this.layout.rowCount);
    this.state.frozenCols = cols;
    this.state.frozenRows = rows;
    this.viewportRenderer.setFrozen(
      this.layout.frozenColsWidth(cols),
      this.layout.frozenRowsHeight(rows),
    );
  }

  /** Capture the current column layout, sort, filters, grouping, freeze, selection, and scroll. */
  toJSON(): GridStateSnapshot {
    const active = this.selectionModel.getActive();
    return {
      version: 1,
      // Persist the full authored order/width, including columns currently hidden
      // by a collapsed group, so restore round-trips even while collapsed.
      columns: this.allColumns.map((c) => ({ binding: c.binding, width: c.width })),
      sort: this.state.sort
        ? {
            binding: this.columns[this.state.sort.col].binding,
            ascending: this.state.sort.ascending,
          }
        : null,
      filters: this.filterModel
        ? this.allColumns
            .map((c) => this.filterModel!.get(c))
            .filter((f) => f.isActive)
            .map((f) => ({
              binding: f.column.binding,
              values: f.values ? [...f.values] : null,
              condition: f.condition ? { ...f.condition } : null,
            }))
        : [],
      groups: this.groupDescriptions.map((g) => g.property),
      collapsedGroups: this.data.collapsedGroups(),
      columnGroups: this.columnGroupList.map((g) => groupToSnapshot(g)),
      frozen: { columns: this.state.frozenCols, rows: this.state.frozenRows },
      selectionMode: this.selectionModel.getMode(),
      activeCell: active ? { row: active.row, col: active.col } : null,
      scroll: {
        top: this.viewportRenderer.viewport.scrollTop,
        left: this.viewportRenderer.viewport.scrollLeft,
      },
    };
  }

  /** Restore a snapshot from {@link toJSON}. Unknown bindings are ignored. */
  loadJSON(snapshot: GridStateSnapshot): void {
    if (!snapshot || snapshot.version !== 1) return;

    if (snapshot.columns) this.applyColumnState(snapshot.columns);

    // Restore column groups (and their collapse state) after the column order is
    // settled, so membership resolves against the final bindings. The snapshot
    // tree is structurally a ColumnGroupDef tree, so it feeds the resolver
    // directly.
    if (snapshot.columnGroups) {
      this.columnGroupList = buildColumnGroups(
        this.allColumns,
        snapshot.columnGroups as ColumnGroupDef[],
      );
      this.columnGroupDepth = this.columnGroupList.reduce((m, g) => Math.max(m, g.depth()), 0);
      this.columns = this.syncHiddenColumns();
    }

    // Grouping first, then filters and sort, so the collapse keys line up.
    if (snapshot.groups) this.groupBy(...snapshot.groups);

    if (this.filterModel) {
      for (const c of this.allColumns) this.filterModel.get(c).clear();
      for (const f of snapshot.filters ?? []) {
        const column = this.allColumns.find((c) => c.binding === f.binding);
        if (!column) continue;
        const cf = this.filterModel.get(column);
        cf.values = f.values ? new Set(f.values) : null;
        cf.condition = f.condition ? { ...f.condition } : null;
      }
      this.filterModel.apply();
      this.syncActiveFilters();
    }

    if (snapshot.sort === null) this.clearSort();
    else if (snapshot.sort) this.sort(snapshot.sort.binding, snapshot.sort.ascending);

    if (snapshot.frozen) {
      this.freezeColumns(snapshot.frozen.columns);
      this.freezeRows(snapshot.frozen.rows);
    }

    this.refresh();

    if (snapshot.collapsedGroups) this.data.setCollapsedGroups(snapshot.collapsedGroups);

    if (snapshot.selectionMode) this.selectionMode = snapshot.selectionMode as SelectionMode;
    if (snapshot.activeCell) this.select(snapshot.activeCell.row, snapshot.activeCell.col);

    this.refresh();

    if (snapshot.scroll) {
      this.viewportRenderer.viewport.scrollTop = snapshot.scroll.top;
      this.viewportRenderer.viewport.scrollLeft = snapshot.scroll.left;
      this.draw();
    }
  }

  // Reorder columns to match the saved bindings and restore their widths. Any
  // columns missing from the snapshot keep their current relative order at the end.
  private applyColumnState(saved: { binding: string; width: number }[]): void {
    const byBinding = new Map(this.allColumns.map((c) => [c.binding, c]));
    const ordered: Column[] = [];
    for (const s of saved) {
      const col = byBinding.get(s.binding);
      if (!col) continue;
      col.width = s.width;
      ordered.push(col);
      byBinding.delete(s.binding);
    }
    for (const col of this.allColumns) if (byBinding.has(col.binding)) ordered.push(col);
    this.allColumns = ordered;
    this.columns = this.syncHiddenColumns();
  }

  setData(items: Row[]): void {
    this.data.setItems(items);
    this.refresh();
  }

  addColumn(def: ColumnDef, index?: number): void {
    const col = new Column(def);
    // `index` is a visible-column position; translate it to the authored array.
    if (index == null) this.allColumns.push(col);
    else {
      const at = this.toAllColumnsIndex(index);
      this.allColumns.splice(at < 0 ? this.allColumns.length : at, 0, col);
    }
    this.refresh();
  }

  removeColumn(index: number): void {
    const at = this.toAllColumnsIndex(index);
    if (at < 0) return;
    this.allColumns.splice(at, 1);
    this.refresh();
  }

  scrollTo(row: number, col?: number): void {
    const vp = this.viewportRenderer.viewport;
    vp.scrollTop = this.layout.getRowTop(row);
    if (col != null) vp.scrollLeft = this.layout.getColLeft(col);
    this.onScroll();
  }

  get canUndo(): boolean {
    return this.undoStack.canUndo;
  }

  get canRedo(): boolean {
    return this.undoStack.canRedo;
  }

  undo(): void {
    this.undoStack.undo();
  }

  redo(): void {
    this.undoStack.redo();
  }

  /** Begin editing a cell (no-op if the column isn't editable or the row is a group). */
  editCell(row: number, col: number): void {
    if (this.data.rowType(row) === 'group') return;
    this.editor.begin({ row, col });
  }

  /** Set a cell's value programmatically. Recorded on the undo stack. */
  setCellValue(row: number, col: number, value: unknown): void {
    const column = this.columns[col];
    if (!column || !column.editable) return;
    const item = this.data.item(row);
    if (item == null) return;
    const oldValue = column.getValue(item);
    if (value === oldValue) return;
    this.undoStack.push(new EditAction(this.data, column, row, oldValue, value, () => this.draw()));
    this.data.applyEdit(item, () => column.setValue(item, value));
    this.draw();
  }

  /**
   * Get a range of cells as tab-delimited text (rows separated by newlines),
   * suitable for the clipboard or a spreadsheet. Defaults to the current selection.
   */
  getClipString(range?: CellRange): string {
    const rng = range ?? this.selection;
    if (!rng) return '';
    const lines: string[] = [];
    for (let row = rng.topRow; row <= rng.bottomRow; row++) {
      if (this.data.rowType(row) === 'group') continue;
      const item = this.data.item(row) as Row;
      const cells: string[] = [];
      for (let col = rng.leftCol; col <= rng.rightCol; col++) {
        cells.push(item ? this.columns[col].format(item) : '');
      }
      lines.push(cells.join('\t'));
    }
    return lines.join('\n');
  }

  /**
   * Parse tab-delimited text and write it into the grid starting at the top-left
   * of `range` (defaults to the active cell). Read-only and calculated cells are
   * skipped. The whole paste is a single undo step.
   */
  setClipString(text: string, range?: CellRange): void {
    const anchor = range ?? this.selection;
    if (!anchor) return;

    const pasting = { text, cancel: false };
    this.events.emit('pasting', pasting);
    if (pasting.cancel) return;

    const grid = this.parseClip(text);
    const startRow = anchor.topRow;
    const startCol = anchor.leftCol;
    const edits: EditAction[] = [];
    let lastRow = startRow;
    let lastCol = startCol;

    for (let r = 0; r < grid.length; r++) {
      const row = startRow + r;
      if (row >= this.layout.rowCount) break;
      const item = this.data.item(row) as Row;
      if (item == null) continue;
      for (let c = 0; c < grid[r].length; c++) {
        const col = startCol + c;
        if (col >= this.layout.colCount) break;
        const column = this.columns[col];
        if (!column.editable || column.isCalculated) continue;
        const newValue = column.parse(grid[r][c]);
        const oldValue = column.getValue(item);
        if (newValue === oldValue) continue;
        edits.push(new EditAction(this.data, column, row, oldValue, newValue, () => {}));
        lastRow = Math.max(lastRow, row);
        lastCol = Math.max(lastCol, col);
      }
    }

    if (!edits.length) return;
    const batch = new BatchAction(edits, () => this.draw());
    this.undoStack.push(batch);
    batch.redo(); // apply all edits and redraw once

    const range2: CellRange = {
      topRow: startRow,
      leftCol: startCol,
      bottomRow: lastRow,
      rightCol: lastCol,
    };
    this.events.emit('pasted', { range: range2 });
  }

  // Build the clipboard string for the current selection, honoring the cancelable
  // copying/copied events. Returns null when there is nothing to copy.
  private copyForClipboard(): string | null {
    const range = this.selection;
    if (!range) return null;
    const copying = { range, cancel: false };
    this.events.emit('copying', copying);
    if (copying.cancel) return null;
    const text = this.getClipString(range);
    this.events.emit('copied', { range });
    return text;
  }

  // Split pasted text into a grid of cells. Handles CRLF and a single trailing
  // newline (spreadsheets usually add one).
  private parseClip(text: string): string[][] {
    const trimmed = text.replace(/\r\n/g, '\n').replace(/\n$/, '');
    return trimmed.split('\n').map((line) => line.split('\t'));
  }

  /**
   * Export the grid to a file. `options.format` selects the output
   * ('csv' | 'xlsx' | 'pdf', default 'csv'); other options control the file
   * name, whether to export all rows or just the selection, which columns to
   * include, group-header inclusion, and whether to download. Returns the
   * artifact + metadata, or null if the `exporting` event was canceled.
   */
  export(options?: ExportOptions): ExportResult | null {
    return this.exportManager.export(options);
  }

  /**
   * Export asynchronously: rows are built in chunks that yield to the event
   * loop so the page stays responsive on large datasets. Reports progress via
   * `options.onProgress`, shows the built-in overlay when
   * `options.showProgress` is true, and honors `options.signal` for
   * cancellation. Resolves to the artifact (or null if canceled).
   */
  exportAsync(options?: ExportOptions): Promise<ExportResult | null> {
    return this.exportManager.exportAsync(options);
  }

  /** Build the format-agnostic export payload without rendering or downloading. */
  exportData(options?: ExportOptions): ExportData {
    return this.exportManager.buildData(options);
  }

  /** Register a custom export format (id + extension + mime + render). */
  registerExportFormat = (...args: Parameters<ExportManager['registerFormat']>): void =>
    this.exportManager.registerFormat(...args);

  /**
   * An export source over the FULL, unfiltered, ungrouped data — every row of
   * the collection view's source array. Used when exporting a native Excel
   * AutoFilter so the file holds all rows for Excel to filter.
   */
  private fullExportSource(): {
    length: number;
    grouped: boolean;
    item(i: number): Record<string, unknown> | undefined;
    rowType(): 'group' | 'data';
    groupRow(): null;
  } {
    const items = this.data.collectionView.sourceCollection as Record<string, unknown>[];
    return {
      length: items.length,
      grouped: false,
      item: (i) => items[i],
      rowType: () => 'data',
      groupRow: () => null,
    };
  }

  /**
   * Active value-based column filters as `{ binding, values }`, for the exported
   * AutoFilter. Only checkbox (value-set) filters are carried; operator/condition
   * filters are omitted (Excel would need custom-filter encoding).
   */
  private activeExportFilters(): { binding: string; values: string[] }[] {
    if (!this.filterModel) return [];
    const out: { binding: string; values: string[] }[] = [];
    for (const c of this.allColumns) {
      const f = this.filterModel.get(c);
      if (f.isActive && f.values && f.values.size > 0) {
        out.push({ binding: c.binding, values: [...f.values] });
      }
    }
    return out;
  }

  /** Resolve the current column-group bands into export header spans. */
  private exportHeaderGroups(): {
    spans: {
      header: string;
      startCol: number;
      endCol: number;
      row: number;
      rowSpan: number;
    }[];
    rows: number;
  } {
    if (this.columnGroupList.length === 0) return { spans: [], rows: 0 };
    const layout = buildColumnGroupLayout(this.columns, this.columnGroupList);
    const spans = layout.cells
      .filter((c) => c.group != null)
      .map((c) => ({
        header: c.group!.header,
        startCol: c.startCol,
        endCol: c.endCol,
        row: c.row,
        rowSpan: c.rowSpan,
      }));
    return { spans, rows: layout.rows };
  }

  /** Resize a column. Recorded on the undo stack. */
  resizeColumn(index: number, width: number): void {
    const column = this.columns[index];
    if (!column || column.width === width) return;
    if (this.emitCancel('resizingColumn', { col: index, width })) return;
    this.undoStack.push(new ResizeColumnAction(column, column.width, width, () => this.refresh()));
    column.width = width;
    this.refresh();
    this.events.emit('resizedColumn', { col: index, width });
  }

  /** Move a column to a new index. Recorded on the undo stack. */
  moveColumn(from: number, to: number): void {
    const last = this.columns.length - 1;
    if (from === to || from < 0 || from > last || to < 0 || to > last) return;
    if (this.emitCancel('columnReordering', { from, to })) return;
    // Translate the visible from/to into positions in the authored array, which
    // is what actually reorders (refresh re-derives the visible list from it).
    const fromAll = this.toAllColumnsIndex(from);
    const toAll = this.toAllColumnsIndex(to);
    if (fromAll < 0 || toAll < 0) return;
    this.undoStack.push(
      new MoveColumnAction(this.allColumns, fromAll, toAll, () => this.refresh()),
    );
    moveColumn(this.allColumns, fromAll, toAll);
    this.refresh();
    this.events.emit('columnReordered', { from, to });
  }

  // Map a visible-column index to its position in the authored `allColumns`
  // array. Returns -1 when out of range. With no hidden columns the two spaces
  // coincide, so this is the identity in the common case.
  private toAllColumnsIndex(visibleIndex: number): number {
    const col = this.columns[visibleIndex];
    if (!col) return -1;
    return this.allColumns.indexOf(col);
  }

  /** Sort by a column's binding. Omit `ascending` to toggle, or pass null to clear. */
  sort(binding: string, ascending?: boolean | null): void {
    const col = this.columns.findIndex((c) => c.binding === binding);
    if (col >= 0) this.sortByColumn(col, ascending);
  }

  // Cycle a column's sort: unsorted -> ascending -> descending -> unsorted.
  private sortByColumn(col: number, ascending?: boolean | null): void {
    const column = this.columns[col];
    if (!column || !column.binding || column.isCalculated) return;

    // Resolve the target direction (null = clear) before announcing it.
    let target: boolean | null;
    if (ascending === null) {
      target = null;
    } else if (ascending != null) {
      target = ascending;
    } else {
      const cur = this.state.sort;
      if (cur && cur.col === col) target = cur.ascending ? false : null;
      else target = true;
    }

    if (this.emitCancel('sortingColumn', { col, binding: column.binding, ascending: target })) {
      return;
    }

    if (target === null) {
      this.clearSort();
    } else {
      this.state.sort = { col, ascending: target };
      this.data.collectionView.sortConverter = this.sortConverter;
      this.data.collectionView.sortDescriptions = [new SortDescription(column.binding, target)];
      this.groupPanel?.render();
    }
    this.events.emit('sortedColumn', { col, binding: column.binding, ascending: target });
  }

  private clearSort(): void {
    this.state.sort = null;
    this.data.collectionView.sortDescriptions = [];
    this.groupPanel?.render();
  }

  /** Remove every column filter and show all rows. */
  clearFilters(): void {
    if (!this.filterModel) return;
    this.filterModel.clearAll();
    this.syncActiveFilters();
    this.refresh();
    this.events.emit('filterChanged', { activeBindings: [] });
  }

  // Open the filter popup for a column, anchored to its header filter button.
  private openFilter(col: number, anchor: DOMRect): void {
    const column = this.columns[col];
    if (!this.filterModel || !this.filterEditor || !column?.filterable) return;
    const filter = this.filterModel.get(column);
    const cur = this.state.sort;
    this.filterEditor.open(anchor, {
      column,
      values: this.filterModel.distinctValues(column),
      filter,
      showSort: this.allowSorting && !!column.binding && !column.isCalculated,
      sort: cur && cur.col === col ? (cur.ascending ? 'asc' : 'desc') : null,
      onSort: (dir) => this.sortByColumn(col, dir),
      onApply: (draft) => {
        if (this.emitCancel('filtering', { binding: column.binding })) return;
        filter.values = draft.values;
        filter.condition = draft.condition;
        this.filterModel!.apply();
        this.afterFilterChanged();
      },
      onClear: () => {
        if (this.emitCancel('filtering', { binding: column.binding })) return;
        filter.clear();
        this.filterModel!.apply();
        this.afterFilterChanged();
      },
    });
  }

  private afterFilterChanged(): void {
    this.syncActiveFilters();
    this.refresh();
    this.events.emit('filterChanged', {
      activeBindings: this.columns
        .filter((c) => this.filterModel!.isActive(c.binding))
        .map((c) => c.binding),
    });
  }

  // Rebuild the set of column indices that show an active filter glyph.
  private syncActiveFilters(): void {
    const active = new Set<number>();
    if (this.filterModel) {
      this.columns.forEach((c, i) => {
        if (c.filterable && this.filterModel!.isActive(c.binding)) active.add(i);
      });
    }
    this.state.activeFilters = active;
  }

  // Sort data-mapped columns by their display text rather than the raw key.
  private readonly sortConverter = (sd: SortDescription, _item: Row, value: unknown): unknown => {
    const column = this.columns.find((c) => c.binding === sd.property);
    if (column?.dataMap?.sortByDisplayValues) return column.dataMap.getDisplayValue(value);
    return value;
  };

  /** The current group-by column bindings, outermost first. */
  get groupDescriptions(): PropertyGroupDescription[] {
    return this.data.collectionView.groupDescriptions;
  }

  /** Replace the grouping with the given column bindings (outermost first). */
  groupBy(...bindings: string[]): void {
    const descs = bindings
      .filter((b) => this.canGroupBy(b))
      .slice(0, this.maxGroups)
      .map((b) => new PropertyGroupDescription(b));
    this.data.collectionView.groupDescriptions = descs;
    this.afterGroupsChanged();
  }

  /** Add one more grouping level. Ignores duplicates, calculated columns, and the max. */
  addGroup(binding: string): void {
    const cv = this.data.collectionView;
    if (!this.canGroupBy(binding)) return;
    if (cv.groupDescriptions.some((g) => g.property === binding)) return;
    if (cv.groupDescriptions.length >= this.maxGroups) return;
    cv.groupDescriptions = [...cv.groupDescriptions, new PropertyGroupDescription(binding)];
    this.afterGroupsChanged();
  }

  /** Remove the grouping level for a column. */
  removeGroup(binding: string): void {
    const cv = this.data.collectionView;
    const next = cv.groupDescriptions.filter((g) => g.property !== binding);
    if (next.length === cv.groupDescriptions.length) return;
    cv.groupDescriptions = next;
    this.afterGroupsChanged();
  }

  /** Remove all grouping. */
  clearGroups(): void {
    const cv = this.data.collectionView;
    if (cv.groupDescriptions.length === 0) return;
    cv.groupDescriptions = [];
    this.afterGroupsChanged();
  }

  collapseAllGroups(): void {
    this.data.collapseAllGroups();
    this.refreshRows();
  }

  expandAllGroups(): void {
    this.data.expandAllGroups();
    this.refreshRows();
  }

  private canGroupBy(binding: string): boolean {
    const col = this.columns.find((c) => c.binding === binding);
    return !!binding && !!col && !col.isCalculated;
  }

  private moveGroup(from: number, to: number): void {
    const cv = this.data.collectionView;
    const arr = [...cv.groupDescriptions];
    if (from < 0 || from >= arr.length || to < 0 || to >= arr.length) return;
    const [moved] = arr.splice(from, 1);
    arr.splice(to, 0, moved);
    cv.groupDescriptions = arr;
    this.afterGroupsChanged();
  }

  private afterGroupsChanged(): void {
    this.groupPanel?.render();
    this.events.emit('groupsChanged', {
      bindings: this.data.collectionView.groupDescriptions.map((g) => g.property),
    });
  }

  private groupChips(): GroupChip[] {
    const sort = this.state.sort;
    const sortedBinding = sort ? this.columns[sort.col]?.binding : undefined;
    return this.data.collectionView.groupDescriptions.map((g) => {
      const col = this.columns.find((c) => c.binding === g.property);
      return {
        binding: g.property,
        header: col?.header ?? g.property,
        sort: sortedBinding === g.property ? (sort!.ascending ? 'asc' : 'desc') : null,
      };
    });
  }

  private toggleGroupAt(row: number): void {
    const gr = this.data.groupRow(row);
    if (!gr) return;
    this.host.focus();
    if (
      this.emitCancel('groupCollapsedChanging', { pathKey: gr.pathKey, collapsed: !gr.collapsed })
    ) {
      return;
    }
    this.data.toggleGroup(gr.pathKey);
    this.refreshRows();
    this.events.emit('groupCollapsedChanged', { pathKey: gr.pathKey, collapsed: !gr.collapsed });
  }

  // Rebuild the row totals and redraw after the display rows change (collapse or
  // expand) without re-arranging the collection view.
  private refreshRows(): void {
    this.layout.setRowCount(this.data.length);
    this.renderer.resize(this.context());
    this.draw();
  }

  // ---- Column groups (multi-level header) ------------------------------------

  /** The active column-header groups, in authored order. */
  get columnGroups(): ColumnGroup[] {
    return this.columnGroupList;
  }

  /** Whether column-group headers animate when collapsing/expanding. */
  get columnGroupAnimation(): boolean {
    return this.host.classList.contains('apg-animated');
  }

  set columnGroupAnimation(on: boolean) {
    this.host.classList.toggle('apg-animated', on);
  }

  /** Replace all column groups. Pass an empty array to remove grouping entirely. */
  setColumnGroups(defs: ColumnGroupDef[]): void {
    this.columnGroupList = buildColumnGroups(this.allColumns, defs);
    this.applyColumnGroups();
    this.events.emit('columnGroupsChanged', { keys: this.columnGroupList.map((g) => g.key) });
  }

  /** Add one column group. Bindings already owned by another group are dropped. */
  addColumnGroup(def: ColumnGroupDef): void {
    this.setColumnGroups([...this.columnGroupDefs(), def]);
  }

  /** Remove the column group with the given key. */
  removeColumnGroup(key: string): void {
    const next = this.columnGroupDefs().filter((g) => g.key !== key);
    if (next.length === this.columnGroupList.length) return;
    this.setColumnGroups(next);
  }

  /** Every group in the tree, flattened (top-level groups and all nested ones). */
  private allGroups(): ColumnGroup[] {
    const out: ColumnGroup[] = [];
    for (const g of this.columnGroupList) out.push(...g.descendantGroups());
    return out;
  }

  /**
   * Collapse or expand a column group (at any nesting depth). Omit `collapsed`
   * to toggle. Collapsing hides the group's descendant columns except its
   * `collapseTo`; expanding shows them again. Cancelable through the
   * `columnGroupCollapsing` event.
   */
  toggleColumnGroup(key: string, collapsed?: boolean): void {
    const group = this.allGroups().find((g) => g.key === key);
    if (!group || !group.collapsible) return;
    const target = collapsed ?? !group.collapsed;
    if (target === group.collapsed) return;
    if (this.emitCancel('columnGroupCollapsing', { key, collapsed: target })) return;
    group.collapsed = target;
    this.applyColumnGroups();
    this.events.emit('columnGroupCollapsedChanged', { key, collapsed: target });
  }

  /** Collapse every collapsible column group. */
  collapseAllColumnGroups(): void {
    this.setColumnGroupsCollapsed(true);
  }

  /** Expand every column group. */
  expandAllColumnGroups(): void {
    this.setColumnGroupsCollapsed(false);
  }

  private setColumnGroupsCollapsed(collapsed: boolean): void {
    let changed = false;
    for (const group of this.allGroups()) {
      if (!group.collapsible || group.collapsed === collapsed) continue;
      if (this.emitCancel('columnGroupCollapsing', { key: group.key, collapsed })) continue;
      group.collapsed = collapsed;
      changed = true;
      this.events.emit('columnGroupCollapsedChanged', { key: group.key, collapsed });
    }
    if (changed) this.applyColumnGroups();
  }

  // Snapshot the current group tree back into plain defs, preserving collapse
  // state and nesting, so add/remove can round-trip it.
  private columnGroupDefs(): ColumnGroupDef[] {
    return this.columnGroupList.map((g) => groupToDef(g));
  }

  // Rebuild each column's `hidden` flag from the current group collapse state and
  // return the visible-column list. Walk the tree top-down: once inside a
  // collapsed group, only its `collapseTo` descendant survives — every other
  // descendant leaf is hidden. An inner collapsed group can't re-show a column
  // its collapsed ancestor already hid.
  private syncHiddenColumns(): Column[] {
    const hidden = new Set<string>();
    for (const group of this.columnGroupList) this.collectHidden(group, false, null, hidden);
    for (const col of this.allColumns) col.hidden = hidden.has(col.binding);
    return this.allColumns.filter((c) => !c.hidden);
  }

  // Depth-first: `keepBinding` is the one descendant leaf allowed to stay visible
  // inside the nearest collapsed ancestor (null = none / not yet collapsed).
  private collectHidden(
    node: ColumnGroupNode,
    underCollapsed: boolean,
    keepBinding: string | null,
    hidden: Set<string>,
  ): void {
    if (node.kind === 'leaf') {
      if (underCollapsed && node.binding !== keepBinding) hidden.add(node.binding);
      return;
    }
    // Entering this group: if it (or an ancestor) is collapsed, propagate that
    // state. The outermost collapsed group owns which leaf survives, so keep the
    // existing keepBinding when already collapsed; otherwise adopt this group's.
    const nowCollapsed = underCollapsed || node.collapsed;
    const keep = underCollapsed ? keepBinding : node.collapsed ? node.collapseTo : null;
    for (const child of node.children) this.collectHidden(child, nowCollapsed, keep, hidden);
  }

  // Recompute the visible columns after a group changed, rebuild the layout,
  // keep the active cell in range, and redraw. Parallels refreshRows() on the
  // column axis.
  private applyColumnGroups(): void {
    const hadGroups = this.viewportRenderer.columnGroupInner != null;
    this.columns = this.syncHiddenColumns();
    this.layout.setColumns(this.columns);
    this.clampSelectionToColumns();
    this.syncFrozen();
    this.renderer.resize(this.context());
    // If the group-header band's presence changed and the scaffold can't show
    // it, the visual gains/loses a row only after a rebuild; for v1 the band is
    // created up front when any group exists, so just redraw.
    void hadGroups;
    this.draw();
  }

  // After columns shrink (a group collapsed), pull the active cell back into
  // range so selection never points past the last visible column.
  private clampSelectionToColumns(): void {
    const active = this.selectionModel.getActive();
    if (!active) return;
    const maxCol = this.layout.colCount - 1;
    if (maxCol < 0) return;
    if (active.col > maxCol) {
      this.selectionModel.moveTo({ row: active.row, col: maxCol }, false);
      this.syncSelectionState();
    }
  }

  dispose(): void {
    this.unsubscribeData();
    const header = this.viewportRenderer.headerInner;
    header.removeEventListener('mousedown', this.onHeaderMouseDown);
    header.removeEventListener('click', this.onHeaderClick);
    this.viewportRenderer.rowHeaderInner.removeEventListener('click', this.onRowHeaderClick);
    this.scroll.dispose();
    this.mouse.dispose();
    this.keyboard.dispose();
    this.resizer.dispose();
    this.dragger?.dispose();
    this.clipboard?.dispose();
    this.exportManager.dispose();
    this.groupPanel?.dispose();
    this.filterEditor?.close();
    this.editPopup?.close();
    this.events.clear();
    this.undoStack.clear();
    this.resizeObserver?.disconnect();
    this.rowRenderer.clear();
    this.rowHeaderRenderer.clear();
    this.columnGroupRenderer?.clear();
    this.viewportRenderer.dispose();
    this.host.removeAttribute('tabindex');
    this.host.style.removeProperty('--apg-row-height');
    this.host.style.removeProperty('--apg-header-height');
    this.host.style.removeProperty('--apg-group-header-height');
    this.host.classList.remove('apg-animated');
  }

  private context(): RenderContext {
    return {
      layout: this.layout,
      columns: this.columns,
      data: this.data,
      state: this.state,
      groupHeaderTemplate: this.groupHeaderTemplate,
      rowClass: this.rowClass,
      rowStyle: this.rowStyle,
      merge: this.mergeLookup(),
      columnGroups: this.columnGroupList,
      isCellEdited: this.highlightEdits ? (row, col) => this.isCellEdited(row, col) : undefined,
      popupEditors: this.popupEditors,
    };
  }

  // Build the per-frame merge lookup, or undefined when merging is off. A custom
  // manager takes over entirely; otherwise the default content-driven merge runs
  // for columns that opted in.
  private mergeLookup(): RenderContext['merge'] {
    const manager = this.mergeManager ?? (this.anyMergeable ? contentMerge : undefined);
    if (!manager) return undefined;
    const rowCount = this.layout.rowCount;
    const colCount = this.layout.colCount;
    const value = (row: number, col: number): unknown => {
      if (this.data.rowType(row) !== 'data') return null;
      return this.columns[col].getValue(this.data.item(row) as Record<string, unknown>);
    };
    const mergeableCol = (col: number): boolean => this.columns[col].allowMerging;
    return (row, col) => manager({ row, col, rowCount, colCount, value, mergeableCol });
  }

  // Emit a cancelable ("-ing") event and return true if a handler set cancel.
  private emitCancel<K extends CancelableEvent>(
    type: K,
    payload: Omit<GridEvents[K], 'cancel'>,
  ): boolean {
    const e = { ...payload, cancel: false } as GridEvents[K];
    this.events.emit(type, e);
    return (e as unknown as { cancel: boolean }).cancel;
  }

  private syncViewportSize(): void {
    const vp = this.viewportRenderer.viewport;
    const width = vp.clientWidth - this.viewportRenderer.gutterLeft;
    const height = vp.clientHeight - this.viewportRenderer.gutterTop;
    this.viewport.setSize(Math.max(0, width), Math.max(0, height));
    this.viewportRenderer.setViewport(vp.clientWidth, vp.clientHeight);
  }

  private draw(): void {
    const vp = this.viewportRenderer.viewport;
    this.viewport.update(vp.scrollTop, vp.scrollLeft);
    this.renderer.render(this.context());
  }

  private measure(): void {
    this.syncViewportSize();
    this.draw();
  }

  private onScroll(): void {
    const vp = this.viewportRenderer.viewport;
    // The body panel is pinned to the viewport, so every scroll must reposition
    // its rows — not only the scrolls that change the row/column range.
    this.viewport.update(vp.scrollTop, vp.scrollLeft);
    this.renderer.render(this.context());
    this.events.emit('scrollChanged', { scrollTop: vp.scrollTop, scrollLeft: vp.scrollLeft });
  }

  private onSelect(cell: CellAddress, extend: boolean, isPress: boolean): void {
    if (this.data.rowType(cell.row) === 'group') {
      if (isPress) this.toggleGroupAt(cell.row);
      return;
    }
    // mousedown preventDefault blocks the default focus, so do it here — and
    // before applyMove, because alwaysEdit opens an editor there and focusing
    // the host afterwards would blur (and immediately commit/close) it.
    if (isPress) this.host.focus();
    this.applyMove(cell, extend);
    if (isPress) {
      this.events.emit('cellClick', cell);
      this.editor.toggleBoolean(cell); // checkbox cells flip on click
    }
  }

  // A header click sorts, unless it was really a resize or a reorder drag.
  private readonly onHeaderMouseDown = (e: MouseEvent): void => {
    this.headerDownX = e.clientX;
  };

  private readonly onHeaderClick = (e: MouseEvent): void => {
    if (Math.abs(e.clientX - this.headerDownX) > 4) return; // was a drag, not a click
    const btn = (e.target as HTMLElement).closest('.apg-filter-btn') as HTMLElement | null;
    if (btn) {
      this.openFilter(Number(btn.dataset.filter), btn.getBoundingClientRect());
      return;
    }
    if (!this.allowSorting) return;
    const header = this.viewportRenderer.headerInner;
    const x = e.clientX - header.getBoundingClientRect().left;
    const col = this.layout.colAtX(x);
    const right = this.layout.getColLeft(col) + this.layout.getColWidth(col);
    if (Math.abs(x - right) <= 5) return; // resize edge belongs to the resizer
    this.sortByColumn(col);
  };

  private readonly onRowHeaderClick = (e: MouseEvent): void => {
    const btn = (e.target as HTMLElement).closest('.apg-rowheader-edit') as HTMLElement | null;
    if (btn) this.openEditPopup(Number(btn.dataset.popupRow), this.host.getBoundingClientRect());
  };

  // Open the row popup editor, centered over the grid.
  private openEditPopup(row: number, bounds: DOMRect): void {
    if (!this.editPopup || this.data.rowType(row) !== 'data') return;
    if (this.emitCancel('rowEditStarting', { row })) return;
    const item = this.data.item(row);
    this.data.collectionView.editItem(item);
    this.events.emit('rowEditStarted', { row });
    this.editPopup.open(bounds, {
      columns: this.columns,
      item,
      onSave: (changes) => this.saveEditPopup(row, item, changes),
      onCancel: () => this.cancelEditPopup(row),
    });
  }

  private saveEditPopup(row: number, item: Row, changes: Map<Column, unknown>): void {
    if (this.emitCancel('rowEditEnding', { row })) {
      this.data.collectionView.cancelEdit();
      this.events.emit('rowEditEnded', { row });
      return;
    }
    if (changes.size > 0) {
      const edits: EditAction[] = [];
      for (const [column, value] of changes) {
        edits.push(new EditAction(this.data, column, row, column.getValue(item), value, () => {}));
      }
      const batch = new BatchAction(edits, () => this.draw());
      this.undoStack.push(batch);
      batch.redo(); // apply every field change and redraw once
    }
    this.data.collectionView.commitEdit();
    this.events.emit('rowEditEnded', { row });
  }

  private cancelEditPopup(row: number): void {
    this.data.collectionView.cancelEdit();
    this.events.emit('rowEditEnded', { row });
  }

  private onDoubleClick(cell: CellAddress): void {
    if (this.data.rowType(cell.row) === 'group') return;
    this.events.emit('cellDoubleClick', cell);
    this.editor.begin(cell);
  }

  private onActivate(): void {
    const cell = this.selectionModel.getActive();
    if (!cell) return;
    if (this.editor.toggleBoolean(cell)) return; // Space toggles checkbox cells
    this.editor.begin(cell);
  }

  /** True when highlightEdits is on and the cell's value differs from its pre-edit snapshot. */
  isCellEdited(row: number, col: number): boolean {
    if (!this.highlightEdits) return false;
    const column = this.columns[col];
    const item = this.data.item(row) as Row;
    const snap = this.editSnapshots.get(item);
    if (!snap || !(column.binding in snap)) return false;
    return column.getValue(item) !== snap[column.binding];
  }

  /** Drop all highlightEdits tracking, clearing every `.apg-cell-edited` mark. */
  clearEditHighlights(): void {
    this.editSnapshots = new WeakMap();
    this.draw();
  }

  // Record a binding's value the first time it's edited, so isCellEdited can
  // compare against the original later. Recomputed from this snapshot on
  // every render (not a sticky flag), so undoing an edit — or typing the
  // original value back in — clears the highlight for free.
  private captureEditSnapshot(cell: CellAddress): void {
    const column = this.columns[cell.col];
    const item = this.data.item(cell.row) as Row;
    let snap = this.editSnapshots.get(item);
    if (!snap) {
      snap = {};
      this.editSnapshots.set(item, snap);
    }
    if (!(column.binding in snap)) snap[column.binding] = column.getValue(item);
  }

  // Typing a printable character over a selected cell starts a quick edit
  // seeded with that character (Excel-style), unless already editing.
  private onType(key: string): void {
    if (this.editor.isEditing) return;
    const cell = this.selectionModel.getActive();
    if (!cell || this.data.rowType(cell.row) === 'group') return;
    const column = this.columns[cell.col];
    if (!column || column.dataType === 'Boolean') return; // Boolean toggles via Space, not typing
    this.editor.begin(cell, { mode: 'quick', initialChar: key });
  }

  private bounds(): GridBounds {
    return { rowCount: this.layout.rowCount, colCount: this.layout.colCount };
  }

  private applyMove(cell: CellAddress, extend: boolean): void {
    if (this.data.rowType(cell.row) === 'group') return;
    if (this.emitCancel('selectionChanging', { row: cell.row, col: cell.col })) return;
    if (!this.selectionModel.moveTo(cell, extend)) return;
    this.data.collectionView.moveCurrentToPosition(this.data.dataIndexAt(cell.row)); // currency follows selection
    this.syncSelectionState();
    this.draw();
    const active = this.selectionModel.getActive();
    this.events.emit('selectionChanged', active);
    // toggleBoolean/isReadOnly/rowReadOnly/editable are all re-checked inside
    // begin(). Quick mode (no initialChar) keeps the existing value but makes
    // arrow keys commit and move on to the next cell — without it the open
    // editor swallows arrows for caret movement and the selection can never
    // leave the cell, which is the whole point of always-edit.
    if (this.alwaysEdit && active) this.editor.begin(active, { mode: 'quick' });
  }

  private syncSelectionState(): void {
    this.state.selection = this.selectionModel.getRange(this.bounds());
    this.state.activeCell = this.selectionModel.getActive();
  }

  private onNav(action: NavAction, extend: boolean): void {
    const current = this.selectionModel.getActive();
    if (!current) {
      this.select(0, 0);
      return;
    }
    const pageRows = Math.max(1, Math.floor(this.viewport.height / this.rowHeight) - 1);
    const next = { ...current };
    switch (action) {
      case 'up':
        next.row -= 1;
        break;
      case 'down':
        next.row += 1;
        break;
      case 'left':
        next.col -= 1;
        break;
      case 'right':
        next.col += 1;
        break;
      case 'home':
        next.col = 0;
        break;
      case 'end':
        next.col = this.layout.colCount - 1;
        break;
      case 'pageup':
        next.row -= pageRows;
        break;
      case 'pagedown':
        next.row += pageRows;
        break;
    }
    next.row = clamp(next.row, 0, this.layout.rowCount - 1);
    next.col = clamp(next.col, 0, this.layout.colCount - 1);
    if (action === 'up' || action === 'pageup') next.row = this.nextDataRow(next.row, -1);
    else if (action === 'down' || action === 'pagedown') next.row = this.nextDataRow(next.row, 1);
    this.select(next.row, next.col, extend);
  }

  // Group-header rows aren't selectable, so vertical navigation steps over them.
  private nextDataRow(row: number, dir: 1 | -1): number {
    let r = row;
    while (r >= 0 && r < this.layout.rowCount && this.data.rowType(r) === 'group') r += dir;
    return clamp(r, 0, this.layout.rowCount - 1);
  }

  private scrollIntoView(cell: CellAddress): void {
    const vp = this.viewportRenderer.viewport;
    const dataWidth = vp.clientWidth - this.viewportRenderer.gutterLeft;
    const dataHeight = vp.clientHeight - this.viewportRenderer.gutterTop;
    const top = this.layout.getRowTop(cell.row);
    const bottom = top + this.layout.getRowHeight(cell.row);
    const left = this.layout.getColLeft(cell.col);
    const right = left + this.layout.getColWidth(cell.col);

    if (top < vp.scrollTop) vp.scrollTop = top;
    else if (bottom > vp.scrollTop + dataHeight) vp.scrollTop = bottom - dataHeight;

    if (left < vp.scrollLeft) vp.scrollLeft = left;
    else if (right > vp.scrollLeft + dataWidth) vp.scrollLeft = right - dataWidth;

    this.onScroll();
  }
}
