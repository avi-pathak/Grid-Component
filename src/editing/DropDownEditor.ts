import { Column } from '../models/Column';
import { DataMapEditor } from '../models/DataMapEditor';
import { EditorOpenOptions } from './EditorOpenOptions';

/**
 * An in-cell editable dropdown for data-mapped columns. The input sits exactly
 * over the cell (same size and look) with a chevron and a styled list of the
 * map's display values below it, so editing feels like the cell itself opening
 * a dropdown rather than a separate control floating over the grid.
 *
 * Typing filters the list; arrow keys move the highlight; Enter or a click
 * commits. A Menu column is pick-only (read-only input). When the column's
 * DataMap is editable, a typed value that isn't on the list is kept as-is;
 * otherwise the commit snaps back to a matching option.
 */
export class DropDownEditor {
  private root: HTMLElement;
  private input: HTMLInputElement;
  private arrow: HTMLElement;
  private listEl: HTMLElement;
  private options: string[] = [];
  private highlight = -1;
  private editable = false;
  private composing = false;

  constructor(
    private onCommit: (value: string) => void,
    private onCancel: () => void,
  ) {
    this.root = document.createElement('div');
    this.root.className = 'apg-editor apg-editor-dropdown';

    this.input = document.createElement('input');
    this.input.className = 'apg-dd-input';
    this.input.autocomplete = 'off';

    this.arrow = document.createElement('span');
    this.arrow.className = 'apg-dd-arrow';
    this.arrow.setAttribute('aria-hidden', 'true');

    this.listEl = document.createElement('ul');
    this.listEl.className = 'apg-dropdown';

    this.root.append(this.input, this.arrow, this.listEl);

    this.input.addEventListener('input', () => this.filter(this.input.value));
    this.input.addEventListener('compositionstart', () => (this.composing = true));
    this.input.addEventListener('compositionend', () => (this.composing = false));
    this.input.addEventListener('keydown', (e) => this.onKeyDown(e));
    this.input.addEventListener('blur', () => this.commitInput());
    // Commit on mousedown (before the input blurs) so the click isn't lost.
    this.listEl.addEventListener('mousedown', (e) => {
      const li = (e.target as HTMLElement).closest('li');
      if (!li) return;
      e.preventDefault();
      this.onCommit(li.textContent ?? '');
    });
    // Toggle the list from the chevron without losing input focus.
    this.arrow.addEventListener('mousedown', (e) => {
      e.preventDefault();
      this.toggleList();
    });
  }

  open(
    parent: HTMLElement,
    column: Column,
    item: Record<string, unknown>,
    rect: DOMRect,
    opts?: EditorOpenOptions,
  ): void {
    const map = column.dataMap;
    this.editable = map?.isEditable ?? false;
    this.options = map ? map.getDisplayValues(item) : [];
    this.input.readOnly = column.dataMapEditor === DataMapEditor.Menu;
    this.setInvalid(null); // clear any leftover invalid state from a prior edit
    this.root.style.transform = `translate3d(${rect.left}px, ${rect.top}px, 0)`;
    this.root.style.width = `${rect.width}px`;
    this.root.style.height = `${rect.height}px`;
    parent.appendChild(this.root);
    this.input.focus();

    if (opts?.mode === 'quick' && opts.initialChar && !this.input.readOnly) {
      // Quick edit: seed the typed character and filter the list by it.
      this.input.value = opts.initialChar;
      const pos = this.input.value.length;
      this.input.setSelectionRange(pos, pos);
      this.filter(this.input.value);
    } else {
      this.input.value = map ? map.getDisplayValue(column.getValue(item)) : '';
      this.renderList(this.options);
      if (!this.input.readOnly) this.input.select();
    }
  }

  close(): void {
    this.root.remove();
  }

  setInvalid(message: string | null): void {
    this.input.classList.toggle('apg-editor-invalid', message != null);
    if (message) this.input.title = message;
    else this.input.removeAttribute('title');
  }

  private filter(text: string): void {
    const q = text.trim().toLowerCase();
    const matches = q ? this.options.filter((o) => o.toLowerCase().includes(q)) : this.options;
    this.renderList(matches);
  }

  private toggleList(): void {
    if (this.listEl.style.display === 'none') this.renderList(this.options);
    else this.listEl.style.display = 'none';
  }

  private renderList(items: string[]): void {
    this.listEl.innerHTML = '';
    this.highlight = -1;
    const current = this.input.value;
    for (const display of items) {
      const li = document.createElement('li');
      li.className = 'apg-dropdown-option';
      li.textContent = display;
      if (display === current) li.classList.add('apg-dropdown-active');
      this.listEl.appendChild(li);
    }
    this.listEl.style.display = items.length ? '' : 'none';
    this.positionList();
  }

  // Flip the list above the input when there isn't room below it in the scroller.
  private positionList(): void {
    const viewport = this.root.closest('.apg-viewport');
    if (!viewport) return;
    const inputRect = this.input.getBoundingClientRect();
    const vpRect = viewport.getBoundingClientRect();
    const spaceBelow = vpRect.bottom - inputRect.bottom;
    const flip = spaceBelow < this.listEl.offsetHeight && inputRect.top - vpRect.top > spaceBelow;
    this.listEl.classList.toggle('apg-dropdown-up', flip);
  }

  private onKeyDown(e: KeyboardEvent): void {
    // Same IME-safety rule as TextEditor: don't let a composition-confirming
    // Enter/Escape commit or cancel the cell, but still keep the keystroke
    // from leaking to the grid's own keyboard nav.
    if (this.composing || e.isComposing || e.keyCode === 229) {
      e.stopPropagation();
      return;
    }
    const options = [...this.listEl.children] as HTMLElement[];
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      this.move(1, options);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      this.move(-1, options);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const sel = options[this.highlight];
      if (sel) this.onCommit(sel.textContent ?? '');
      else this.commitInput();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      this.onCancel();
    }
    e.stopPropagation();
  }

  private move(delta: number, options: HTMLElement[]): void {
    if (!options.length) return;
    if (this.highlight >= 0) options[this.highlight].classList.remove('apg-dropdown-active');
    this.highlight = (this.highlight + delta + options.length) % options.length;
    const el = options[this.highlight];
    el.classList.add('apg-dropdown-active');
    el.scrollIntoView({ block: 'nearest' });
  }

  // Resolve the typed text on blur/Enter. Editable maps keep free text; fixed
  // maps snap to a matching option, falling back to the only visible one.
  private commitInput(): void {
    const value = this.input.value;
    if (this.editable) {
      this.onCommit(value);
      return;
    }
    const exact = this.options.find((o) => o.toLowerCase() === value.trim().toLowerCase());
    if (exact) {
      this.onCommit(exact);
      return;
    }
    const visible = [...this.listEl.children] as HTMLElement[];
    if (visible.length === 1) this.onCommit(visible[0].textContent ?? '');
    else this.onCancel();
  }
}
