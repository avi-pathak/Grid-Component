import { LayoutEngine } from '../virtualization/LayoutEngine';
import { Column } from '../models/Column';

const EDGE = 5;
const MIN_WIDTH = 24;

/**
 * Drag-to-resize columns from the header. Hit-tests the pointer against column
 * right edges (no per-cell handles, since header cells are pooled). Previews the
 * new width live, then commits once through `commit` so it lands as one undoable
 * action.
 */
export class ColumnResizer {
  private col = -1;
  private startX = 0;
  private startWidth = 0;

  private readonly onDown = (e: MouseEvent): void => {
    const col = this.edgeAt(e);
    if (col < 0) return;
    e.preventDefault();
    this.col = col;
    this.startX = e.clientX;
    this.startWidth = this.columns()[col].width;
    window.addEventListener('mousemove', this.onMove);
    window.addEventListener('mouseup', this.onUp);
  };

  private readonly onHover = (e: MouseEvent): void => {
    this.header.style.cursor = this.edgeAt(e) >= 0 ? 'col-resize' : '';
  };

  private readonly onMove = (e: MouseEvent): void => {
    const width = Math.max(MIN_WIDTH, this.startWidth + (e.clientX - this.startX));
    this.columns()[this.col].width = width;
    this.preview();
  };

  private readonly onUp = (e: MouseEvent): void => {
    window.removeEventListener('mousemove', this.onMove);
    window.removeEventListener('mouseup', this.onUp);
    const width = Math.max(MIN_WIDTH, this.startWidth + (e.clientX - this.startX));
    this.columns()[this.col].width = this.startWidth; // restore so commit records one action
    this.commit(this.col, width);
    this.col = -1;
  };

  constructor(
    private header: HTMLElement,
    private layout: LayoutEngine,
    private columns: () => Column[],
    private preview: () => void,
    private commit: (col: number, width: number) => void,
  ) {
    this.header.addEventListener('mousedown', this.onDown);
    this.header.addEventListener('mousemove', this.onHover);
  }

  dispose(): void {
    this.header.removeEventListener('mousedown', this.onDown);
    this.header.removeEventListener('mousemove', this.onHover);
    window.removeEventListener('mousemove', this.onMove);
    window.removeEventListener('mouseup', this.onUp);
  }

  private edgeAt(e: MouseEvent): number {
    const rect = this.header.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const col = this.layout.colAtX(x);
    const right = this.layout.getColLeft(col) + this.layout.getColWidth(col);
    return Math.abs(x - right) <= EDGE ? col : -1;
  }
}
