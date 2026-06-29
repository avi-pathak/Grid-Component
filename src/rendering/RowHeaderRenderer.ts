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

    for (const [row, el] of this.active) {
      if (row < firstRow || row > lastRow) {
        el.remove();
        this.pool.release(el);
        this.active.delete(row);
      }
    }

    for (let row = firstRow; row <= lastRow; row++) {
      let el = this.active.get(row);
      if (!el) {
        el = this.pool.acquire();
        this.inner.appendChild(el);
        this.active.set(row, el);
      }
      el.style.height = `${ctx.layout.getRowHeight(row)}px`;
      setTransform(el, 0, ctx.layout.getRowTop(row));
      el.textContent = String(row + 1);
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
