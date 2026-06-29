import { CellAddress } from '../models/Cell';
import { LayoutEngine } from '../virtualization/LayoutEngine';

/**
 * Translates mouse events on the viewport into cell addresses. A press selects;
 * dragging with the button down (or shift+click) extends the selection, which
 * the grid applies according to its selection mode.
 */
export class MouseHandler {
  private dragging = false;

  private readonly onMouseDown = (e: MouseEvent): void => {
    if (e.button !== 0) return;
    // Let clicks inside an open editor select text normally.
    if ((e.target as HTMLElement).closest('.apg-editor')) return;
    const cell = this.hitTest(e);
    if (!cell) return;
    e.preventDefault(); // keep the browser from starting a text selection
    this.dragging = true;
    this.onSelect(cell, e.shiftKey, true);
  };

  private readonly onMouseMove = (e: MouseEvent): void => {
    if (!this.dragging) return;
    const cell = this.hitTest(e);
    if (cell) this.onSelect(cell, true, false);
  };

  private readonly onMouseUp = (): void => {
    this.dragging = false;
  };

  private readonly onDoubleClick = (e: MouseEvent): void => {
    if ((e.target as HTMLElement).closest('.apg-editor')) return;
    const cell = this.hitTest(e);
    if (cell) this.onDouble(cell);
  };

  constructor(
    private viewport: HTMLElement,
    private layout: LayoutEngine,
    private onSelect: (cell: CellAddress, extend: boolean, isPress: boolean) => void,
    private onDouble: (cell: CellAddress) => void,
    private gutterLeft: number,
    private gutterTop: number,
  ) {
    this.viewport.addEventListener('mousedown', this.onMouseDown);
    this.viewport.addEventListener('dblclick', this.onDoubleClick);
    window.addEventListener('mousemove', this.onMouseMove);
    window.addEventListener('mouseup', this.onMouseUp);
  }

  dispose(): void {
    this.viewport.removeEventListener('mousedown', this.onMouseDown);
    this.viewport.removeEventListener('dblclick', this.onDoubleClick);
    window.removeEventListener('mousemove', this.onMouseMove);
    window.removeEventListener('mouseup', this.onMouseUp);
  }

  private hitTest(e: MouseEvent): CellAddress | null {
    if (this.layout.rowCount === 0 || this.layout.colCount === 0) return null;
    const rect = this.viewport.getBoundingClientRect();
    const vx = e.clientX - rect.left;
    const vy = e.clientY - rect.top;
    // Clicks on the pinned header/corner gutters are not data cells.
    if (vx < this.gutterLeft || vy < this.gutterTop) return null;
    const x = vx - this.gutterLeft + this.viewport.scrollLeft;
    const y = vy - this.gutterTop + this.viewport.scrollTop;
    return { row: this.layout.rowAtY(y), col: this.layout.colAtX(x) };
  }
}
