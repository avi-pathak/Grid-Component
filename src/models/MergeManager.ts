import { CellRange, makeRange } from './Cell';

/** What a merge manager can ask about the grid while deciding a cell's span. */
export interface MergeQuery {
  row: number;
  col: number;
  rowCount: number;
  colCount: number;
  /** The raw value of any cell, for comparing neighbours. */
  value(row: number, col: number): unknown;
  /** Whether a column opts into merging. */
  mergeableCol(col: number): boolean;
}

/**
 * Returns the range a cell belongs to, or null when it stands alone. Return the
 * same range for every cell inside it. Only spans larger than a single cell are
 * meaningful — return null for singletons.
 */
export type MergeManager = (q: MergeQuery) => CellRange | null;

function sameValue(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a == null || b == null) return false;
  return String(a) === String(b);
}

/**
 * The default, content-driven manager: in a mergeable column, a run of adjacent
 * rows with equal values merges into one vertical span.
 */
export const contentMerge: MergeManager = (q) => {
  if (!q.mergeableCol(q.col)) return null;
  const v = q.value(q.row, q.col);
  if (v == null || v === '') return null;

  let top = q.row;
  let bottom = q.row;
  while (top - 1 >= 0 && sameValue(q.value(top - 1, q.col), v)) top--;
  while (bottom + 1 < q.rowCount && sameValue(q.value(bottom + 1, q.col), v)) bottom++;
  if (top === bottom) return null;
  return makeRange(top, q.col, bottom, q.col);
};
