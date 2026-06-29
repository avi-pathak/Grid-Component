import { GridOptions, resolveOptions } from './GridOptions';
import { GridState } from './GridState';
import { GridViewport } from './GridViewport';
import { Column, ColumnDef } from '../models/Column';
import { CellAddress, CellRange } from '../models/Cell';
import { DataView } from '../data/DataView';
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
import { UndoStack } from '../commands/UndoStack';
import { ResizeColumnAction } from '../commands/ResizeColumnAction';
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
  private undoStack = new UndoStack();
  private editor: EditorManager;

  constructor(host: string | HTMLElement, options: GridOptions) {
    const el = typeof host === 'string' ? document.querySelector<HTMLElement>(host) : host;
    if (!el) throw new Error(`apgrid: host element not found for "${String(host)}"`);
    this.host = el;

    const resolved = resolveOptions(options);
    this.columns = resolved.columns;
    this.data = new DataView(resolved.items);
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
    );
    this.resizer = new ColumnResizer(
      this.viewportRenderer.headerInner,
      this.layout,
      () => this.columns,
      () => this.refresh(),
      (col, width) => this.resizeColumn(col, width),
    );

    this.editor = new EditorManager({
      viewport: this.viewportRenderer.viewport,
      layout: this.layout,
      data: this.data,
      columns: this.columns,
      undo: this.undoStack,
      gutterLeft: this.viewportRenderer.gutterLeft,
      gutterTop: this.viewportRenderer.gutterTop,
      onApplied: () => this.draw(),
      onStart: (cell) => this.events.emit('cellEditStart', cell),
      onEnd: (cell) => this.events.emit('cellEditEnd', cell),
    });
    this.undoStack.onStateChanged = () =>
      this.events.emit('undoStackChanged', { canUndo: this.canUndo, canRedo: this.canRedo });

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

  /** Resize a column. Recorded on the undo stack. */
  resizeColumn(index: number, width: number): void {
    const column = this.columns[index];
    if (!column || column.width === width) return;
    this.undoStack.push(new ResizeColumnAction(column, column.width, width, () => this.refresh()));
    column.width = width;
    this.refresh();
  }

  dispose(): void {
    this.scroll.dispose();
    this.mouse.dispose();
    this.keyboard.dispose();
    this.resizer.dispose();
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
    if (isPress) this.events.emit('cellClick', cell);
  }

  private onDoubleClick(cell: CellAddress): void {
    this.events.emit('cellDoubleClick', cell);
    this.editor.begin(cell);
  }

  private bounds(): GridBounds {
    return { rowCount: this.layout.rowCount, colCount: this.layout.colCount };
  }

  private applyMove(cell: CellAddress, extend: boolean): void {
    if (!this.selectionModel.moveTo(cell, extend)) return;
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
