import { TextEditor } from './TextEditor';
import { DropDownEditor } from './DropDownEditor';
import { RadioEditor } from './RadioEditor';
import { Column, CellTemplateContext } from '../models/Column';
import { DataMapEditor } from '../models/DataMapEditor';
import { DataView } from '../data/DataView';
import { LayoutEngine } from '../virtualization/LayoutEngine';
import { CellAddress } from '../models/Cell';
import { UndoStack } from '../commands/UndoStack';
import { EditAction } from '../commands/EditAction';
import { EditorOpenOptions } from './EditorOpenOptions';
import { CellEditor } from './CellEditor';

export type { EditorOpenOptions, CellEditor };

export interface EditorDeps {
  /** The scrolling cells panel. The editor lives here so it tracks the cell while scrolling. */
  cells: HTMLElement;
  layout: LayoutEngine;
  /** Current vertical scroll offset; rows in the pinned body are placed relative to it. */
  scrollTop: () => number;
  data: DataView;
  columns: Column[];
  undo: UndoStack;
  isReadOnly: () => boolean;
  isRowReadOnly: (row: number) => boolean;
  /** Fall back to the column header as its editor placeholder when unset. */
  showPlaceholders: boolean;
  onApplied: () => void;
  /** Return false to prevent the cell from entering edit mode. */
  onBeginning?: (cell: CellAddress) => boolean;
  onStart: (cell: CellAddress) => void;
  /** Return false to reject the new value before it is committed. */
  onEnding?: (cell: CellAddress, value: unknown) => boolean;
  /** Consulted only right after onEnding rejects a value: keep the editor open with the rejected text instead of reverting and closing it. */
  stayOpenOnReject?: (cell: CellAddress, value: unknown) => boolean;
  /** Message to show on the editor when onEnding rejects with stayOpenOnReject. */
  rejectMessage?: () => string | undefined;
  /** Return a message to reject a value after parsing; a non-null result always keeps the editor open. */
  getError?: (ctx: CellTemplateContext, parsing: boolean) => string | null | undefined;
  /** Called after a new value was committed to the row. */
  onEnded?: (cell: CellAddress, value: unknown) => void;
  onEnd: (cell: CellAddress) => void;
  /** Quick-edit arrow keys commit then move the active cell this way instead of moving the caret. */
  onMove?: (direction: 'up' | 'down' | 'left' | 'right') => void;
}

/** Begins, commits, and cancels cell edits; commits run through the undo stack. */
export class EditorManager {
  private text: TextEditor;
  private dropdown: DropDownEditor;
  private radio: RadioEditor;
  private customEditors = new Map<Column, CellEditor>();
  private commit: (value: string) => void;
  private cancel: () => void;
  private active: CellEditor | null = null;
  private editing: CellAddress | null = null;

  constructor(private deps: EditorDeps) {
    this.commit = (value: string) => this.commitValue(value);
    this.cancel = () => this.cancelEditing();
    const commitAndMove = (value: string, direction: 'up' | 'down' | 'left' | 'right') =>
      this.commitAndMove(value, direction);
    this.text = new TextEditor(this.commit, this.cancel, deps.showPlaceholders, commitAndMove);
    this.dropdown = new DropDownEditor(this.commit, this.cancel);
    this.radio = new RadioEditor(this.commit, this.cancel);
  }

  get isEditing(): boolean {
    return this.editing != null;
  }

  /** Flip a Boolean cell's value through the undo stack. Returns true if handled. */
  toggleBoolean(cell: CellAddress): boolean {
    const column = this.deps.columns[cell.col];
    if (!column || !column.editable || column.dataType !== 'Boolean') return false;
    if (this.deps.isReadOnly() || this.deps.isRowReadOnly(cell.row)) return false;
    const item = this.deps.data.item(cell.row);
    const oldValue = column.getValue(item) === true;
    this.deps.undo.push(
      new EditAction(this.deps.data, column, cell.row, oldValue, !oldValue, this.deps.onApplied),
    );
    this.deps.data.applyEdit(item, () => column.setValue(item, !oldValue));
    this.deps.onApplied();
    return true;
  }

