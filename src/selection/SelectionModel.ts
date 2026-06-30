import { CellAddress, CellRange, cellEquals, makeRange } from '../models/Cell';

/**
 * Selection behavior. `None` disables selection; `Cell`/`Row`/`Column` select a
 * single item; the `*Range` variants extend to a contiguous block.
 */
export type SelectionMode =
  'None' | 'Cell' | 'CellRange' | 'Row' | 'RowRange' | 'Column' | 'ColumnRange';

export interface GridBounds {
  rowCount: number;
  colCount: number;
}

const RANGE_MODES = new Set<SelectionMode>(['CellRange', 'RowRange', 'ColumnRange']);

/**
 * Tracks the active cell and the anchor it extends from. The highlighted
 * rectangle is derived from those plus the mode, so the active cell keeps its
 * real column even in Row mode (where the whole row is highlighted).
 */
export class SelectionModel {
  private active: CellAddress | null = null;
  private anchor: CellAddress | null = null;

  constructor(private mode: SelectionMode = 'Cell') {}

  getMode(): SelectionMode {
    return this.mode;
  }

  setMode(mode: SelectionMode): boolean {
    if (this.mode === mode) return false;
    this.mode = mode;
    if (mode === 'None') {
      this.active = null;
      this.anchor = null;
    } else if (this.active) {
      this.anchor = { ...this.active };
    }
    return true;
  }

  getActive(): CellAddress | null {
    return this.active ? { ...this.active } : null;
  }

  /** The highlighted rectangle for the current mode, or null if nothing is selected. */
  getRange(bounds: GridBounds): CellRange | null {
    if (this.mode === 'None' || !this.active) return null;
    const a = this.active;
    const anc = this.anchor ?? a;
    const lastRow = bounds.rowCount - 1;
    const lastCol = bounds.colCount - 1;

    switch (this.mode) {
      case 'Cell':
        return makeRange(a.row, a.col, a.row, a.col);
      case 'CellRange':
        return makeRange(anc.row, anc.col, a.row, a.col);
      case 'Row':
        return makeRange(a.row, 0, a.row, lastCol);
      case 'RowRange':
        return makeRange(anc.row, 0, a.row, lastCol);
      case 'Column':
        return makeRange(0, a.col, lastRow, a.col);
      case 'ColumnRange':
        return makeRange(0, anc.col, lastRow, a.col);
      default:
        return null;
    }
  }

  /** Move the active cell. With `extend` (and a range mode) the anchor stays put. */
  moveTo(cell: CellAddress, extend: boolean): boolean {
    if (this.mode === 'None') return false;

    const keepAnchor = extend && RANGE_MODES.has(this.mode) && this.active != null;
    const nextAnchor = keepAnchor ? (this.anchor ?? { ...this.active! }) : { ...cell };
    const changed = !cellEquals(this.active, cell) || !cellEquals(this.anchor, nextAnchor);

    this.active = { ...cell };
    this.anchor = nextAnchor;
    return changed;
  }

  clear(): boolean {
    if (!this.active && !this.anchor) return false;
    this.active = null;
    this.anchor = null;
    return true;
  }
}
