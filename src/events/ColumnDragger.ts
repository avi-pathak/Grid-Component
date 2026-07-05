import { LayoutEngine } from '../virtualization/LayoutEngine';
import { Column } from '../models/Column';
import { createEl } from '../utils/DOM';
import { iconEl } from '../utils/icons';

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
  private overZone = false;
  private marker = createEl('div', 'apg-col-drop-marker');
  private ghost?: HTMLElement;
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
      this.showGhost();
    }
    this.moveGhost(e);
    // Over the group panel: switch from reordering to "group by this column".
    if (this.isOverGroupZone(e)) {
      if (!this.overZone) {
        this.overZone = true;
        this.marker.style.display = 'none';
        this.ghost?.classList.add('apg-drag-ghost-active');
        this.onGroupHover?.(true);
      }
      return;
    }
    if (this.overZone) {
      this.overZone = false;
      this.marker.style.display = '';
      this.ghost?.classList.remove('apg-drag-ghost-active');
      this.onGroupHover?.(false);
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
    this.removeGhost();
    if (this.dragging) {
      this.marker.remove();
      this.marker.style.display = '';
      if (this.overZone && this.onGroupBy) {
        this.onGroupBy(this.srcCol);
      } else {
        const to = this.insertAt > this.srcCol ? this.insertAt - 1 : this.insertAt;
        if (to !== this.srcCol) this.commit(this.srcCol, to);
      }
    }
    this.onGroupHover?.(false);
    this.overZone = false;
    this.srcCol = -1;
    this.dragging = false;
  };

  constructor(
    private header: HTMLElement,
    private layout: LayoutEngine,
    private columns: () => Column[],
    private commit: (from: number, to: number) => void,
    private groupZone?: () => DOMRect | null,
    private onGroupBy?: (col: number) => void,
    private onGroupHover?: (active: boolean) => void,
  ) {
    this.header.addEventListener('mousedown', this.onDown);
  }

  dispose(): void {
    this.header.removeEventListener('mousedown', this.onDown);
    window.removeEventListener('mousemove', this.onMove);
    window.removeEventListener('mouseup', this.onUp);
    this.marker.remove();
    this.removeGhost();
  }

  // A label chip that follows the cursor while dragging, so it's clear a header
  // is being moved (and where it can go).
  private showGhost(): void {
    const header = this.columns()[this.srcCol]?.header ?? '';
    this.ghost = createEl('div', 'apg-drag-ghost');
    this.ghost.appendChild(iconEl('group', 'apg-drag-ghost-icon'));
    const label = createEl('span', 'apg-drag-ghost-label');
    label.textContent = header;
    this.ghost.appendChild(label);
    document.body.appendChild(this.ghost);
  }

  private moveGhost(e: MouseEvent): void {
    if (!this.ghost) return;
    // Anchor the chip on the pointer: cursor sits just inside its left edge,
    // vertically centered, so it reads as "held" by the mouse.
    const h = this.ghost.offsetHeight || 26;
    this.ghost.style.left = `${e.clientX - 6}px`;
    this.ghost.style.top = `${e.clientY - h / 2}px`;
  }

  private removeGhost(): void {
    this.ghost?.remove();
    this.ghost = undefined;
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

  private isOverGroupZone(e: MouseEvent): boolean {
    const rect = this.groupZone?.();
    if (!rect) return false;
    return (
      e.clientX >= rect.left &&
      e.clientX <= rect.right &&
      e.clientY >= rect.top &&
      e.clientY <= rect.bottom
    );
  }
}
