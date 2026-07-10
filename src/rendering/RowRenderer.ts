import { RenderContext } from './RenderContext';
import { CellRenderer } from './CellRenderer';
import { createEl, setTransform, setConditionalStyle } from '../utils/DOM';
import { iconEl } from '../utils/icons';
import { ObjectPool } from '../utils/ObjectPool';
import { computeAggregate } from '../data/aggregate';

interface RowView {
  el: HTMLElement;
  cells: Map<number, HTMLElement>;
  kind: 'data' | 'group';
  label?: HTMLElement;
}

/**
 * Keeps one pooled `.apg-row` per visible row and one pooled `.apg-cell` per
 * visible column inside it. On each pass it releases rows and cells that left
 * the range and reuses them for the ones that entered — the DOM never grows
 * past the visible window plus its buffer. Group-header rows take a separate
 * path: a sticky label plus aggregate cells instead of data cells.
 */
export class RowRenderer {
  private active = new Map<number, RowView>();
  private rowClasses = new WeakMap<HTMLElement, string[]>();
  private rowPool = new ObjectPool<HTMLElement>(
    () => createEl('div', 'apg-row'),
    (el) => {
      el.className = 'apg-row';
      el.style.width = '';
      el.style.top = '';
      el.style.transform = '';
      el.style.willChange = '';
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
      const kind = ctx.data.rowType(row);
      let view = this.active.get(row);
      if (view && view.kind !== kind) {
        this.releaseRow(view);
        this.active.delete(row);
        view = undefined;
      }
      if (!view) {
        view = this.acquireRow(row, ctx, kind);
        this.active.set(row, view);
      }
      if (kind === 'group') this.fillGroup(view, row, ctx);
      else this.fillCells(view, row, ctx);
    }
  }

  clear(): void {
    for (const view of this.active.values()) this.releaseRow(view);
    this.active.clear();
  }

  private acquireRow(row: number, ctx: RenderContext, kind: 'data' | 'group'): RowView {
    const el = this.rowPool.acquire();
    const top = ctx.layout.getRowTop(row);
    el.style.height = `${ctx.layout.getRowHeight(row)}px`;

    if (kind === 'group') {
      // Positioned with `top` (not transform) so the sticky label inside is free
      // of a transformed ancestor, which some browsers won't pin.
      el.classList.add('apg-group-row');
      el.style.width = `${ctx.layout.totalWidth}px`;
      el.style.willChange = 'auto';
      el.style.top = `${top}px`;
      const label = createEl('div', 'apg-group-label');
      el.appendChild(label);
      this.canvas.appendChild(el);
      return { el, cells: new Map(), kind, label };
    }

    const step = ctx.state.alternatingRowStep;
    el.classList.toggle('apg-row-alt', step > 0 && Math.floor(row / step) % 2 === 1);
    setTransform(el, 0, top);
    this.canvas.appendChild(el);
    return { el, cells: new Map(), kind };
  }

  private fillGroup(view: RowView, row: number, ctx: RenderContext): void {
    const gr = ctx.data.groupRow(row);
    const label = view.label;
    if (!gr || !label) return;

    label.style.paddingLeft = `${gr.level * 20 + 8}px`;
    label.textContent = '';

    const toggle = iconEl('chevron', 'apg-group-toggle');
    toggle.classList.toggle('apg-group-toggle-open', !gr.collapsed);
    label.appendChild(toggle);

    const inner = createEl('span', 'apg-group-inner');
    if (ctx.groupHeaderTemplate) {
      const out = ctx.groupHeaderTemplate({
        group: gr.group,
        level: gr.level,
        collapsed: gr.collapsed,
        itemCount: gr.group.itemCount,
      });
      if (typeof out === 'string') inner.innerHTML = out;
      else inner.appendChild(out);
    } else {
      const name = createEl('span', 'apg-group-name');
      name.textContent = gr.group.name;
      const count = createEl('span', 'apg-group-count');
      count.textContent = String(gr.group.itemCount);
      inner.append(name, count);
    }
    label.appendChild(inner);

    const { firstCol, lastCol } = ctx.state;
    for (const [col, el] of view.cells) {
      if (col < firstCol || col > lastCol || !ctx.columns[col].aggregate) {
        el.remove();
        view.cells.delete(col);
      }
    }
    for (let col = firstCol; col <= lastCol; col++) {
      const column = ctx.columns[col];
      if (!column.aggregate) continue;
      let cell = view.cells.get(col);
      if (!cell) {
        cell = createEl('div', 'apg-group-agg');
        view.el.appendChild(cell);
        view.cells.set(col, cell);
      }
      cell.className = `apg-group-agg apg-align-${column.align}`;
      cell.style.left = `${ctx.layout.getColLeft(col)}px`;
      cell.style.width = `${ctx.layout.getColWidth(col)}px`;
      const value = computeAggregate(gr.group.items, column.aggregate, (it) => column.getValue(it));
      cell.textContent = value == null ? '' : column.formatValue(value);
    }
  }

  private fillCells(view: RowView, row: number, ctx: RenderContext): void {
    const { firstCol, lastCol, selection, activeCell } = ctx.state;
    const item = ctx.data.item(row) as Record<string, unknown>;
    const rowSelected = selection != null && row >= selection.topRow && row <= selection.bottomRow;
    const activeCol = activeCell && activeCell.row === row ? activeCell.col : -1;

    this.applyRowStyle(view.el, row, item, ctx);

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
        row,
        ctx.layout.getColLeft(col),
        ctx.layout.getColWidth(col),
        selected,
        col === activeCol,
      );
    }
  }

  private releaseRow(view: RowView): void {
    if (view.kind === 'group') {
      for (const cellEl of view.cells.values()) cellEl.remove();
      view.label?.remove();
    } else {
      for (const cellEl of view.cells.values()) this.cells.release(cellEl);
    }
    view.cells.clear();
    this.rowPool.release(view.el);
    view.el.remove();
  }

  // Apply the optional row-level conditional class(es) and styles. Previously
  // applied classes are tracked so recycled rows reset instead of accumulating.
  private applyRowStyle(
    el: HTMLElement,
    row: number,
    item: Record<string, unknown>,
    ctx: RenderContext,
  ): void {
    if (ctx.rowClass || this.rowClasses.has(el)) {
      const prev = this.rowClasses.get(el);
      if (prev) el.classList.remove(...prev);
      const resolved = ctx.rowClass ? resolveRowValue(ctx.rowClass, { item, row }) : undefined;
      const classes = toClassList(resolved);
      if (classes.length) {
        el.classList.add(...classes);
        this.rowClasses.set(el, classes);
      } else {
        this.rowClasses.delete(el);
      }
    }
    const style = ctx.rowStyle ? resolveRowValue(ctx.rowStyle, { item, row }) : null;
    setConditionalStyle(el, (style as Record<string, string>) ?? null);
  }
}

function resolveRowValue<V>(
  def: V | ((ctx: { item: Record<string, unknown>; row: number }) => V),
  ctx: { item: Record<string, unknown>; row: number },
): V {
  return typeof def === 'function' ? (def as (c: typeof ctx) => V)(ctx) : def;
}

function toClassList(value: string | string[] | null | undefined): string[] {
  if (!value) return [];
  const list = Array.isArray(value) ? value : [value];
  const out: string[] = [];
  for (const entry of list) for (const token of entry.split(/\s+/)) if (token) out.push(token);
  return out;
}
