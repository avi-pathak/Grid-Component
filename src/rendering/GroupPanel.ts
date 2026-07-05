import { createEl } from '../utils/DOM';
import { iconEl } from '../utils/icons';
import { ContextMenu, MenuEntry } from './ContextMenu';

export interface GroupChip {
  binding: string;
  header: string;
  sort: 'asc' | 'desc' | null;
}

/**
 * Toggles for the grouping bar. Everything defaults to enabled; set a field to
 * false to remove that capability. Passed via the grid's `groupPanel` option,
 * which also accepts `true` (all defaults) or `false` (no panel).
 *
 * Purely visual bits are not flags here — hide them with CSS instead: the bar
 * icon is `.apg-grouppanel-icon` and each chip's drag grip is
 * `.apg-group-chip-grip` (e.g. `.apg-group-chip-grip { display: none }`).
 */
export interface GroupPanelOptions {
  /** Text shown when no columns are grouped. */
  placeholder?: string;
  /** Maximum number of grouping levels. Default 6. */
  maxGroups?: number;
  /** Drag a column header into the bar to group by it. Default true. */
  allowDragToGroup?: boolean;
  /** Drag chips to reorder grouping levels. Default true. */
  allowReorder?: boolean;
  /** Click a chip (or use the menu) to sort the level. Default true. */
  allowSort?: boolean;
  /** Remove a level with its ✕ (or the menu). Default true. */
  allowRemove?: boolean;
  /** Right-click a chip for a menu of grouping actions. Default true. */
  contextMenu?: boolean;
}

/** Fully-resolved {@link GroupPanelOptions}; every field is set. */
export interface ResolvedGroupPanel {
  placeholder: string;
  maxGroups: number;
  allowDragToGroup: boolean;
  allowReorder: boolean;
  allowSort: boolean;
  allowRemove: boolean;
  contextMenu: boolean;
}

export interface GroupPanelCallbacks {
  chips: () => GroupChip[];
  onRemove: (binding: string) => void;
  onReorder: (from: number, to: number) => void;
  onToggleSort: (binding: string) => void;
  /** Set a level's sort explicitly: true = ascending, false = descending, null = clear. */
  onSort: (binding: string, dir: boolean | null) => void;
  onExpandAll: () => void;
  onCollapseAll: () => void;
}

const THRESHOLD = 4; // pixels before a chip press becomes a reorder drag

/**
 * The grouping bar. Shows a chip per active group level — each with a drag grip,
 * its sort direction, and a remove button — separated by chevrons to read as a
 * hierarchy. Users can reorder levels by dragging chips, toggle a level's sort
 * by clicking it, remove a level with its ✕, and right-click a chip for a menu
 * of grouping actions. Each of these is individually switchable through
 * {@link ResolvedGroupPanel}. Dropping a column header onto the bar is handled by
 * the header dragger, which uses {@link hostElement} as the drop zone and
 * {@link highlight} to show it.
 */
export class GroupPanel {
  private list: HTMLElement;
  private placeholderEl: HTMLElement;
  private marker = createEl('div', 'apg-group-chip-marker');
  private menu = new ContextMenu();
  private dragFrom = -1;
  private dragging = false;
  private startX = 0;
  private insertAt = 0;

  constructor(
    private host: HTMLElement,
    private cb: GroupPanelCallbacks,
    private opts: ResolvedGroupPanel,
  ) {
    this.host.appendChild(iconEl('group', 'apg-grouppanel-icon'));
    this.placeholderEl = createEl('span', 'apg-group-placeholder');
    this.placeholderEl.textContent = opts.placeholder;
    this.list = createEl('div', 'apg-group-chips');
    this.host.append(this.placeholderEl, this.list);
    this.host.addEventListener('mousedown', this.onDown);
    this.host.addEventListener('click', this.onClick);
    if (opts.contextMenu) this.host.addEventListener('contextmenu', this.onContextMenu);
    this.render();
  }

  get hostElement(): HTMLElement {
    return this.host;
  }

  highlight(on: boolean): void {
    this.host.classList.toggle('apg-grouppanel-over', on);
  }

  render(): void {
    const chips = this.cb.chips();
    this.placeholderEl.style.display = chips.length ? 'none' : '';
    this.list.textContent = '';
    chips.forEach((chip, i) => {
      if (i > 0) this.list.appendChild(iconEl('chevron', 'apg-group-sep'));

      const el = createEl('div', 'apg-group-chip');
      el.dataset.index = String(i);
      el.dataset.binding = chip.binding;
      // Leave the grab cursor to CSS when reorderable (so :active shows grabbing);
      // otherwise reflect what a click does.
      if (!this.opts.allowReorder) el.style.cursor = this.opts.allowSort ? 'pointer' : 'default';

      el.appendChild(iconEl('dragHandle', 'apg-group-chip-grip'));

      const label = createEl('span', 'apg-group-chip-label');
      label.textContent = chip.header;
      el.appendChild(label);

      if (this.opts.allowSort && chip.sort) {
        el.appendChild(iconEl(chip.sort === 'asc' ? 'sortAsc' : 'sortDesc', 'apg-group-chip-sort'));
      }

      if (this.opts.allowRemove) {
        const remove = createEl('button', 'apg-group-chip-remove');
        remove.type = 'button';
        remove.dataset.remove = chip.binding;
        remove.title = `Remove ${chip.header} grouping`;
        remove.appendChild(iconEl('close'));
        el.appendChild(remove);
      }

      this.list.appendChild(el);
    });
  }

