import { Column } from '../models/Column';

/**
 * A `<select>` overlay for editing a cell whose column has a `dataMap`. Mirrors
 * the TextEditor interface so the EditorManager can swap them. Commits the
 * selected option's key, which the column parses back into the real value.
 */
export class ComboEditor {
  private select: HTMLSelectElement;

  constructor(
    private onCommit: (value: string) => void,
    private onCancel: () => void,
  ) {
    this.select = document.createElement('select');
    this.select.className = 'apg-editor apg-editor-combo';
    this.select.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        this.onCommit(this.select.value);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        this.onCancel();
      }
      e.stopPropagation();
    });
    this.select.addEventListener('change', () => this.onCommit(this.select.value));
    this.select.addEventListener('blur', () => this.onCommit(this.select.value));
  }

  open(parent: HTMLElement, column: Column, item: Record<string, unknown>, rect: DOMRect): void {
    const options = column.dataMap ?? [];
    const current = String(column.getValue(item));
    this.select.innerHTML = '';
    for (const opt of options) {
      const el = document.createElement('option');
      el.value = opt.key;
      el.textContent = opt.text;
      if (opt.key === current) el.selected = true;
      this.select.appendChild(el);
    }
    this.select.style.transform = `translate3d(${rect.left}px, ${rect.top}px, 0)`;
    this.select.style.width = `${rect.width}px`;
    this.select.style.height = `${rect.height}px`;
    parent.appendChild(this.select);
    this.select.focus();
    this.showPicker();
  }

  close(): void {
    this.select.remove();
  }

  // Pop the dropdown open on entering edit mode. showPicker throws when there's
  // no user gesture (e.g. programmatic editCell) or where it isn't supported, so
  // the focused select stays usable in that case.
  private showPicker(): void {
    if (typeof this.select.showPicker !== 'function') return;
    try {
      this.select.showPicker();
    } catch {
      // ignore — no user activation or unsupported
    }
  }
}
