import { CellAddress } from '../models/Cell';
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
}
