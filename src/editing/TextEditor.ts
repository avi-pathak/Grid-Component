import { Column } from '../models/Column';
import { EditorOpenOptions } from './EditorOpenOptions';

/**
 * A plain text input overlay for editing one cell. Positioned over the active
 * cell, it commits on Enter/blur and cancels on Escape, reporting the result
 * through callbacks so the EditorManager stays in charge of the lifecycle.
 */
const ARROW_DIRECTIONS: Record<string, 'up' | 'down' | 'left' | 'right'> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
};

export class TextEditor {
  private input: HTMLInputElement;
  private composing = false;
  private mode: 'quick' | 'full' = 'full';

  constructor(
    private onCommit: (value: string) => void,
    private onCancel: () => void,
    private showPlaceholders = false,
    private onCommitAndMove?: (value: string, direction: 'up' | 'down' | 'left' | 'right') => void,
  ) {
    this.input = document.createElement('input');
    this.input.className = 'apg-editor';
    this.input.addEventListener('compositionstart', () => (this.composing = true));
    this.input.addEventListener('compositionend', () => (this.composing = false));
    this.input.addEventListener('keydown', (e) => {
      // While an IME composition is in progress, Enter/Escape confirm or
      // cancel the composition itself — they must reach the input, not commit
      // or cancel the cell edit. Still stop propagation so the grid's own
      // keyboard nav never sees composition keystrokes (e.g. arrows used to
      // move a candidate list).
      if (this.composing || e.isComposing || e.keyCode === 229) {
        e.stopPropagation();
        return;
      }
      // Quick edit (typed over a selected cell): arrow keys commit and move
      // the active cell instead of moving the caret through the text, like
      // typing straight into an Excel cell. Full edit (F2/double-click)
      // keeps the caret moving through the text as usual.
      const direction = this.mode === 'quick' ? ARROW_DIRECTIONS[e.key] : undefined;
      if (direction) {
        e.preventDefault();
        this.onCommitAndMove?.(this.input.value, direction);
        e.stopPropagation();
        return;
      }
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

  open(
    parent: HTMLElement,
    column: Column,
    item: Record<string, unknown>,
    rect: DOMRect,
    opts?: EditorOpenOptions,
  ): void {
    this.mode = opts?.mode ?? 'full';
    this.input.type = inputType(column.dataType);
    this.input.className = `apg-editor apg-align-${column.align}`;
    this.input.removeAttribute('title'); // clear any leftover invalid tooltip from a prior edit
    this.input.placeholder = column.placeholder ?? (this.showPlaceholders ? column.header : '');
    this.reposition(rect);
    parent.appendChild(this.input);
    this.input.focus();

    if (opts?.mode === 'quick' && opts.initialChar) {
      // Quick edit: the typed character replaces the value outright, cursor after it.
      this.input.value = opts.initialChar;
      // setSelectionRange throws on non-text input types (e.g. number/date).
      if (this.input.type === 'text') {
        const pos = this.input.value.length;
        this.input.setSelectionRange(pos, pos);
      }
    } else {
      this.input.value = editorValue(column, item);
      if (this.input.type === 'text') this.input.select();
    }
  }

  close(): void {
    this.input.remove();
  }

  reposition(rect: DOMRect): void {
    this.input.style.transform = `translate3d(${rect.left}px, ${rect.top}px, 0)`;
    this.input.style.width = `${rect.width}px`;
    this.input.style.height = `${rect.height}px`;
  }

  finishEdit(): void {
    this.onCommit(this.input.value);
  }

  setInvalid(message: string | null): void {
    this.input.classList.toggle('apg-editor-invalid', message != null);
    if (message) this.input.title = message;
    else this.input.removeAttribute('title');
  }
}

function inputType(dataType: string): string {
  if (dataType === 'Number') return 'number';
  if (dataType === 'Date') return 'date';
  return 'text';
}

function editorValue(column: Column, item: Record<string, unknown>): string {
  const value = column.getValue(item);
  if (value == null) return '';
  if (column.dataType === 'Date' && value instanceof Date) {
    return value.toISOString().slice(0, 10); // yyyy-MM-dd for <input type=date>
  }
  return String(value);
}
