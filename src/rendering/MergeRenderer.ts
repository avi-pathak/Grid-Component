import { RenderContext } from './RenderContext';
import { CellRenderer } from './CellRenderer';
import { CellRange, rangeContains } from '../models/Cell';

/**
 * Paints spanning (merged) cells on top of the normal rows. Each distinct span
 * is drawn once at its origin, sized to cover its whole range, so a span whose
 * origin scrolled above the viewport still fills the visible part. The body
 * renderer skips any cell that falls inside a span, leaving this layer to own it.
 */
export class MergeRenderer {
  private cells = new CellRenderer();
  private active = new Map<string, HTMLElement>();

  constructor(private layer: HTMLElement) {}

  render(ctx: RenderContext): void {
    if (!ctx.merge) {
      this.clear();
      return;
    }
    const { firstRow, lastRow, firstCol, lastCol } = ctx.state;
    const seen = new Set<string>();

    for (let col = firstCol; col <= lastCol; col++) {
      let row = firstRow;
      while (row <= lastRow) {
        const range = ctx.merge(row, col);
        if (!range) {
          row++;
          continue;
        }
        const key = `${range.topRow}:${range.leftCol}`;
        if (!seen.has(key)) {
          seen.add(key);
          this.renderSpan(ctx, range, key);
        }
        row = range.bottomRow + 1;
      }
    }

    for (const [key, el] of this.active) {
      if (!seen.has(key)) {
        this.cells.release(el);
        this.active.delete(key);
      }
    }
  }

  clear(): void {
    for (const el of this.active.values()) this.cells.release(el);
    this.active.clear();
  }

  private renderSpan(ctx: RenderContext, range: CellRange, key: string): void {
    let el = this.active.get(key);
    if (!el) {
      el = this.cells.acquire();
      this.layer.appendChild(el);
      this.active.set(key, el);
    }

    const col = range.leftCol;
    const item = ctx.data.item(range.topRow) as Record<string, unknown>;
    const left = ctx.layout.getColLeft(col);
    const right = ctx.layout.getColLeft(range.rightCol) + ctx.layout.getColWidth(range.rightCol);
    // The body panel is pinned, so spans are placed relative to the scroll.
    const top = ctx.layout.getRowTop(range.topRow) - ctx.state.scrollTop;
    const bottom =
      ctx.layout.getRowTop(range.bottomRow) +
      ctx.layout.getRowHeight(range.bottomRow) -
      ctx.state.scrollTop;

    const sel = ctx.state.selection;
    const selected = sel != null && intersects(sel, range);
    const active =
      ctx.state.activeCell != null &&
      rangeContains(range, ctx.state.activeCell.row, ctx.state.activeCell.col);

    this.cells.update(
      el,
      ctx.columns[col],
      item,
      range.topRow,
      left,
      right - left,
      selected,
      active,
    );
    el.classList.add('apg-cell-merged');
    el.style.top = `${top}px`;
    el.style.height = `${bottom - top}px`;
  }
}

function intersects(a: CellRange, b: CellRange): boolean {
  return (
    a.topRow <= b.bottomRow &&
    a.bottomRow >= b.topRow &&
    a.leftCol <= b.rightCol &&
    a.rightCol >= b.leftCol
  );
}
