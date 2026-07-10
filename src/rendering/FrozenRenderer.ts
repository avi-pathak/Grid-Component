import { RenderContext } from './RenderContext';
import { CellRenderer } from './CellRenderer';
import { fillHeaderCell } from './HeaderRenderer';
import { ViewportRenderer } from './ViewportRenderer';
import { createEl, setTransform } from '../utils/DOM';
import { ObjectPool } from '../utils/ObjectPool';

interface BandRow {
  el: HTMLElement;
  cells: Map<number, HTMLElement>;
}

/**
 * Renders a rectangular band of pooled rows and cells into a pinned panel. Used
 * for the frozen columns, frozen rows, and their shared corner. It mirrors the
 * body renderer's pooling but iterates whatever row/column window it is given.
 */
class CellBand {
  private active = new Map<number, BandRow>();
  private rowPool = new ObjectPool<HTMLElement>(
    () => createEl('div', 'apg-row apg-frozen-cell-row'),
    (el) => {
      el.className = 'apg-row apg-frozen-cell-row';
      el.style.transform = '';
      el.style.height = '';
    },
  );

  constructor(
    private inner: HTMLElement,
    private cells: CellRenderer,
    private cellClass: string,
  ) {}

  render(
    ctx: RenderContext,
    firstRow: number,
    lastRow: number,
    firstCol: number,
    lastCol: number,
  ): void {
    for (const [row, view] of this.active) {
      if (row < firstRow || row > lastRow) {
        this.releaseRow(view);
        this.active.delete(row);
      }
    }
    for (let row = firstRow; row <= lastRow; row++) {
      let view = this.active.get(row);
      if (!view) {
        view = this.acquireRow(row, ctx);
        this.active.set(row, view);
      }
      this.fill(view, row, ctx, firstCol, lastCol);
    }
  }

  clear(): void {
    for (const view of this.active.values()) this.releaseRow(view);
    this.active.clear();
  }

  private acquireRow(row: number, ctx: RenderContext): BandRow {
    const el = this.rowPool.acquire();
    el.style.height = `${ctx.layout.getRowHeight(row)}px`;
    const step = ctx.state.alternatingRowStep;
    el.classList.toggle('apg-row-alt', step > 0 && Math.floor(row / step) % 2 === 1);
    setTransform(el, 0, ctx.layout.getRowTop(row));
    this.inner.appendChild(el);
    return { el, cells: new Map() };
  }

  private fill(
    view: BandRow,
    row: number,
    ctx: RenderContext,
    firstCol: number,
    lastCol: number,
  ): void {
    const isGroup = ctx.data.rowType(row) === 'group';
    view.el.classList.toggle('apg-frozen-group', isGroup);

    // Group rows have no per-column cells in the pinned bands; keep the row as a
    // blank strip so the background stays continuous with the body.
    for (const [col, cellEl] of view.cells) {
      if (isGroup || col < firstCol || col > lastCol) {
        this.cells.release(cellEl);
        view.cells.delete(col);
      }
    }
    if (isGroup) return;

    const item = ctx.data.item(row) as Record<string, unknown>;
    const { selection, activeCell } = ctx.state;
    const rowSelected = selection != null && row >= selection.topRow && row <= selection.bottomRow;
    const activeCol = activeCell && activeCell.row === row ? activeCell.col : -1;

    for (let col = firstCol; col <= lastCol; col++) {
      let cellEl = view.cells.get(col);
      if (!cellEl) {
        cellEl = this.cells.acquire();
        view.el.appendChild(cellEl);
        view.cells.set(col, cellEl);
      }
      const selected =
        rowSelected && selection != null && col >= selection.leftCol && col <= selection.rightCol;
      this.cells.update(
        cellEl,
        ctx.columns[col],
        item,
        row,
        ctx.layout.getColLeft(col),
        ctx.layout.getColWidth(col),
        selected,
        col === activeCol,
      );
      // update() rewrites className, so tag the frozen cell afterwards.
      cellEl.classList.add('apg-frozen-cell', this.cellClass);
    }
  }

  private releaseRow(view: BandRow): void {
    for (const cellEl of view.cells.values()) this.cells.release(cellEl);
    view.cells.clear();
    this.rowPool.release(view.el);
    view.el.remove();
  }
}

/** Pooled header cells for the frozen-column band. */
class HeaderBand {
  private active = new Map<number, HTMLElement>();
  private pool = new ObjectPool<HTMLElement>(
    () => createEl('div', 'apg-header-cell'),
    (el) => {
      el.textContent = '';
      el.className = 'apg-header-cell';
    },
  );

