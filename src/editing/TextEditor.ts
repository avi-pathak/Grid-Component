import { Column } from '../models/Column';

/**
 * A plain text input overlay for editing one cell. Positioned over the active
 * cell, it commits on Enter/blur and cancels on Escape, reporting the result
 * through callbacks so the EditorManager stays in charge of the lifecycle.
 */
export class TextEditor {
  private input: HTMLInputElement;

  constructor(
    private onCommit: (value: string) => void,
    private onCancel: () => void,
  ) {
    this.input = document.createElement('input');
    this.input.className = 'apg-editor';
    this.input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        this.onCommit(this.input.value);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        this.onCancel();
      }
      e.stopPropagation();
    });
    this.input.addEventListener('blur', () => this.onCommit(this.input.value));
  }

  open(parent: HTMLElement, column: Column, item: Record<string, unknown>, rect: DOMRect): void {
    this.input.value = String(column.getValue(item) ?? '');
    this.input.style.transform = `translate3d(${rect.left}px, ${rect.top}px, 0)`;
    this.input.style.width = `${rect.width}px`;
    this.input.style.height = `${rect.height}px`;
    parent.appendChild(this.input);
    this.input.focus();
    this.input.select();
  }

  close(): void {
    this.input.remove();
  }
}
