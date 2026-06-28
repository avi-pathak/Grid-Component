import { Column } from '../models/Column';
import { createEl } from '../utils/DOM';
import { ObjectPool } from '../utils/ObjectPool';

/** Owns the pool of cell elements and knows how to position and fill one. */
export class CellRenderer {
  private pool = new ObjectPool<HTMLElement>(
    () => createEl('div', 'apg-cell'),
    (el) => {
      el.textContent = '';
      el.className = 'apg-cell';
    },
  );

  acquire(): HTMLElement {
    return this.pool.acquire();
  }

  release(el: HTMLElement): void {
    el.remove();
    this.pool.release(el);
  }

  update(
    el: HTMLElement,
    column: Column,
    item: Record<string, unknown>,
    left: number,
    width: number,
    selected: boolean,
    active: boolean,
  ): void {
    el.style.left = `${left}px`;
    el.style.width = `${width}px`;
    el.classList.toggle('apg-cell-selected', selected);
    el.classList.toggle('apg-cell-active', active);
    el.textContent = column.format(item);
  }
}
