import { RenderContext } from './RenderContext';
import { CellRenderer } from './CellRenderer';
import { createEl, setTransform } from '../utils/DOM';
import { ObjectPool } from '../utils/ObjectPool';

interface RowView {
  el: HTMLElement;
  cells: Map<number, HTMLElement>;
}

/**
 * Keeps one pooled `.apg-row` per visible row and one pooled `.apg-cell` per
 * visible column inside it. On each pass it releases rows and cells that left
 * the range and reuses them for the ones that entered — the DOM never grows
 * past the visible window plus its buffer.
 */
export class RowRenderer {
  private active = new Map<number, RowView>();
  private rowPool = new ObjectPool<HTMLElement>(
    () => createEl('div', 'apg-row'),
    (el) => {
      el.className = 'apg-row';
    },
  );

  constructor(
    private canvas: HTMLElement,
    private cells: CellRenderer,
  ) {}

  render(ctx: RenderContext): void {
    const { firstRow, lastRow } = ctx.state;

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
      this.fillCells(view, row, ctx);
    }
  }

  clear(): void {
    for (const view of this.active.values()) this.releaseRow(view);
    this.active.clear();
  }

  private acquireRow(row: number, ctx: RenderContext): RowView {
    const el = this.rowPool.acquire();
    el.classList.toggle('apg-row-alt', row % 2 === 1);
    el.style.height = `${ctx.layout.getRowHeight(row)}px`;
    setTransform(el, 0, ctx.layout.getRowTop(row));
    this.canvas.appendChild(el);
    return { el, cells: new Map() };
  }

  private fillCells(view: RowView, row: number, ctx: RenderContext): void {
    const { firstCol, lastCol, selection, activeCell } = ctx.state;
    const item = ctx.data.item(row) as Record<string, unknown>;
    const rowSelected = selection != null && row >= selection.topRow && row <= selection.bottomRow;
    const activeCol = activeCell && activeCell.row === row ? activeCell.col : -1;

    for (const [col, cellEl] of view.cells) {
      if (col < firstCol || col > lastCol) {
        this.cells.release(cellEl);
        view.cells.delete(col);
      }
    }

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
        ctx.layout.getColLeft(col),
        ctx.layout.getColWidth(col),
        selected,
        col === activeCol,
      );
    }
  }

  private releaseRow(view: RowView): void {
    for (const cellEl of view.cells.values()) this.cells.release(cellEl);
    view.cells.clear();
    this.rowPool.release(view.el);
    view.el.remove();
  }
}
