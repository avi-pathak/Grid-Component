import { RenderContext } from './RenderContext';
import { createEl } from '../utils/DOM';
import { iconEl } from '../utils/icons';
import { ObjectPool } from '../utils/ObjectPool';

/** Renders the column header cells for the visible columns, pooled like body cells. */
export class HeaderRenderer {
  private active = new Map<number, HTMLElement>();
  private pool = new ObjectPool<HTMLElement>(
    () => createEl('div', 'apg-header-cell'),
    (el) => {
      el.textContent = '';
      el.className = 'apg-header-cell';
    },
  );

  constructor(private inner: HTMLElement) {}

  render(ctx: RenderContext): void {
    const { firstCol, lastCol } = ctx.state;
    // The frozen-column header owns the pinned columns; the body starts past them.
    const bodyFirst = Math.max(firstCol, ctx.state.frozenCols);

    for (const [col, el] of this.active) {
      if (col < bodyFirst || col > lastCol) {
        el.remove();
        this.pool.release(el);
        this.active.delete(col);
      }
    }

    for (let col = bodyFirst; col <= lastCol; col++) {
      let el = this.active.get(col);
      if (!el) {
        el = this.pool.acquire();
        this.inner.appendChild(el);
        this.active.set(col, el);
      }
      fillHeaderCell(el, ctx, col);
    }
  }
}

/** Fill a header cell with the column's label, sort arrow, and filter button. */
export function fillHeaderCell(el: HTMLElement, ctx: RenderContext, col: number): void {
  const column = ctx.columns[col];
  el.className = `apg-header-cell apg-align-${column.align}`;
  if (column.binding && !column.isCalculated) el.classList.add('apg-sortable');
  el.style.left = `${ctx.layout.getColLeft(col)}px`;
  el.style.width = `${ctx.layout.getColWidth(col)}px`;
  el.textContent = column.header;
  const sort = ctx.state.sort;
  if (sort && sort.col === col) {
    const arrow = createEl('span', 'apg-sort-arrow');
    arrow.textContent = sort.ascending ? '▲' : '▼';
    el.appendChild(arrow);
  }
  if (column.filterable) {
    const active = ctx.state.activeFilters.has(col);
    const btn = createEl('button', 'apg-filter-btn');
    btn.type = 'button';
    btn.dataset.filter = String(col);
    btn.title = active ? 'Edit filter' : 'Filter';
    if (active) btn.classList.add('apg-filter-active');
    btn.appendChild(iconEl(active ? 'filterActive' : 'filter'));
    el.appendChild(btn);
  }
}
