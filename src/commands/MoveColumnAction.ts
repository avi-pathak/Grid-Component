import { UndoableAction } from './UndoableAction';
import { Column } from '../models/Column';

/** Moves a column from one index to another. Undo/redo replays the move. */
export class MoveColumnAction implements UndoableAction {
  constructor(
    private columns: Column[],
    private from: number,
    private to: number,
    private onApplied: () => void,
  ) {}

  redo(): void {
    moveColumn(this.columns, this.from, this.to);
    this.onApplied();
  }

  undo(): void {
    moveColumn(this.columns, this.to, this.from);
    this.onApplied();
  }
}

export function moveColumn(columns: Column[], from: number, to: number): void {
  const [col] = columns.splice(from, 1);
  columns.splice(to, 0, col);
}
