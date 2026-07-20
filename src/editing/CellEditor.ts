import type { Column } from '../models/Column';
import type { EditorOpenOptions } from './EditorOpenOptions';

/**
 * The contract a custom cell editor implements — the same shape
 * `TextEditor`/`DropDownEditor`/`RadioEditor` already have. `open()` receives
 * the live cell rect and must position itself with `transform:
 * translate3d(...)` (matching the built-in editors) so it tracks the cell
 * through virtualized scrolling. Committing/cancelling isn't a method here —
 * like the built-ins, a custom editor calls back the `commit`/`cancel`
 * functions its `ColumnDef.editor` factory received.
 */
export interface CellEditor<T = Record<string, unknown>> {
  open(
    parent: HTMLElement,
    column: Column<T>,
    item: T,
    rect: DOMRect,
    opts?: EditorOpenOptions,
  ): void;
  close(): void;
  /**
   * Mark the editor invalid with a message (shown as a native tooltip), or
   * clear it with `null`. Optional — only the built-in text/dropdown editors
   * implement it; a custom editor that wants the same treatment can too.
   */
  setInvalid?(message: string | null): void;
  /**
   * Finish the edit as if the user had confirmed it, used when the edit has to
   * settle because focus is moving to another cell. Implement it by calling the
   * same `commit` callback the factory received (it's named `finishEdit` rather
   * than `commit` so it can't collide with an editor that stores that callback
   * on itself). Optional — an editor without it is cancelled instead, since
   * there's no way to ask it for its value.
   *
   * Don't rely on a blur handler for this: focus is not always inside the
   * editor when the next cell opens (a toolbar click, a programmatic move, or
   * a window that lost focus all leave it elsewhere).
   */
  finishEdit?(): void;
}

/** Builds a column's custom editor, given the commit/cancel callbacks EditorManager wires to every editor. */
export type CellEditorFactory<T = Record<string, unknown>> = (
  commit: (value: string) => void,
  cancel: () => void,
) => CellEditor<T>;
