import { createEl } from '../utils/DOM';
import { iconEl } from '../utils/icons';
import { applyThemeScope } from '../utils/theme-scope';
import { Column } from '../models/Column';
import {
  ColumnFilter,
  FilterCondition,
  FilterOperator,
  operatorsFor,
} from '../models/ColumnFilter';

export interface FilterDraft {
  values: Set<string> | null;
  condition: FilterCondition | null;
}

export interface FilterEditorOptions<T> {
  column: Column<T>;
  values: string[];
  filter: ColumnFilter<T>;
  /** Show the Sort Ascending/Descending shortcuts. */
  showSort: boolean;
  /** Current sort direction for this column, or null when unsorted. */
  sort: 'asc' | 'desc' | null;
  onSort: (dir: boolean | null) => void;
  onApply: (draft: FilterDraft) => void;
  onClear: () => void;
}

// Operators that ignore the value input.
const VALUELESS: FilterOperator[] = ['empty', 'notEmpty'];

/**
 * The column filter popup: an operator/value condition on top and an
 * Excel-style "filter by value" checklist below, with a search box, Select All,
 * and Clear/Apply. Floats near the header's filter button and closes on outside
 * click, Escape, or scroll.
 */
export class FilterEditor<T = Record<string, unknown>> {
  private el?: HTMLElement;

  /** `themeSource` is any element inside the owning grid, used to carry its
   *  theme classes onto the body-mounted dialog. */
  constructor(private themeSource?: HTMLElement) {}

  get isOpen(): boolean {
    return this.el != null;
  }

