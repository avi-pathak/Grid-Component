import { Column } from '../models/Column';

let nextId = 0;

/**
 * A radio-button panel for data-mapped columns. Renders one radio per display
 * value below the cell and commits the chosen value on selection. Escape cancels;
 * moving focus out of the panel cancels too. Mirrors the other editors' interface.
 */
export class RadioEditor {
  private root: HTMLElement;
  private name: string;

  constructor(
    private onCommit: (value: string) => void,
    private onCancel: () => void,
  ) {
    this.name = `apg-radio-${nextId++}`;
    this.root = document.createElement('div');
    this.root.className = 'apg-editor apg-editor-radio';
    this.root.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        this.onCancel();
      }
      e.stopPropagation();
    });
    this.root.addEventListener('focusout', (e) => {
      const next = e.relatedTarget as Node | null;
      if (!next || !this.root.contains(next)) this.onCancel();
    });
  }

  open(parent: HTMLElement, column: Column, item: Record<string, unknown>, rect: DOMRect): void {
    const map = column.dataMap;
    const current = map ? map.getDisplayValue(column.getValue(item)) : '';
    this.root.innerHTML = '';
    for (const display of map ? map.getDisplayValues(item) : []) {
      const label = document.createElement('label');
      label.className = 'apg-radio-option';
      const radio = document.createElement('input');
      radio.type = 'radio';
      radio.name = this.name;
      radio.value = display;
      radio.checked = display === current;
      radio.addEventListener('change', () => this.onCommit(display));
      label.append(radio, document.createTextNode(` ${display}`));
      this.root.appendChild(label);
    }
    this.root.style.transform = `translate3d(${rect.left}px, ${rect.top}px, 0)`;
    this.root.style.minWidth = `${rect.width}px`;
    parent.appendChild(this.root);
    const focusTarget =
      this.root.querySelector<HTMLElement>('input:checked') ??
      this.root.querySelector<HTMLElement>('input');
    focusTarget?.focus();
  }

  close(): void {
    this.root.remove();
  }
}
