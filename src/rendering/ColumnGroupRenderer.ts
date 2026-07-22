import { RenderContext } from './RenderContext';
import { createEl } from '../utils/DOM';
import { iconEl } from '../utils/icons';
import { ObjectPool } from '../utils/ObjectPool';
import { fillHeaderCell } from './HeaderRenderer';
import { buildColumnGroupLayout, ColumnGroupCell } from '../data/buildColumnGroups';

/**
 * Renders the multi-row column-group header band above the leaf column headers.
 * Each cell — a group span or a blank filler for an ungrouped/shallow column —
 * is a pooled element positioned from the layout: `left`/`width` from the column
 * geometry, `top`/`height` from its header row and row-span. Group cells show the
 * header and, when collapsible, a chevron that toggles the group.
 *
 * Only cells intersecting the visible column window are materialized, so the
 * node count tracks the viewport (times the small, fixed header depth), never the
 * total column count.
 */
export class ColumnGroupRenderer {
  private active = new Map<string, HTMLElement>();
  private pool = new ObjectPool<HTMLElement>(
    () => createEl('div', 'apg-columngroup-cell'),
    (el) => {
      el.textContent = '';
      el.className = 'apg-columngroup-cell';
      el.removeAttribute('data-group');
    },
  );

  constructor(
    private inner: HTMLElement,
    private onToggle: (key: string) => void,
    private rowHeight: number,
  ) {
    this.inner.addEventListener('click', this.onClick);
  }

  /** Height of one group-header row. Changed live by `Grid.setGeometry`. */
  setRowHeight(rowHeight: number): void {
    this.rowHeight = rowHeight;
  }

  render(ctx: RenderContext): void {
    const groups = ctx.columnGroups ?? [];
    const { cells } = buildColumnGroupLayout(ctx.columns, groups);
    const { firstCol, lastCol } = ctx.state;

    const visible = new Map<string, ColumnGroupCell>();
    for (const cell of cells) {
      if (cell.endCol < firstCol || cell.startCol > lastCol) continue;
      visible.set(cell.key, cell);
    }

    for (const [key, el] of this.active) {
      if (!visible.has(key)) {
        el.remove();
        this.pool.release(el);
        this.active.delete(key);
      }
    }

    for (const [key, cell] of visible) {
      let el = this.active.get(key);
      if (!el) {
        el = this.pool.acquire();
        this.inner.appendChild(el);
        this.active.set(key, el);
      }
      this.fill(el, cell, ctx);
    }
  }

  clear(): void {
    for (const el of this.active.values()) {
      el.remove();
      this.pool.release(el);
    }
    this.active.clear();
  }

  dispose(): void {
    this.inner.removeEventListener('click', this.onClick);
    this.clear();
  }

  private fill(el: HTMLElement, cell: ColumnGroupCell, ctx: RenderContext): void {
    const left = ctx.layout.getColLeft(cell.startCol);
    const right = ctx.layout.getColLeft(cell.endCol) + ctx.layout.getColWidth(cell.endCol);
    el.style.left = `${left}px`;
    el.style.width = `${right - left}px`;
    el.style.top = `${cell.row * this.rowHeight}px`;
    el.style.height = `${cell.rowSpan * this.rowHeight}px`;
    el.style.right = '';

    if (!cell.group) {
      // A shallow leaf's own header, drawn here as one tall cell (centered,
      // bordered, sortable/filterable) instead of a blank gap. fillHeaderCell
      // sets left/width from the column, so re-apply our spanning geometry after.
      el.removeAttribute('data-group');
      fillHeaderCell(el, ctx, cell.leafCol ?? cell.startCol);
      // fillHeaderCell rewrote className to `apg-header-cell …`; re-add the band
      // classes so the cell is both a header and a band member, and re-apply the
      // spanning geometry (fillHeaderCell set left/width to the single column).
      el.classList.add('apg-columngroup-cell', 'apg-columngroup-leaf');
      el.style.left = `${left}px`;
      el.style.width = `${right - left}px`;
      el.style.top = `${cell.row * this.rowHeight}px`;
      el.style.height = `${cell.rowSpan * this.rowHeight}px`;
      return;
    }

    const group = cell.group;
    el.className = 'apg-columngroup-cell';
    el.dataset.group = group.key;
    el.textContent = '';

    if (group.collapsible) {
      el.classList.add('apg-collapsible');
      const chevron = iconEl('chevron', 'apg-columngroup-chevron');
      chevron.classList.toggle('apg-columngroup-chevron-open', !group.collapsed);
      el.appendChild(chevron);
    }
    const label = createEl('span', 'apg-columngroup-label');
    label.textContent = group.header;
    el.appendChild(label);
  }

  private readonly onClick = (e: MouseEvent): void => {
    const cell = (e.target as HTMLElement).closest<HTMLElement>('.apg-columngroup-cell');
    if (!cell || !cell.classList.contains('apg-collapsible')) return;
    const key = cell.dataset.group;
    if (key) this.onToggle(key);
  };
}
