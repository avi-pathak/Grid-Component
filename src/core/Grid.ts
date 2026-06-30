import { GridOptions, resolveOptions } from './GridOptions';
import { GridState } from './GridState';
import { GridViewport } from './GridViewport';
import { Column, ColumnDef } from '../models/Column';
import { CellAddress, CellRange } from '../models/Cell';
import { DataView } from '../data/DataView';
import { CollectionView } from '../data/CollectionView';
import { SortDescription } from '../models/SortDescription';
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
import { UndoStack } from '../commands/UndoStack';
import { ResizeColumnAction } from '../commands/ResizeColumnAction';
import { EditAction } from '../commands/EditAction';
import { MoveColumnAction, moveColumn } from '../commands/MoveColumnAction';
import { EditorManager } from '../editing/EditorManager';
import { clamp } from '../utils/Math';

type Row = Record<string, unknown>;

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
    if (resolved.allowColumnReorder) {
      this.dragger = new ColumnDragger(
        this.viewportRenderer.headerInner,
        this.layout,
        () => this.columns,
        (from, to) => this.moveColumn(from, to),
      );
    }
    this.allowSorting = resolved.allowSorting;
    const header = this.viewportRenderer.headerInner;
    header.addEventListener('mousedown', this.onHeaderMouseDown);
    header.addEventListener('click', this.onHeaderClick);

    this.editor = new EditorManager({
      cells: this.viewportRenderer.cells,
      layout: this.layout,
      data: this.data,
      columns: this.columns,
      undo: this.undoStack,
      onApplied: () => this.draw(),
      onStart: (cell) => this.events.emit('cellEditStart', cell),
      onEnd: (cell) => this.events.emit('cellEditEnd', cell),
    });
    this.undoStack.onStateChanged = () =>
      this.events.emit('undoStackChanged', { canUndo: this.canUndo, canRedo: this.canRedo });

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
    this.layout.setRowCount(this.data.length);
    this.layout.setColumns(this.columns);
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

  /** Begin editing a cell (no-op if the column isn't editable). */
  editCell(row: number, col: number): void {
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

  /** Resize a column. Recorded on the undo stack. */
  resizeColumn(index: number, width: number): void {
    const column = this.columns[index];
    if (!column || column.width === width) return;
    this.undoStack.push(new ResizeColumnAction(column, column.width, width, () => this.refresh()));
    column.width = width;
    this.refresh();
  }

  /** Move a column to a new index. Recorded on the undo stack. */
  moveColumn(from: number, to: number): void {
    const last = this.columns.length - 1;
    if (from === to || from < 0 || from > last || to < 0 || to > last) return;
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
    if (ascending === null) {
      this.clearSort();
      return;
    }
    let dir = ascending;
    if (dir == null) {
      const cur = this.state.sort;
      if (cur && cur.col === col) {
        if (!cur.ascending) {
          this.clearSort();
          return;
        }
        dir = false;
      } else {
        dir = true;
      }
    }
    this.state.sort = { col, ascending: dir };
    this.data.collectionView.sortConverter = this.sortConverter;
    this.data.collectionView.sortDescriptions = [new SortDescription(column.binding, dir)];
  }

  private clearSort(): void {
    this.state.sort = null;
    this.data.collectionView.sortDescriptions = [];
  }

  // Sort data-mapped columns by their display text (FlexGrid sortByDisplayValues).
  private readonly sortConverter = (sd: SortDescription, _item: Row, value: unknown): unknown => {
    const column = this.columns.find((c) => c.binding === sd.property);
    if (column?.dataMap?.sortByDisplayValues) return column.dataMap.getDisplayValue(value);
    return value;
  };

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
    return { layout: this.layout, columns: this.columns, data: this.data, state: this.state };
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
    this.viewportRenderer.syncPanels(vp.scrollLeft, vp.scrollTop);
    if (changed) this.renderer.render(this.context());
    this.events.emit('scrollChanged', { scrollTop: vp.scrollTop, scrollLeft: vp.scrollLeft });
  }

  private onSelect(cell: CellAddress, extend: boolean, isPress: boolean): void {
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
    if (!this.allowSorting || Math.abs(e.clientX - this.headerDownX) > 4) return;
    const header = this.viewportRenderer.headerInner;
    const x = e.clientX - header.getBoundingClientRect().left;
    const col = this.layout.colAtX(x);
    const right = this.layout.getColLeft(col) + this.layout.getColWidth(col);
    if (Math.abs(x - right) <= 5) return; // resize edge belongs to the resizer
    this.sortByColumn(col);
  };

  private onDoubleClick(cell: CellAddress): void {
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
    if (!this.selectionModel.moveTo(cell, extend)) return;
    this.data.collectionView.moveCurrentToPosition(cell.row); // currency follows selection
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
    this.select(next.row, next.col, extend);
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
