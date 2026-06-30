import { RenderContext } from './RenderContext';
import { createEl } from '../utils/DOM';
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

    for (const [col, el] of this.active) {
      if (col < firstCol || col > lastCol) {
        el.remove();
        this.pool.release(el);
        this.active.delete(col);
      }
    }

    for (let col = firstCol; col <= lastCol; col++) {
      let el = this.active.get(col);
      if (!el) {
        el = this.pool.acquire();
        this.inner.appendChild(el);
        this.active.set(col, el);
      }
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
    }
  }
}
