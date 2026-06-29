import { TextEditor } from './TextEditor';
import { ComboEditor } from './ComboEditor';
import { Column } from '../models/Column';
import { DataView } from '../data/DataView';
import { LayoutEngine } from '../virtualization/LayoutEngine';
import { CellAddress } from '../models/Cell';
import { UndoStack } from '../commands/UndoStack';
import { EditAction } from '../commands/EditAction';

export interface EditorDeps {
  /** The scrolling cells panel. The editor lives here so it tracks the cell while scrolling. */
  cells: HTMLElement;
  layout: LayoutEngine;
  data: DataView;
  columns: Column[];
  undo: UndoStack;
  onApplied: () => void;
  onStart: (cell: CellAddress) => void;
  onEnd: (cell: CellAddress) => void;
}

/** Begins, commits, and cancels cell edits; commits run through the undo stack. */
export class EditorManager {
  private text: TextEditor;
  private combo: ComboEditor;
  private active: TextEditor | ComboEditor | null = null;
  private editing: CellAddress | null = null;

  constructor(private deps: EditorDeps) {
    this.text = new TextEditor(
      (value) => this.commit(value),
      () => this.cancel(),
    );
    this.combo = new ComboEditor(
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
    this.active = column.dataMap ? this.combo : this.text;
    this.active.open(this.deps.cells, column, this.deps.data.item(cell.row), rect);
    this.deps.onStart(cell);
  }

  private commit(value: string): void {
    const cell = this.editing;
    if (!cell) return;
    this.editing = null;
    this.active?.close();
    this.active = null;

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
    this.active?.close();
    this.active = null;
    this.deps.onEnd(cell);
  }

  // Position in cells-panel (content) coordinates. The editor is a child of that
  // panel, so it scrolls with the row — no scroll offset to subtract, no gutter
  // to add. The browser flips the native dropdown/calendar up or down on its own.
  private cellRect(cell: CellAddress): DOMRect {
    return new DOMRect(
      this.deps.layout.getColLeft(cell.col),
      this.deps.layout.getRowTop(cell.row),
      this.deps.layout.getColWidth(cell.col),
      this.deps.layout.getRowHeight(cell.row),
    );
  }
}
