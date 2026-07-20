import { createEl } from '../utils/DOM';
import { clamp } from '../utils/Math';
import { Column } from '../models/Column';

export interface EditPopupOptions<T = Record<string, unknown>> {
  columns: Column<T>[];
  item: T;
  onSave: (changes: Map<Column<T>, unknown>) => void;
  onCancel: () => void;
}

/**
 * A floating form with one field per editable column, for row-level editing.
 * Uses the same fixed-overlay pattern as {@link FilterEditor}, appended to
 * `document.body` rather than the transform-positioned cells panel — a
 * multi-field form is typically taller than one row and would be clipped by
 * that panel's `overflow: hidden`.
 *
 * Centered over the grid rather than tethered to the row-header pencil button:
 * the button sits at the far-left edge, so hanging a 260px form off it pushed
 * the popup into the corner, half-covering the rows it edits. `position: fixed`
 * plus viewport-relative {@link DOMRect}s keeps that correct however deeply the
 * grid is nested or whichever ancestor scrolls.
 *
 * Closes on outside click, Escape, or scroll; any of those (or the Cancel
 * button) discards the edit, matching {@link CollectionView.cancelEdit}.
 */
export class EditPopup<T = Record<string, unknown>> {
  private el?: HTMLElement;
  private onCancel?: () => void;

  get isOpen(): boolean {
    return this.el != null;
  }

  /** `bounds` is the grid's viewport rect; the form is centered inside it. */
  open(bounds: DOMRect, opts: EditPopupOptions<T>): void {
    this.close();
    this.onCancel = opts.onCancel;

    const dialog = createEl('div', 'apg-edit-popup');
    const fields = new Map<Column<T>, HTMLInputElement | HTMLSelectElement>();

    for (const column of opts.columns) {
      if (!column.editable) continue;
      const row = createEl('label', 'apg-edit-popup-field');
      const label = createEl('span', 'apg-edit-popup-label');
      label.textContent = column.header;
      row.appendChild(label);

      const input = fieldFor(column, opts.item);
      row.appendChild(input);
      dialog.appendChild(row);
      fields.set(column, input);
    }

    const footer = createEl('div', 'apg-edit-popup-footer');
    const cancelBtn = createEl('button', 'apg-edit-popup-cancel');
    cancelBtn.type = 'button';
    cancelBtn.textContent = 'Cancel';
    const saveBtn = createEl('button', 'apg-edit-popup-save');
    saveBtn.type = 'button';
    saveBtn.textContent = 'Save';
    footer.append(cancelBtn, saveBtn);
    dialog.appendChild(footer);

    cancelBtn.addEventListener('click', () => this.cancel());
    saveBtn.addEventListener('click', () => {
      const changes = new Map<Column<T>, unknown>();
      for (const [column, input] of fields) {
        const raw =
          input instanceof HTMLInputElement && input.type === 'checkbox'
            ? String(input.checked)
            : input.value;
        const { value } = column.tryParse(raw);
        if (value !== column.getValue(opts.item)) changes.set(column, value);
      }
      this.close();
      opts.onSave(changes);
    });

    document.body.appendChild(dialog);
    const r = dialog.getBoundingClientRect();
    // Center on the grid, then clamp so a grid taller/wider than the window —
    // or scrolled partly out of view — can never push the form off-screen.
    const left = bounds.left + (bounds.width - r.width) / 2;
    const top = bounds.top + (bounds.height - r.height) / 2;
    dialog.style.left = `${clamp(left, 8, Math.max(8, window.innerWidth - r.width - 8))}px`;
    dialog.style.top = `${clamp(top, 8, Math.max(8, window.innerHeight - r.height - 8))}px`;
    this.el = dialog;

    dialog.querySelector<HTMLElement>('input, select')?.focus();

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
    this.onCancel = undefined;
    window.removeEventListener('mousedown', this.onOutside, true);
    window.removeEventListener('keydown', this.onKey, true);
    window.removeEventListener('scroll', this.onScroll, true);
  };

  private cancel(): void {
    const onCancel = this.onCancel;
    this.close();
    onCancel?.();
  }

  private readonly onOutside = (e: MouseEvent): void => {
    if (this.el && !this.el.contains(e.target as Node)) this.cancel();
  };

  // Close when the grid (or page) scrolls, but not when something inside the
  // dialog itself scrolls (it has no internal scroller today, but matches
  // FilterEditor's guard for consistency).
  private readonly onScroll = (e: Event): void => {
    if (this.el && !this.el.contains(e.target as Node)) this.cancel();
  };

  private readonly onKey = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') this.cancel();
  };
}

function fieldFor<T>(column: Column<T>, item: T): HTMLInputElement | HTMLSelectElement {
  if (column.dataMap) {
    const select = createEl('select');
    const current = column.dataMap.getDisplayValue(column.getValue(item));
    for (const display of column.dataMap.getDisplayValues(item)) {
      const option = createEl('option');
      option.value = display;
      option.textContent = display;
      if (display === current) option.selected = true;
      select.appendChild(option);
    }
    return select;
  }
  const input = createEl('input');
  if (column.dataType === 'Boolean') {
    input.type = 'checkbox';
    input.checked = column.getValue(item) === true;
  } else {
    input.type =
      column.dataType === 'Number' ? 'number' : column.dataType === 'Date' ? 'date' : 'text';
    input.value = fieldValue(column, item);
  }
  return input;
}

function fieldValue<T>(column: Column<T>, item: T): string {
  const value = column.getValue(item);
  if (value == null) return '';
  if (column.dataType === 'Date' && value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value);
}
