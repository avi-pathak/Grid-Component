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
}

/** Builds a column's custom editor, given the commit/cancel callbacks EditorManager wires to every editor. */
export type CellEditorFactory<T = Record<string, unknown>> = (
  commit: (value: string) => void,
  cancel: () => void,
) => CellEditor<T>;
