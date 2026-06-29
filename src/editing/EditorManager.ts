import { TextEditor } from './TextEditor';
import { Column } from '../models/Column';
import { DataView } from '../data/DataView';
import { LayoutEngine } from '../virtualization/LayoutEngine';
import { CellAddress } from '../models/Cell';
import { UndoStack } from '../commands/UndoStack';
import { EditAction } from '../commands/EditAction';

export interface EditorDeps {
  viewport: HTMLElement;
  layout: LayoutEngine;
  data: DataView;
  columns: Column[];
  undo: UndoStack;
  gutterLeft: number;
  gutterTop: number;
  onApplied: () => void;
  onStart: (cell: CellAddress) => void;
  onEnd: (cell: CellAddress) => void;
}

/** Begins, commits, and cancels cell edits; commits run through the undo stack. */
export class EditorManager {
  private editor: TextEditor;
  private editing: CellAddress | null = null;

  constructor(private deps: EditorDeps) {
    this.editor = new TextEditor(
      (value) => this.commit(value),
      () => this.cancel(),
    );
  }

  get isEditing(): boolean {
    return this.editing != null;
  }

  /** Flip a Boolean cell's value through the undo stack. Returns true if handled. */
  toggleBoolean(cell: CellAddress): boolean {
    const column = this.deps.columns[cell.col];
    if (!column || !column.editable || column.dataType !== 'Boolean') return false;
    const item = this.deps.data.item(cell.row);
    const oldValue = column.getValue(item) === true;
    this.deps.undo.push(
      new EditAction(this.deps.data, column, cell.row, oldValue, !oldValue, this.deps.onApplied),
    );
    column.setValue(item, !oldValue);
    this.deps.onApplied();
    return true;
  }

  begin(cell: CellAddress): void {
    const column = this.deps.columns[cell.col];
    if (!column || !column.editable || column.dataType === 'Boolean' || this.editing) return;

    const rect = this.cellRect(cell);
    this.editing = cell;
    this.editor.open(this.deps.viewport, column, this.deps.data.item(cell.row), rect);
    this.deps.onStart(cell);
  }

  private commit(value: string): void {
    const cell = this.editing;
    if (!cell) return;
    this.editing = null;
    this.editor.close();

    const column = this.deps.columns[cell.col];
    const item = this.deps.data.item(cell.row);
    const oldValue = column.getValue(item);
    const newValue = column.parse(value);
    if (newValue !== oldValue) {
      this.deps.undo.push(
        new EditAction(this.deps.data, column, cell.row, oldValue, newValue, this.deps.onApplied),
      );
      column.setValue(item, newValue);
      this.deps.onApplied();
    }
    this.deps.onEnd(cell);
  }

  private cancel(): void {
    const cell = this.editing;
    if (!cell) return;
    this.editing = null;
    this.editor.close();
    this.deps.onEnd(cell);
  }

  private cellRect(cell: CellAddress): DOMRect {
    const vp = this.deps.viewport;
    const x = this.deps.gutterLeft + this.deps.layout.getColLeft(cell.col) - vp.scrollLeft;
    const y = this.deps.gutterTop + this.deps.layout.getRowTop(cell.row) - vp.scrollTop;
    return new DOMRect(
      x,
      y,
      this.deps.layout.getColWidth(cell.col),
      this.deps.layout.getRowHeight(cell.row),
    );
  }
}