  dispose(): void {
    this.host.removeEventListener('mousedown', this.onDown);
    this.host.removeEventListener('click', this.onClick);
    this.host.removeEventListener('contextmenu', this.onContextMenu);
    this.menu.close();
    window.removeEventListener('mousemove', this.onMove);
    window.removeEventListener('mouseup', this.onUp);
    this.marker.remove();
    this.host.textContent = '';
  }

  // Right-click a chip: a menu of grouping actions, like a spreadsheet grid.
  // Sort/remove entries follow the same toggles as the chip controls.
  private readonly onContextMenu = (e: MouseEvent): void => {
    const chip = (e.target as HTMLElement).closest('.apg-group-chip') as HTMLElement | null;
    const binding = chip?.dataset.binding;
    if (!binding) return;
    e.preventDefault();
    const sorted = this.cb.chips().find((c) => c.binding === binding)?.sort ?? null;
    const items: MenuEntry[] = [
      { label: 'Expand All', icon: 'caretUp', action: () => this.cb.onExpandAll() },
      { label: 'Collapse All', icon: 'caretRight', action: () => this.cb.onCollapseAll() },
    ];
    if (this.opts.allowSort) {
      items.push(
        'separator',
        { label: 'Sort Ascending', icon: 'sortAsc', action: () => this.cb.onSort(binding, true) },
        {
          label: 'Sort Descending',
          icon: 'sortDesc',
          action: () => this.cb.onSort(binding, false),
        },
        {
          label: 'Remove Sort',
          icon: 'dot',
          disabled: sorted == null,
          action: () => this.cb.onSort(binding, null),
        },
      );
    }
    if (this.opts.allowRemove) {
      items.push('separator', {
        label: 'Remove Group',
        icon: 'close',
        action: () => this.cb.onRemove(binding),
      });
    }
    this.menu.open(e.clientX, e.clientY, items);
  };

  private readonly onClick = (e: MouseEvent): void => {
    if (this.dragging) return;
    const target = e.target as HTMLElement;
    const removeEl = target.closest('[data-remove]') as HTMLElement | null;
    if (removeEl?.dataset.remove != null) {
      this.cb.onRemove(removeEl.dataset.remove);
      return;
    }
    if (!this.opts.allowSort) return;
    const chip = target.closest('.apg-group-chip') as HTMLElement | null;
    if (chip?.dataset.binding) this.cb.onToggleSort(chip.dataset.binding);
  };

  private readonly onDown = (e: MouseEvent): void => {
    if (e.button !== 0 || !this.opts.allowReorder) return;
    const target = e.target as HTMLElement;
    if (target.closest('[data-remove]')) return; // the ✕ is a click, not a drag
    const chip = target.closest('.apg-group-chip') as HTMLElement | null;
    if (!chip) return;
    this.dragFrom = Number(chip.dataset.index);
    this.startX = e.clientX;
    this.dragging = false;
    window.addEventListener('mousemove', this.onMove);
    window.addEventListener('mouseup', this.onUp);
  };

  private readonly onMove = (e: MouseEvent): void => {
    if (!this.dragging) {
      if (Math.abs(e.clientX - this.startX) < THRESHOLD) return;
      this.dragging = true;
      this.host.classList.add('apg-grouppanel-reordering');
    }
    const chipEls = [...this.list.querySelectorAll('.apg-group-chip')] as HTMLElement[];
    let idx = chipEls.length;
    for (let i = 0; i < chipEls.length; i++) {
      const r = chipEls[i].getBoundingClientRect();
      if (e.clientX < r.left + r.width / 2) {
        idx = i;
        break;
      }
    }
    this.insertAt = idx;
    if (idx < chipEls.length) this.list.insertBefore(this.marker, chipEls[idx]);
    else this.list.appendChild(this.marker);
  };

  private readonly onUp = (): void => {
    window.removeEventListener('mousemove', this.onMove);
    window.removeEventListener('mouseup', this.onUp);
    this.host.classList.remove('apg-grouppanel-reordering');
    if (this.dragging) {
      this.marker.remove();
      const to = this.insertAt > this.dragFrom ? this.insertAt - 1 : this.insertAt;
      if (this.dragFrom >= 0 && to !== this.dragFrom) this.cb.onReorder(this.dragFrom, to);
    }
    this.dragFrom = -1;
    // Let the click that follows this mouseup see dragging=true so a reorder
    // doesn't also toggle sort, then clear it.
    setTimeout(() => (this.dragging = false), 0);
  };
}
