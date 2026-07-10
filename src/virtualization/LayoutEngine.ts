import { Column } from '../models/Column';
import { upperBound } from '../utils/BinarySearch';
import { clamp } from '../utils/Math';

export interface IndexRange {
  first: number;
  /** Inclusive. `last < first` means the range is empty. */
  last: number;
}

/**
 * Maps between pixels and row/column indices.
 *
 * Rows use a uniform height, so row math is O(1) and scales to millions of rows
 * without allocating a per-row array. Columns have individual widths, so their
 * left edges are kept as a cumulative array and located with binary search.
 */
export class LayoutEngine {
  private _rowCount: number;
  private rowHeight: number;
  private colLefts: number[];

  constructor(rowCount: number, rowHeight: number, columns: Column[]) {
    this._rowCount = rowCount;
    this.rowHeight = rowHeight;
    this.colLefts = buildColLefts(columns);
  }

  get rowCount(): number {
    return this._rowCount;
  }

  get colCount(): number {
    return this.colLefts.length - 1;
  }

  get totalHeight(): number {
    return this._rowCount * this.rowHeight;
  }

  get totalWidth(): number {
    return this.colLefts[this.colLefts.length - 1];
  }

  getRowTop(row: number): number {
    return row * this.rowHeight;
  }

  getRowHeight(_row: number): number {
    return this.rowHeight;
  }

  getColLeft(col: number): number {
    return this.colLefts[col];
  }

  getColWidth(col: number): number {
    return this.colLefts[col + 1] - this.colLefts[col];
  }

  /** Total width of the first `count` columns (the frozen band). */
  frozenColsWidth(count: number): number {
    const c = clamp(count, 0, this.colCount);
    return this.colLefts[c];
  }

  /** Total height of the first `count` rows (the frozen band). */
  frozenRowsHeight(count: number): number {
    return clamp(count, 0, this._rowCount) * this.rowHeight;
  }

  getVisibleRows(scrollTop: number, viewportHeight: number): IndexRange {
    if (this._rowCount === 0) return { first: 0, last: -1 };
    const first = Math.floor(scrollTop / this.rowHeight);
    const last = Math.floor((scrollTop + viewportHeight - 1) / this.rowHeight);
    return {
      first: clamp(first, 0, this._rowCount - 1),
      last: clamp(last, 0, this._rowCount - 1),
    };
  }

  getVisibleCols(scrollLeft: number, viewportWidth: number): IndexRange {
    const count = this.colCount;
    if (count === 0) return { first: 0, last: -1 };
    const first = upperBound(this.colLefts, scrollLeft) - 1;
    const last = upperBound(this.colLefts, scrollLeft + viewportWidth - 1) - 1;
    return {
      first: clamp(first, 0, count - 1),
      last: clamp(last, 0, count - 1),
    };
  }

  rowAtY(y: number): number {
    return clamp(Math.floor(y / this.rowHeight), 0, this._rowCount - 1);
  }

  colAtX(x: number): number {
    return clamp(upperBound(this.colLefts, x) - 1, 0, this.colCount - 1);
  }

  setRowCount(rowCount: number): void {
    this._rowCount = rowCount;
  }

  setColumns(columns: Column[]): void {
    this.colLefts = buildColLefts(columns);
  }
}

function buildColLefts(columns: Column[]): number[] {
  const lefts = new Array<number>(columns.length + 1);
  lefts[0] = 0;
  for (let i = 0; i < columns.length; i++) {
    lefts[i + 1] = lefts[i] + columns[i].width;
  }
  return lefts;
}
