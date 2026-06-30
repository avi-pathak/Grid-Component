import { UndoableAction } from './UndoableAction';

/**
 * Tracks undoable actions. Pushing an action past the redo point discards the
 * redo branch. Capped at `maxActions` (default 1000) so long sessions don't grow
 * without bound. `onStateChanged` lets the UI enable/disable undo/redo controls.
 */
export class UndoStack {
  private actions: UndoableAction[] = [];
  private pointer = -1; // index of the last applied action
  private busy = false; // suppress re-entrant pushes during undo/redo

  onStateChanged?: () => void;

  constructor(private maxActions = 1000) {}

  get canUndo(): boolean {
    return this.pointer >= 0;
  }

  get canRedo(): boolean {
    return this.pointer < this.actions.length - 1;
  }

  get actionCount(): number {
    return this.actions.length;
  }

  push(action: UndoableAction): void {
    if (this.busy) return;
    this.actions.splice(this.pointer + 1);
    this.actions.push(action);
    if (this.actions.length > this.maxActions) this.actions.shift();
    this.pointer = this.actions.length - 1;
    this.onStateChanged?.();
  }

  undo(): void {
    if (!this.canUndo) return;
    this.busy = true;
    this.actions[this.pointer].undo();
    this.busy = false;
    this.pointer--;
    this.onStateChanged?.();
  }

  redo(): void {
    if (!this.canRedo) return;
    this.busy = true;
    this.actions[this.pointer + 1].redo();
    this.busy = false;
    this.pointer++;
    this.onStateChanged?.();
  }

  clear(): void {
    this.actions = [];
    this.pointer = -1;
    this.onStateChanged?.();
  }
}
