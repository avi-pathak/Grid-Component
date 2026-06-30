import { UndoableAction } from './UndoableAction';
import { DataView } from '../data/DataView';
import { Column } from '../models/Column';

/** A single cell value change. Undo/redo swaps the stored old and new values. */
export class EditAction implements UndoableAction {
  constructor(
    private data: DataView,
    private column: Column,
    private row: number,
    private oldValue: unknown,
    private newValue: unknown,
    private onApplied: () => void,
  ) {}

  private apply(value: unknown): void {
    const item = this.data.item(this.row);
    this.data.applyEdit(item, () => this.column.setValue(item, value));
    this.onApplied();
  }

  undo(): void {
    this.apply(this.oldValue);
  }

  redo(): void {
    this.apply(this.newValue);
  }
}
