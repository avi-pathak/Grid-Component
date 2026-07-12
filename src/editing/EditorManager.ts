import { TextEditor } from './TextEditor';
import { DropDownEditor } from './DropDownEditor';
import { RadioEditor } from './RadioEditor';
import { Column } from '../models/Column';
import { DataMapEditor } from '../models/DataMapEditor';
import { DataView } from '../data/DataView';
import { LayoutEngine } from '../virtualization/LayoutEngine';
import { CellAddress } from '../models/Cell';
import { UndoStack } from '../commands/UndoStack';
import { EditAction } from '../commands/EditAction';

export interface EditorDeps {
  /** The scrolling cells panel. The editor lives here so it tracks the cell while scrolling. */
  cells: HTMLElement;
  layout: LayoutEngine;
  /** Current vertical scroll offset; rows in the pinned body are placed relative to it. */
  scrollTop: () => number;
  data: DataView;
  columns: Column[];
  undo: UndoStack;
  onApplied: () => void;
  /** Return false to prevent the cell from entering edit mode. */
  onBeginning?: (cell: CellAddress) => boolean;
  onStart: (cell: CellAddress) => void;
  /** Return false to reject the new value before it is committed. */
  onEnding?: (cell: CellAddress, value: unknown) => boolean;
  /** Called after a new value was committed to the row. */
  onEnded?: (cell: CellAddress, value: unknown) => void;
  onEnd: (cell: CellAddress) => void;
}

/** The common shape every cell editor implements so the manager can swap them. */
interface CellEditor {
  open(parent: HTMLElement, column: Column, item: Record<string, unknown>, rect: DOMRect): void;
  close(): void;
}

/** Begins, commits, and cancels cell edits; commits run through the undo stack. */
export class EditorManager {
  private text: TextEditor;
  private dropdown: DropDownEditor;
  private radio: RadioEditor;
  private active: CellEditor | null = null;
  private editing: CellAddress | null = null;

  constructor(private deps: EditorDeps) {
    const commit = (value: string) => this.commit(value);
    const cancel = () => this.cancel();
    this.text = new TextEditor(commit, cancel);
    this.dropdown = new DropDownEditor(commit, cancel);
    this.radio = new RadioEditor(commit, cancel);
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
    this.deps.data.applyEdit(item, () => column.setValue(item, !oldValue));
    this.deps.onApplied();
    return true;
  }

  begin(cell: CellAddress): void {
    const column = this.deps.columns[cell.col];
    if (!column || !column.editable || column.dataType === 'Boolean' || this.editing) return;
    if (this.deps.onBeginning && !this.deps.onBeginning(cell)) return; // a handler canceled it

    const rect = this.cellRect(cell);
    this.editing = cell;
    this.active = this.editorFor(column);
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
    // Commit only when the value changed and no handler rejects it.
    if (newValue !== oldValue && (!this.deps.onEnding || this.deps.onEnding(cell, newValue))) {
      this.deps.undo.push(
        new EditAction(this.deps.data, column, cell.row, oldValue, newValue, this.deps.onApplied),
      );
      this.deps.data.applyEdit(item, () => column.setValue(item, newValue));
      this.deps.onApplied();
      this.deps.onEnded?.(cell, newValue);
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

  private editorFor(column: Column): CellEditor {
    if (!column.dataMap) return this.text;
    if (column.dataMapEditor === DataMapEditor.RadioButtons) return this.radio;
    return this.dropdown; // DropDownList, AutoComplete, and Menu share the in-cell dropdown
  }

  // Position in the pinned cells panel, matching how rows are placed: the row's
  // absolute top minus the current scroll offset. The browser flips the native
  // dropdown/calendar up or down on its own.
  private cellRect(cell: CellAddress): DOMRect {
    return new DOMRect(
      this.deps.layout.getColLeft(cell.col),
      this.deps.layout.getRowTop(cell.row) - this.deps.scrollTop(),
      this.deps.layout.getColWidth(cell.col),
      this.deps.layout.getRowHeight(cell.row),
    );
  }
}
