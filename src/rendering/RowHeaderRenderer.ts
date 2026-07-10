import { RenderContext } from './RenderContext';
import { createEl, setTransform } from '../utils/DOM';
import { ObjectPool } from '../utils/ObjectPool';

/** Renders the row-header cells (1-based row numbers) for the visible rows, pooled. */
export class RowHeaderRenderer {
  private active = new Map<number, HTMLElement>();
  private pool = new ObjectPool<HTMLElement>(
    () => createEl('div', 'apg-rowheader-cell'),
    (el) => {
      el.textContent = '';
      el.className = 'apg-rowheader-cell';
    },
  );

  constructor(private inner: HTMLElement) {}

  render(ctx: RenderContext): void {
    const { firstRow, lastRow } = ctx.state;
    // The frozen-row header owns the pinned rows; the body starts past them.
    const bodyFirst = Math.max(firstRow, ctx.state.frozenRows);

    for (const [row, el] of this.active) {
      if (row < bodyFirst || row > lastRow) {
        el.remove();
        this.pool.release(el);
        this.active.delete(row);
      }
    }

    for (let row = bodyFirst; row <= lastRow; row++) {
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
