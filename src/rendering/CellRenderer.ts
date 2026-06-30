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
    row: number,
    left: number,
    width: number,
    selected: boolean,
    active: boolean,
  ): void {
    el.style.left = `${left}px`;
    el.style.width = `${width}px`;
    el.className = `apg-cell apg-align-${column.align}`;
    if (selected) el.classList.add('apg-cell-selected');
    if (active) el.classList.add('apg-cell-active');

    if (column.cellTemplate) {
      el.classList.add('apg-cell-template');
      el.innerHTML = column.cellTemplate({ value: column.getValue(item), item, row, column });
    } else if (column.dataType === 'Boolean') {
      el.classList.add('apg-cell-bool');
      el.classList.toggle('apg-checked', column.getValue(item) === true);
      el.textContent = '';
    } else {
      // Mapped, editable cells get a chevron so they read as dropdowns at rest.
      if (column.dataMap && column.editable) el.classList.add('apg-cell-dropdown');
      el.textContent = column.format(item);
    }
  }
}
