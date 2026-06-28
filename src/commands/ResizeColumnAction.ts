import { UndoableAction } from './UndoableAction';
import { Column } from '../models/Column';

/** A column width change. Undo/redo swaps the stored old and new widths. */
export class ResizeColumnAction implements UndoableAction {
  constructor(
    private column: Column,
    private oldWidth: number,
    private newWidth: number,
    private onApplied: () => void,
  ) {}

  private apply(width: number): void {
    this.column.width = width;
    this.onApplied();
  }

  undo(): void {
    this.apply(this.oldWidth);
  }

  redo(): void {
    this.apply(this.newWidth);
  }
}
