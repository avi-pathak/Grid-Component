import { UndoableAction } from './UndoableAction';

/**
 * Groups several actions into one undo step. Used by paste, which can change
 * many cells at once but should undo/redo as a single operation. Undo runs the
 * inner actions in reverse; redo runs them in order. A single onApplied call
 * redraws once after the whole batch.
 */
export class BatchAction implements UndoableAction {
  constructor(
    private actions: UndoableAction[],
    private onApplied: () => void,
  ) {}

  undo(): void {
    for (let i = this.actions.length - 1; i >= 0; i--) this.actions[i].undo();
    this.onApplied();
  }

  redo(): void {
    for (const action of this.actions) action.redo();
    this.onApplied();
  }
}
