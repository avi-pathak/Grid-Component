import { CellAddress } from '../models/Cell';

export interface GridEvents {
  cellClick: CellAddress;
  cellDoubleClick: CellAddress;
  selectionChanged: CellAddress | null;
  scrollChanged: { scrollTop: number; scrollLeft: number };
  cellEditStart: CellAddress;
  cellEditEnd: CellAddress;
  undoStackChanged: { canUndo: boolean; canRedo: boolean };
}
