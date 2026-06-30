/**
 * One reversible change: the action knows how to undo and redo itself. Concrete
 * actions (cell edits, column resizing) capture the before/after state they need.
 */
export interface UndoableAction {
  undo(): void;
  redo(): void;
}
