import { GridOptions, resolveOptions } from './GridOptions';
import { GridState } from './GridState';
import { GridViewport } from './GridViewport';
import { Column, ColumnDef } from '../models/Column';
import { CellAddress, CellRange } from '../models/Cell';
import { DataView } from '../data/DataView';
import { CollectionView } from '../data/CollectionView';
import { SortDescription } from '../models/SortDescription';
import { PropertyGroupDescription } from '../models/GroupDescription';
import { LayoutEngine } from '../virtualization/LayoutEngine';
import { ViewportRenderer } from '../rendering/ViewportRenderer';
import { RowRenderer } from '../rendering/RowRenderer';
import { HeaderRenderer } from '../rendering/HeaderRenderer';
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
import { GroupPanel, GroupChip } from '../rendering/GroupPanel';
import { GroupHeaderTemplate } from '../rendering/GroupHeader';
import { FilterModel } from '../data/FilterModel';
import { FilterEditor } from '../rendering/FilterEditor';
import { UndoStack } from '../commands/UndoStack';
import { ResizeColumnAction } from '../commands/ResizeColumnAction';
import { EditAction } from '../commands/EditAction';
import { BatchAction } from '../commands/BatchAction';
import { MoveColumnAction, moveColumn } from '../commands/MoveColumnAction';
import { EditorManager } from '../editing/EditorManager';
import { clamp } from '../utils/Math';

type Row = Record<string, unknown>;

// Event names whose payload carries a `cancel` flag (the "-ing"/before events).
type CancelableEvent = {
  [K in keyof GridEvents]: GridEvents[K] extends { cancel: boolean } ? K : never;
}[keyof GridEvents];

const GROUP_PANEL_HEIGHT = 40;

/**
 * The grid facade. Constructs and owns every subsystem, drives the
 * scroll/resize render loop, and exposes the public API.
 */
export class Grid {
  private host: HTMLElement;
  private state = new GridState();
  private data: DataView;
  private columns: Column[];
  private rowHeight: number;
  private headerHeight: number;
  private showRowHeader: boolean;

  private layout: LayoutEngine;
  private viewport: GridViewport;
  private viewportRenderer: ViewportRenderer;
  private rowRenderer: RowRenderer;
  private headerRenderer: HeaderRenderer;
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
  private groupPanel?: GroupPanel;
  private groupHeaderTemplate?: GroupHeaderTemplate;
  private rowClass?: RenderContext['rowClass'];
  private rowStyle?: RenderContext['rowStyle'];
  private filterModel?: FilterModel;
  private filterEditor?: FilterEditor;
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
    this.columns = resolved.columns;
    this.data = new DataView(resolved.view);
    this.rowHeight = resolved.rowHeight;
    this.headerHeight = resolved.headerHeight;
    this.maxGroups = resolved.maxGroups;
    this.groupHeaderTemplate = resolved.groupHeaderTemplate;
    this.rowClass = resolved.rowClass;
    this.rowStyle = resolved.rowStyle;
    this.selectionModel = new SelectionModel(resolved.selectionMode);
    this.state.alternatingRowStep = resolved.alternatingRowStep;

    const showColumnHeader =
      resolved.headersVisibility === 'All' || resolved.headersVisibility === 'Column';
    this.showRowHeader =
      resolved.headersVisibility === 'All' || resolved.headersVisibility === 'Row';

    this.host.style.setProperty('--apg-row-height', `${this.rowHeight}px`);
    this.host.style.setProperty('--apg-header-height', `${this.headerHeight}px`);
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
    });
    this.rowRenderer = new RowRenderer(this.viewportRenderer.cells, new CellRenderer());
    this.headerRenderer = new HeaderRenderer(this.viewportRenderer.headerInner);
    this.rowHeaderRenderer = new RowHeaderRenderer(this.viewportRenderer.rowHeaderInner);
    this.renderer = new Renderer(
      this.viewportRenderer,
      this.rowRenderer,
      this.headerRenderer,
      this.rowHeaderRenderer,
      this.showRowHeader,
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

    this.editor = new EditorManager({
      cells: this.viewportRenderer.cells,
      layout: this.layout,
      data: this.data,
      columns: this.columns,
      undo: this.undoStack,
      onApplied: () => this.draw(),
      onBeginning: (cell) => !this.emitCancel('beginningEdit', { row: cell.row, col: cell.col }),
      onStart: (cell) => this.events.emit('cellEditStart', cell),
      onEnding: (cell, value) =>
        !this.emitCancel('cellEditEnding', { row: cell.row, col: cell.col, value }),
      onEnded: (cell, value) =>
        this.events.emit('cellEditEnded', { row: cell.row, col: cell.col, value }),
      onEnd: (cell) => this.events.emit('cellEditEnd', cell),
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
    this.layout.setColumns(this.columns);
    this.layout.setRowCount(this.data.length);
    this.renderer.resize(this.context());
    this.draw();
  }

  /** Redraw the current window without recomputing totals. */
  invalidate(): void {
    this.draw();
  }

  setData(items: Row[]): void {
    this.data.setItems(items);
    this.refresh();
  }

  addColumn(def: ColumnDef, index?: number): void {
    const col = new Column(def);
    if (index == null) this.columns.push(col);
    else this.columns.splice(index, 0, col);
    this.refresh();
  }

  removeColumn(index: number): void {
    this.columns.splice(index, 1);
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
    this.undoStack.push(new MoveColumnAction(this.columns, from, to, () => this.refresh()));
    moveColumn(this.columns, from, to);
    this.refresh();
    this.events.emit('columnReordered', { from, to });
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

  dispose(): void {
    this.unsubscribeData();
    const header = this.viewportRenderer.headerInner;
    header.removeEventListener('mousedown', this.onHeaderMouseDown);
    header.removeEventListener('click', this.onHeaderClick);
    this.scroll.dispose();
    this.mouse.dispose();
    this.keyboard.dispose();
    this.resizer.dispose();
    this.dragger?.dispose();
    this.clipboard?.dispose();
    this.groupPanel?.dispose();
    this.filterEditor?.close();
    this.events.clear();
    this.undoStack.clear();
    this.resizeObserver?.disconnect();
    this.rowRenderer.clear();
    this.rowHeaderRenderer.clear();
    this.viewportRenderer.dispose();
    this.host.removeAttribute('tabindex');
    this.host.style.removeProperty('--apg-row-height');
    this.host.style.removeProperty('--apg-header-height');
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
    };
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
    const changed = this.viewport.update(vp.scrollTop, vp.scrollLeft);
    if (changed) this.renderer.render(this.context());
    this.events.emit('scrollChanged', { scrollTop: vp.scrollTop, scrollLeft: vp.scrollLeft });
  }

  private onSelect(cell: CellAddress, extend: boolean, isPress: boolean): void {
    if (this.data.rowType(cell.row) === 'group') {
      if (isPress) this.toggleGroupAt(cell.row);
      return;
    }
    this.applyMove(cell, extend);
    if (isPress) {
      this.host.focus(); // mousedown preventDefault blocks the default focus, so do it here
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
    this.events.emit('selectionChanged', this.selectionModel.getActive());
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
