import { GridState } from './GridState';
import { LayoutEngine } from '../virtualization/LayoutEngine';

// Extra rows/cols kept in the DOM beyond the visible window. A larger row
// overscan absorbs fast scrollbar drags so freshly exposed rows are already
// rendered instead of flashing blank for a frame.
const BUFFER_ROWS = 8;
const BUFFER_COLS = 2;

/**
 * Turns a scroll position into the buffered range of rows and columns that
 * should be in the DOM, and writes it into shared state. `update` returns true
 * only when that range actually changed, so the renderer can skip work on small
 * sub-row scrolls.
 */
export class GridViewport {
  width = 0;
  height = 0;

  constructor(
    private state: GridState,
    private layout: LayoutEngine,
  ) {}

  setSize(width: number, height: number): void {
    this.width = width;
    this.height = height;
  }

  update(scrollTop: number, scrollLeft: number): boolean {
    const rows = this.layout.getVisibleRows(scrollTop, this.height);
    const cols = this.layout.getVisibleCols(scrollLeft, this.width);

    const firstRow = Math.max(0, rows.first - BUFFER_ROWS);
    const lastRow = Math.min(this.layout.rowCount - 1, rows.last + BUFFER_ROWS);
    const firstCol = Math.max(0, cols.first - BUFFER_COLS);
    const lastCol = Math.min(this.layout.colCount - 1, cols.last + BUFFER_COLS);

    const s = this.state;
    const rangeChanged =
      firstRow !== s.firstRow ||
      lastRow !== s.lastRow ||
      firstCol !== s.firstCol ||
      lastCol !== s.lastCol;

    s.scrollTop = scrollTop;
    s.scrollLeft = scrollLeft;
    s.firstRow = firstRow;
    s.lastRow = lastRow;
    s.firstCol = firstCol;
    s.lastCol = lastCol;

    return rangeChanged;
  }
}