  begin(cell: CellAddress, opts?: EditorOpenOptions): void {
    const column = this.deps.columns[cell.col];
    if (!column || !column.editable || column.dataType === 'Boolean') return;
    if (this.editing) {
      if (this.editing.row === cell.row && this.editing.col === cell.col) return; // already editing this cell
      this.settle();
      // Only a validation handler that deliberately kept the editor open (via
      // stayInEditMode/getError) should still be editing here; leave it alone
      // rather than dropping the user's rejected value.
      if (this.editing) return;
    }
    if (this.deps.isReadOnly() || this.deps.isRowReadOnly(cell.row)) return;
    if (this.deps.onBeginning && !this.deps.onBeginning(cell)) return; // a handler canceled it

    const rect = this.cellRect(cell);
    this.editing = cell;
    this.active = this.editorFor(column);
    this.active.open(this.deps.cells, column, this.deps.data.item(cell.row), rect, opts);
    this.deps.onStart(cell);
  }

  private commitValue(value: string): void {
    const cell = this.editing;
    if (!cell) return;

    const column = this.deps.columns[cell.col];
    const item = this.deps.data.item(cell.row);
    const oldValue = column.getValue(item);
    const { value: newValue, ok } = column.tryParse(value);

    if (newValue === oldValue) {
      this.closeEditing(cell);
      return;
    }
    if (this.deps.onEnding && !this.deps.onEnding(cell, newValue)) {
      // A handler rejected the value. Normally that just reverts and closes
      // like any other rejection; stayOpenOnReject lets it keep the editor
      // open with the rejected text instead, so the user can fix it in place.
      if (this.deps.stayOpenOnReject?.(cell, newValue)) {
        this.active?.setInvalid?.(this.deps.rejectMessage?.() ?? null);
        return;
      }
      this.closeEditing(cell);
      return;
    }
    if (this.deps.getError) {
      const parsing = !ok;
      const ctx: CellTemplateContext = {
        value: parsing ? value : newValue,
        item,
        row: cell.row,
        column,
      };
      const error = this.deps.getError(ctx, parsing);
      if (error != null) {
        this.active?.setInvalid?.(error); // stays open, like stayOpenOnReject
        return;
      }
    }
    this.active?.setInvalid?.(null);
    this.deps.undo.push(
      new EditAction(this.deps.data, column, cell.row, oldValue, newValue, this.deps.onApplied),
    );
    this.deps.data.applyEdit(item, () => column.setValue(item, newValue));
    this.deps.onApplied();
    this.deps.onEnded?.(cell, newValue);
    this.closeEditing(cell);
  }

  // Finish an edit that's still open because focus moved to another cell.
  // Asking the editor directly rather than blurring document.activeElement:
  // focus isn't reliably inside the editor (a toolbar click, a programmatic
  // move, or a window that lost focus all leave it elsewhere), and a blur that
  // lands nowhere used to leave the old editor open — which silently blocked
  // the next cell from opening at all.
  private settle(): void {
    if (this.active?.finishEdit) this.active.finishEdit();
    else this.cancelEditing(); // no way to ask for its value; close it cleanly
  }

  private closeEditing(cell: CellAddress): void {
    this.editing = null;
    this.active?.close();
    this.active = null;
    this.deps.onEnd(cell);
  }

  private commitAndMove(value: string, direction: 'up' | 'down' | 'left' | 'right'): void {
    this.commitValue(value);
    // Don't move if the commit was rejected and stayed open (stayOpenOnReject)
    // — the editor is still anchored to this cell, so the selection shouldn't
    // wander off while the user fixes the rejected value.
    if (!this.editing) this.deps.onMove?.(direction);
  }

  private cancelEditing(): void {
    const cell = this.editing;
    if (!cell) return;
    this.editing = null;
    this.active?.close();
    this.active = null;
    this.deps.onEnd(cell);
  }

  private editorFor(column: Column): CellEditor {
    if (column.editorFactory) {
      let editor = this.customEditors.get(column);
      if (!editor) {
        editor = column.editorFactory(this.commit, this.cancel);
        this.customEditors.set(column, editor);
      }
      return editor;
    }
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