  open(anchor: DOMRect, opts: FilterEditorOptions<T>): void {
    this.close();
    const { column, values, filter } = opts;

    const selected = new Set(filter.values ?? values);
    let condOp: FilterOperator = filter.condition?.op ?? operatorsFor(column)[0].op;
    let condValue = filter.condition?.value ?? '';

    const dialog = createEl('div', 'apg-filter-dialog');

    // Sort shortcuts, like a column menu. Clicking the active direction clears it.
    if (opts.showSort) {
      const sortRow = createEl('div', 'apg-filter-sort');
      const makeSort = (dir: 'asc' | 'desc', label: string): HTMLButtonElement => {
        const btn = createEl('button', 'apg-filter-sort-btn');
        btn.type = 'button';
        if (opts.sort === dir) btn.classList.add('apg-filter-sort-active');
        btn.appendChild(iconEl(dir === 'asc' ? 'sortAsc' : 'sortDesc'));
        const text = createEl('span');
        text.textContent = label;
        btn.appendChild(text);
        btn.addEventListener('click', () => {
          this.close();
          opts.onSort(opts.sort === dir ? null : dir === 'asc');
        });
        return btn;
      };
      sortRow.append(makeSort('asc', 'Sort Ascending'), makeSort('desc', 'Sort Descending'));
      dialog.appendChild(sortRow);
      dialog.appendChild(createEl('div', 'apg-filter-sep'));
    }

    // Condition row (skipped for Boolean, which only makes sense as a value list).
    let valueInput: HTMLInputElement | undefined;
    if (column.dataType !== 'Boolean') {
      const section = createEl('div', 'apg-filter-section');
      const opSelect = createEl('select', 'apg-filter-op');
      for (const choice of operatorsFor(column)) {
        const o = createEl('option');
        o.value = choice.op;
        o.textContent = choice.label;
        if (choice.op === condOp) o.selected = true;
        opSelect.appendChild(o);
      }
      valueInput = createEl('input', 'apg-filter-value');
      valueInput.type =
        column.dataType === 'Number' ? 'number' : column.dataType === 'Date' ? 'date' : 'text';
      valueInput.placeholder = 'Value';
      valueInput.value = condValue;
      valueInput.style.display = VALUELESS.includes(condOp) ? 'none' : '';
      opSelect.addEventListener('change', () => {
        condOp = opSelect.value as FilterOperator;
        valueInput!.style.display = VALUELESS.includes(condOp) ? 'none' : '';
      });
      valueInput.addEventListener('input', () => (condValue = valueInput!.value));
      section.append(opSelect, valueInput);
      dialog.appendChild(section);
      dialog.appendChild(createEl('div', 'apg-filter-sep'));
    }

    // Value checklist with search + select all.
    const search = createEl('input', 'apg-filter-search');
    search.type = 'search';
    search.placeholder = 'Search values';
    dialog.appendChild(search);

    const selectAllRow = createEl('label', 'apg-filter-selectall');
    const selectAll = createEl('input');
    selectAll.type = 'checkbox';
    const selectAllText = createEl('span');
    selectAllText.textContent = '(Select all)';
    selectAllRow.append(selectAll, selectAllText);
    dialog.appendChild(selectAllRow);

    const list = createEl('div', 'apg-filter-list');
    const boxes = new Map<string, HTMLInputElement>();
    for (const v of values) {
      const row = createEl('label', 'apg-filter-item');
      const box = createEl('input');
      box.type = 'checkbox';
      box.checked = selected.has(v);
      box.addEventListener('change', () => {
        if (box.checked) selected.add(v);
        else selected.delete(v);
        syncSelectAll();
      });
      const text = createEl('span');
      text.textContent = v === '' ? '(Blanks)' : v;
      row.append(box, text);
      list.appendChild(row);
      boxes.set(v, box);
    }
    dialog.appendChild(list);

    const syncSelectAll = (): void => {
      const visible = values.filter((v) => boxes.get(v)!.parentElement!.style.display !== 'none');
      const on = visible.filter((v) => selected.has(v)).length;
      selectAll.checked = on > 0 && on === visible.length;
      selectAll.indeterminate = on > 0 && on < visible.length;
    };
    selectAll.addEventListener('change', () => {
      for (const v of values) {
        const box = boxes.get(v)!;
        if (box.parentElement!.style.display === 'none') continue;
        box.checked = selectAll.checked;
        if (selectAll.checked) selected.add(v);
        else selected.delete(v);
      }
    });
    search.addEventListener('input', () => {
      const q = search.value.trim().toLowerCase();
      for (const v of values) {
        const match = v.toLowerCase().includes(q);
        boxes.get(v)!.parentElement!.style.display = match ? '' : 'none';
      }
      syncSelectAll();
    });
    syncSelectAll();

    // Footer buttons.
    const footer = createEl('div', 'apg-filter-footer');
    const clearBtn = createEl('button', 'apg-filter-clear');
    clearBtn.type = 'button';
    clearBtn.textContent = 'Clear';
    const applyBtn = createEl('button', 'apg-filter-apply');
    applyBtn.type = 'button';
    applyBtn.textContent = 'Apply';
    footer.append(clearBtn, applyBtn);
    dialog.appendChild(footer);

    clearBtn.addEventListener('click', () => {
      this.close();
      opts.onClear();
    });
    applyBtn.addEventListener('click', () => {
      const allOn = selected.size === values.length;
      const draft: FilterDraft = {
        values: allOn ? null : new Set(selected),
        condition: buildCondition(condOp, condValue),
      };
      this.close();
      opts.onApply(draft);
    });

    applyThemeScope(dialog, this.themeSource ?? null);
    document.body.appendChild(dialog);
    const r = dialog.getBoundingClientRect();
    const left = Math.max(4, Math.min(anchor.left, window.innerWidth - r.width - 8));
    const top = Math.max(4, Math.min(anchor.bottom + 4, window.innerHeight - r.height - 8));
    dialog.style.left = `${left}px`;
    dialog.style.top = `${top}px`;
    this.el = dialog;

    setTimeout(() => {
      if (!this.el) return; // closed before the timeout fired
      window.addEventListener('mousedown', this.onOutside, true);
      window.addEventListener('keydown', this.onKey, true);
      window.addEventListener('scroll', this.onScroll, true);
    });
  }

  readonly close = (): void => {
    if (!this.el) return;
    this.el.remove();
    this.el = undefined;
    window.removeEventListener('mousedown', this.onOutside, true);
    window.removeEventListener('keydown', this.onKey, true);
    window.removeEventListener('scroll', this.onScroll, true);
  };

  private readonly onOutside = (e: MouseEvent): void => {
    if (this.el && !this.el.contains(e.target as Node)) this.close();
  };

  // Close when the grid (or page) scrolls, but not when the value list inside
  // the dialog scrolls.
  private readonly onScroll = (e: Event): void => {
    if (this.el && !this.el.contains(e.target as Node)) this.close();
  };

  private readonly onKey = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') this.close();
  };
}

function buildCondition(op: FilterOperator, value: string): FilterCondition | null {
  if (VALUELESS.includes(op)) return { op, value: '' };
  return value.trim() !== '' ? { op, value } : null;
}
