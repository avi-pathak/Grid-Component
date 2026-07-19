import { CellAddress, CellRange } from '../models/Cell';
import { ChangeAction } from '../data/CollectionView';
import { Column } from '../models/Column';

export interface GridEvents {
  cellClick: CellAddress;
  cellDoubleClick: CellAddress;
  /** Before the active cell moves. Set `cancel` to true to keep the current selection. */
  selectionChanging: { row: number; col: number; cancel: boolean };
  selectionChanged: CellAddress | null;
  scrollChanged: { scrollTop: number; scrollLeft: number };
  /** Before a cell enters edit mode. Set `cancel` to true to prevent editing. */
  beginningEdit: { row: number; col: number; cancel: boolean };
  /** After the editor opened for a cell. */
  cellEditStart: CellAddress;
  /** After the editor is positioned and ready. Informational only — not cancelable. */
  cellEditPreparing: { row: number; col: number; column: Column };
  /**
   * Before the edited value is committed. Set `cancel` to true to reject it
   * (validation). With `cancel` also set `stayInEditMode` to true to keep the
   * editor open with the rejected text instead of reverting and closing it.
   */
  cellEditEnding: {
    row: number;
    col: number;
    value: unknown;
    cancel: boolean;
    stayInEditMode?: boolean;
  };
  /** After an edited value was committed to the row. */
  cellEditEnded: { row: number; col: number; value: unknown };
  /** After the editor closed (whether or not a value was committed). */
  cellEditEnd: CellAddress;
  undoStackChanged: { canUndo: boolean; canRedo: boolean };
  /** Before a column is sorted. `ascending` is the target direction (null = clearing). Cancelable. */
  sortingColumn: { col: number; binding: string; ascending: boolean | null; cancel: boolean };
  /** After a column's sort changed (null = cleared). */
  sortedColumn: { col: number; binding: string; ascending: boolean | null };
  /** Before a column is resized. Set `cancel` to true to keep the current width. */
  resizingColumn: { col: number; width: number; cancel: boolean };
  /** After a column was resized. */
  resizedColumn: { col: number; width: number };
  /** Before a column moves to a new index. Set `cancel` to true to block the move. */
  columnReordering: { from: number; to: number; cancel: boolean };
  columnReordered: { from: number; to: number };
  collectionChanged: { action: ChangeAction };
  /** After the group-by columns change (added, removed, reordered, or cleared). */
  groupsChanged: { bindings: string[] };
  /** Before a group-header row is expanded or collapsed. `collapsed` is the target state. Cancelable. */
  groupCollapsedChanging: { pathKey: string; collapsed: boolean; cancel: boolean };
  /** After a group-header row is expanded or collapsed. */
  groupCollapsedChanged: { pathKey: string; collapsed: boolean };
  /** Before a column filter is applied or cleared from the dialog. Cancelable. */
  filtering: { binding: string; cancel: boolean };
  /** After any column filter is applied, edited, or cleared. */
  filterChanged: { activeBindings: string[] };
  /** Before copying the selection. Set `cancel` to true to block the copy. */
  copying: { range: CellRange; cancel: boolean };
  /** After the selection was written to the clipboard. */
  copied: { range: CellRange };
  /** Before applying pasted text. Set `cancel` to true to block the paste. */
  pasting: { text: string; cancel: boolean };
  /** After pasted text was applied to the given range. */
  pasted: { range: CellRange };
  /** Before the number of pinned (left) columns changes. Cancelable. */
  freezingColumns: { count: number; cancel: boolean };
  /** After the number of pinned columns changed. */
  frozenColumnsChanged: { count: number };
  /** Before the number of pinned (top) rows changes. Cancelable. */
  freezingRows: { count: number; cancel: boolean };
  /** After the number of pinned rows changed. */
  frozenRowsChanged: { count: number };
  /** Before a column group is collapsed or expanded. `collapsed` is the target state. Cancelable. */
  columnGroupCollapsing: { key: string; collapsed: boolean; cancel: boolean };
  /** After a column group's collapsed state changed. */
  columnGroupCollapsedChanged: { key: string; collapsed: boolean };
  /** After the set of column groups changed (added, removed, or replaced). */
  columnGroupsChanged: { keys: string[] };
  /** Before an export runs. Set `cancel` to true to abort. */
  exporting: { format: string; fileName: string; cancel: boolean };
  /** After an export produced its artifact (and downloaded, unless disabled). */
  exported: { format: string; fileName: string };
}
