import { LayoutEngine } from '../virtualization/LayoutEngine';
import { Column } from '../models/Column';
import { createEl } from '../utils/DOM';

const EDGE = 5; // resize zone — leave it to the ColumnResizer
const THRESHOLD = 4; // pixels before a press becomes a drag

/**
 * Drag a column header to reorder columns. A press that moves past the threshold
 * starts a drag, shows a drop marker at the nearest column boundary, and commits
 * the move on release.
 */
export class ColumnDragger {
  private srcCol = -1;
  private startX = 0;
  private dragging = false;
  private marker = createEl('div', 'apg-col-drop-marker');
  private insertAt = 0;

  private readonly onDown = (e: MouseEvent): void => {
    if (e.button !== 0 || this.isEdge(e)) return;
    this.srcCol = this.colAt(e);
    if (this.srcCol < 0) return;
    this.startX = e.clientX;
    this.dragging = false;
    window.addEventListener('mousemove', this.onMove);
    window.addEventListener('mouseup', this.onUp);
  };

  private readonly onMove = (e: MouseEvent): void => {
    if (!this.dragging) {
      if (Math.abs(e.clientX - this.startX) < THRESHOLD) return;
      this.dragging = true;
      this.header.style.cursor = 'grabbing';
      this.header.appendChild(this.marker);
    }
    const x = this.contentX(e);
    const col = this.layout.colAtX(x);
    const mid = this.layout.getColLeft(col) + this.layout.getColWidth(col) / 2;
    this.insertAt = x < mid ? col : col + 1;
    this.marker.style.left = `${this.layout.getColLeft(this.insertAt)}px`;
  };

  private readonly onUp = (): void => {
    window.removeEventListener('mousemove', this.onMove);
    window.removeEventListener('mouseup', this.onUp);
    this.header.style.cursor = '';
    if (this.dragging) {
      this.marker.remove();
      const to = this.insertAt > this.srcCol ? this.insertAt - 1 : this.insertAt;
      if (to !== this.srcCol) this.commit(this.srcCol, to);
    }
    this.srcCol = -1;
    this.dragging = false;
  };

  constructor(
    private header: HTMLElement,
    private layout: LayoutEngine,
    private columns: () => Column[],
    private commit: (from: number, to: number) => void,
  ) {
    this.header.addEventListener('mousedown', this.onDown);
  }

  dispose(): void {
    this.header.removeEventListener('mousedown', this.onDown);
    window.removeEventListener('mousemove', this.onMove);
    window.removeEventListener('mouseup', this.onUp);
    this.marker.remove();
  }

  private contentX(e: MouseEvent): number {
    return e.clientX - this.header.getBoundingClientRect().left;
  }

  private colAt(e: MouseEvent): number {
    if (this.columns().length === 0) return -1;
    return this.layout.colAtX(this.contentX(e));
  }

  private isEdge(e: MouseEvent): boolean {
    const x = this.contentX(e);
    const col = this.layout.colAtX(x);
    const right = this.layout.getColLeft(col) + this.layout.getColWidth(col);
    return Math.abs(x - right) <= EDGE;
  }
}
