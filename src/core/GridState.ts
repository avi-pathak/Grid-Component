import { CellAddress, CellRange } from '../models/Cell';

export type StateListener = () => void;

/**
 * Shared, observable grid state. Subsystems read these fields and subscribe to
 * changes rather than keeping their own copy of the scroll position or visible
 * range. Editing and focus state move in here as those features land.
 */
export class GridState {
  scrollTop = 0;
  scrollLeft = 0;

  firstRow = 0;
  lastRow = 0;
  firstCol = 0;
  lastCol = 0;

  selection: CellRange | null = null;
  activeCell: CellAddress | null = null;
  alternatingRowStep = 1;
  /** Which column the view is sorted by, and the direction. Null when unsorted. */
  sort: { col: number; ascending: boolean } | null = null;
  /** Column indices that currently have an active filter. */
  activeFilters = new Set<number>();

  private listeners = new Set<StateListener>();

  subscribe(listener: StateListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  emitChange(): void {
    for (const listener of this.listeners) listener();
  }
}
