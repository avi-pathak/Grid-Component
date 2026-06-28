import { createEl, setTransform } from '../utils/DOM';

export interface ScaffoldConfig {
  showColumnHeader: boolean;
  showRowHeader: boolean;
  headerHeight: number;
  rowHeaderWidth: number;
}

/**
 * Builds and owns the static DOM scaffold using FlexGrid's single-scroller model:
 * one scroll container holds everything, so the native scrollbars span the whole
 * grid. The data cells scroll normally; the column header, row header, and
 * top-left corner are panels inside the canvas that are counter-translated on
 * each scroll to stay pinned (header pins vertically, row header horizontally,
 * corner both). A gutter (rowHeaderWidth × headerHeight) is reserved at the
 * top-left so the cells start past the headers.
 */
export class ViewportRenderer {
  readonly viewport: HTMLElement;
  readonly canvas: HTMLElement;
  readonly cells: HTMLElement;
  readonly headerInner: HTMLElement;
  readonly rowHeaderInner: HTMLElement;
  readonly gutterLeft: number;
  readonly gutterTop: number;

  private corner: HTMLElement;

  constructor(
    private host: HTMLElement,
    config: ScaffoldConfig,
  ) {
    host.classList.add('apg');
    this.gutterLeft = config.showRowHeader ? config.rowHeaderWidth : 0;
    this.gutterTop = config.showColumnHeader ? config.headerHeight : 0;

    this.viewport = createEl('div', 'apg-viewport');
    this.canvas = createEl('div', 'apg-canvas');

    this.cells = createEl('div', 'apg-cells');
    this.cells.style.left = `${this.gutterLeft}px`;
    this.cells.style.top = `${this.gutterTop}px`;

    this.headerInner = createEl('div', 'apg-header-inner');
    this.headerInner.style.left = `${this.gutterLeft}px`;
    this.headerInner.style.height = `${this.gutterTop}px`;
    this.headerInner.style.display = config.showColumnHeader ? '' : 'none';

    this.rowHeaderInner = createEl('div', 'apg-rowheader-inner');
    this.rowHeaderInner.style.top = `${this.gutterTop}px`;
    this.rowHeaderInner.style.width = `${this.gutterLeft}px`;
    this.rowHeaderInner.style.display = config.showRowHeader ? '' : 'none';

    this.corner = createEl('div', 'apg-corner');
    this.corner.style.width = `${this.gutterLeft}px`;
    this.corner.style.height = `${this.gutterTop}px`;
    this.corner.style.display = config.showColumnHeader && config.showRowHeader ? '' : 'none';

    this.canvas.append(this.cells, this.headerInner, this.rowHeaderInner, this.corner);
    this.viewport.appendChild(this.canvas);
    host.appendChild(this.viewport);
  }

  resize(totalWidth: number, totalHeight: number): void {
    this.canvas.style.width = `${this.gutterLeft + totalWidth}px`;
    this.canvas.style.height = `${this.gutterTop + totalHeight}px`;
    this.headerInner.style.width = `${totalWidth}px`;
    this.rowHeaderInner.style.height = `${totalHeight}px`;
  }

  /** Counter-translate the pinned panels so they stay in place as the canvas scrolls. */
  syncPanels(scrollLeft: number, scrollTop: number): void {
    setTransform(this.headerInner, 0, scrollTop);
    setTransform(this.rowHeaderInner, scrollLeft, 0);
    setTransform(this.corner, scrollLeft, scrollTop);
  }

  dispose(): void {
    this.viewport.remove();
    this.host.classList.remove('apg');
  }
}