  constructor(private inner: HTMLElement) {}

  render(ctx: RenderContext, first: number, last: number): void {
    for (const [col, el] of this.active) {
      if (col < first || col > last) {
        el.remove();
        this.pool.release(el);
        this.active.delete(col);
      }
    }
    for (let col = first; col <= last; col++) {
      let el = this.active.get(col);
      if (!el) {
        el = this.pool.acquire();
        this.inner.appendChild(el);
        this.active.set(col, el);
      }
      fillHeaderCell(el, ctx, col);
    }
  }

  clear(): void {
    for (const el of this.active.values()) {
      el.remove();
      this.pool.release(el);
    }
    this.active.clear();
  }
}

/** Pooled row-header (row number) cells for the frozen-row band. */
class RowHeaderBand {
  private active = new Map<number, HTMLElement>();
  private pool = new ObjectPool<HTMLElement>(
    () => createEl('div', 'apg-rowheader-cell'),
    (el) => {
      el.textContent = '';
      el.className = 'apg-rowheader-cell';
    },
  );

  constructor(private inner: HTMLElement) {}

  render(ctx: RenderContext, first: number, last: number): void {
    for (const [row, el] of this.active) {
      if (row < first || row > last) {
        el.remove();
        this.pool.release(el);
        this.active.delete(row);
      }
    }
    for (let row = first; row <= last; row++) {
      let el = this.active.get(row);
      if (!el) {
        el = this.pool.acquire();
        this.inner.appendChild(el);
        this.active.set(row, el);
      }
      el.style.height = `${ctx.layout.getRowHeight(row)}px`;
      setTransform(el, 0, ctx.layout.getRowTop(row));
      const isGroup = ctx.data.rowType(row) === 'group';
      el.className = isGroup ? 'apg-rowheader-cell apg-rowheader-group' : 'apg-rowheader-cell';
      el.textContent = isGroup ? '' : String(row + 1);
    }
  }

  clear(): void {
    for (const el of this.active.values()) {
      el.remove();
      this.pool.release(el);
    }
    this.active.clear();
  }
}

/**
 * Draws the pinned regions: the frozen-column band, the frozen-row band, the
 * shared corner where they meet, and the matching header/row-header slices. The
 * three regions partition cleanly — the columns band skips the frozen rows, the
 * rows band skips the frozen columns, and the corner owns the overlap — so no
 * cell is painted twice.
 */
export class FrozenRenderer {
  private colsBand: CellBand;
  private rowsBand: CellBand;
  private cornerBand: CellBand;
  private colsHeader: HeaderBand;
  private rowsHeader: RowHeaderBand;

  constructor(vp: ViewportRenderer) {
    this.colsBand = new CellBand(vp.frozenCols, new CellRenderer(), 'apg-frozen-col-cell');
    this.rowsBand = new CellBand(vp.frozenRows, new CellRenderer(), 'apg-frozen-row-cell');
    this.cornerBand = new CellBand(vp.frozenCorner, new CellRenderer(), 'apg-frozen-corner-cell');
    this.colsHeader = new HeaderBand(vp.frozenColsHeader);
    this.rowsHeader = new RowHeaderBand(vp.frozenRowsHeader);
  }

  render(ctx: RenderContext): void {
    const fCols = ctx.state.frozenCols;
    const fRows = ctx.state.frozenRows;
    const { firstRow, lastRow, firstCol, lastCol } = ctx.state;

    if (fCols > 0) {
      const bodyFirstRow = Math.max(firstRow, fRows);
      this.colsBand.render(ctx, bodyFirstRow, lastRow, 0, fCols - 1);
      this.colsHeader.render(ctx, 0, fCols - 1);
    } else {
      this.colsBand.clear();
      this.colsHeader.clear();
    }

    if (fRows > 0) {
      const bodyFirstCol = Math.max(firstCol, fCols);
      this.rowsBand.render(ctx, 0, fRows - 1, bodyFirstCol, lastCol);
      this.rowsHeader.render(ctx, 0, fRows - 1);
    } else {
      this.rowsBand.clear();
      this.rowsHeader.clear();
    }

    if (fCols > 0 && fRows > 0) {
      this.cornerBand.render(ctx, 0, fRows - 1, 0, fCols - 1);
    } else {
      this.cornerBand.clear();
    }
  }
}
