import { CellAddress, CellRange } from '../models/Cell';
import { ChangeAction } from '../data/CollectionView';

export interface GridEvents {
  cellClick: CellAddress;
  cellDoubleClick: CellAddress;
  selectionChanged: CellAddress | null;
  scrollChanged: { scrollTop: number; scrollLeft: number };
  cellEditStart: CellAddress;
  cellEditEnd: CellAddress;
  undoStackChanged: { canUndo: boolean; canRedo: boolean };
  columnReordered: { from: number; to: number };
  collectionChanged: { action: ChangeAction };
  /** After the group-by columns change (added, removed, reordered, or cleared). */
  groupsChanged: { bindings: string[] };
  /** After a group-header row is expanded or collapsed. */
  groupCollapsedChanged: { pathKey: string; collapsed: boolean };
  /** Before copying the selection. Set `cancel` to true to block the copy. */
  copying: { range: CellRange; cancel: boolean };
  /** After the selection was written to the clipboard. */
  copied: { range: CellRange };
  /** Before applying pasted text. Set `cancel` to true to block the paste. */
  pasting: { text: string; cancel: boolean };
  /** After pasted text was applied to the given range. */
  pasted: { range: CellRange };
}
