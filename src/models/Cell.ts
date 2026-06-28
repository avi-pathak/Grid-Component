export interface CellAddress {
  row: number;
  col: number;
}

/** A normalized rectangle of cells (inclusive corners). */
export interface CellRange {
  topRow: number;
  leftCol: number;
  bottomRow: number;
  rightCol: number;
}

export function cellEquals(a: CellAddress | null, b: CellAddress | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return a.row === b.row && a.col === b.col;
}

export function rangeEquals(a: CellRange | null, b: CellRange | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return (
    a.topRow === b.topRow &&
    a.leftCol === b.leftCol &&
    a.bottomRow === b.bottomRow &&
    a.rightCol === b.rightCol
  );
}

export function makeRange(r1: number, c1: number, r2: number, c2: number): CellRange {
  return {
    topRow: Math.min(r1, r2),
    leftCol: Math.min(c1, c2),
    bottomRow: Math.max(r1, r2),
    rightCol: Math.max(c1, c2),
  };
}

export function rangeContains(range: CellRange, row: number, col: number): boolean {
  return (
    row >= range.topRow && row <= range.bottomRow && col >= range.leftCol && col <= range.rightCol
  );
}
