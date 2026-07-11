import { createEl } from '../utils/DOM';

export interface ScaffoldConfig {
  showColumnHeader: boolean;
  showRowHeader: boolean;
  headerHeight: number;
  rowHeaderWidth: number;
  showGroupPanel: boolean;
  groupPanelHeight: number;
}

/**
 * Builds and owns the static DOM scaffold using a single-scroller model:
 * one scroll container holds everything, so the native scrollbars span the whole
 * grid. The data cells scroll normally; the column header, row header, and
 * top-left corner are `position: sticky` panels that the browser keeps pinned on
 * the compositor as the canvas scrolls (header pins vertically, row header
 * horizontally, corner both) — no per-frame JS, so they never flicker. A gutter
 * (rowHeaderWidth × headerHeight) is reserved at the top-left so the cells start
 * past the headers.
 */
export class ViewportRenderer {
  readonly viewport: HTMLElement;
  readonly canvas: HTMLElement;
  readonly cells: HTMLElement;
  readonly mergeLayer: HTMLElement;
  readonly headerInner: HTMLElement;
  readonly rowHeaderInner: HTMLElement;
  readonly gutterLeft: number;
  readonly gutterTop: number;
  /** Host bar for the grouping panel, present only when it is enabled. */
  readonly groupPanel?: HTMLElement;

  // Pinned bands. Each is a sticky panel the browser keeps on the compositor:
  // frozen columns pin left, frozen rows pin top, and the corner pins both.
  readonly frozenCols: HTMLElement;
  readonly frozenColsHeader: HTMLElement;
  readonly frozenRows: HTMLElement;
  readonly frozenRowsHeader: HTMLElement;
  readonly frozenCorner: HTMLElement;

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

    // Spanning cells paint on top of the normal rows, so their layer lives inside
    // the cells container and is added last.
    this.mergeLayer = createEl('div', 'apg-merge-layer');
    this.cells.appendChild(this.mergeLayer);

    this.headerInner = createEl('div', 'apg-header-inner');
    this.headerInner.style.marginLeft = `${this.gutterLeft}px`;
    this.headerInner.style.height = `${this.gutterTop}px`;
    this.headerInner.style.display = config.showColumnHeader ? '' : 'none';

    this.rowHeaderInner = createEl('div', 'apg-rowheader-inner');
    this.rowHeaderInner.style.marginTop = `${this.gutterTop}px`;
    this.rowHeaderInner.style.width = `${this.gutterLeft}px`;
    this.rowHeaderInner.style.display = config.showRowHeader ? '' : 'none';

    this.corner = createEl('div', 'apg-corner');
    this.corner.style.width = `${this.gutterLeft}px`;
    this.corner.style.height = `${this.gutterTop}px`;
    this.corner.style.display = config.showColumnHeader && config.showRowHeader ? '' : 'none';

    // Frozen bands start hidden; Grid sizes and shows them when a freeze is set.
    this.frozenCols = createEl('div', 'apg-frozen-cols');
    this.frozenCols.style.left = `${this.gutterLeft}px`;
    this.frozenCols.style.marginTop = `${this.gutterTop}px`;

    this.frozenColsHeader = createEl('div', 'apg-frozen-cols-header');
    this.frozenColsHeader.style.left = `${this.gutterLeft}px`;
    this.frozenColsHeader.style.marginLeft = `${this.gutterLeft}px`;
    this.frozenColsHeader.style.height = `${this.gutterTop}px`;

    this.frozenRows = createEl('div', 'apg-frozen-rows');
    this.frozenRows.style.top = `${this.gutterTop}px`;
    this.frozenRows.style.marginLeft = `${this.gutterLeft}px`;

    this.frozenRowsHeader = createEl('div', 'apg-frozen-rows-header');
    this.frozenRowsHeader.style.top = `${this.gutterTop}px`;
    this.frozenRowsHeader.style.width = `${this.gutterLeft}px`;

    this.frozenCorner = createEl('div', 'apg-frozen-corner');
    this.frozenCorner.style.top = `${this.gutterTop}px`;
    this.frozenCorner.style.left = `${this.gutterLeft}px`;

    for (const el of [
      this.frozenCols,
      this.frozenColsHeader,
      this.frozenRows,
      this.frozenRowsHeader,
      this.frozenCorner,
    ]) {
      el.style.display = 'none';
    }

    this.canvas.append(
      this.cells,
      this.frozenCols,
      this.frozenRows,
      this.headerInner,
      this.rowHeaderInner,
      this.frozenColsHeader,
      this.frozenRowsHeader,
      this.corner,
      this.frozenCorner,
    );
    this.viewport.appendChild(this.canvas);

    if (config.showGroupPanel) {
      // A bar above the scroll area; the viewport starts below it.
      const panel = createEl('div', 'apg-grouppanel');
      panel.style.height = `${config.groupPanelHeight}px`;
      this.viewport.style.top = `${config.groupPanelHeight}px`;
      host.appendChild(panel);
      this.groupPanel = panel;
    }

    host.appendChild(this.viewport);
  }

  resize(totalWidth: number, totalHeight: number): void {
    this.canvas.style.width = `${this.gutterLeft + totalWidth}px`;
    this.canvas.style.height = `${this.gutterTop + totalHeight}px`;
    this.headerInner.style.width = `${totalWidth}px`;
    this.rowHeaderInner.style.height = `${totalHeight}px`;
    this.frozenCols.style.height = `${totalHeight}px`;
    this.frozenRows.style.width = `${totalWidth}px`;
  }

  /** Size and show/hide the frozen bands for the current freeze counts. */
  setFrozen(colsWidth: number, rowsHeight: number): void {
    const show = (el: HTMLElement, on: boolean): void => {
      el.style.display = on ? '' : 'none';
    };
    show(this.frozenCols, colsWidth > 0);
    show(this.frozenColsHeader, colsWidth > 0 && this.gutterTop > 0);
    show(this.frozenRows, rowsHeight > 0);
    show(this.frozenRowsHeader, rowsHeight > 0 && this.gutterLeft > 0);
    show(this.frozenCorner, colsWidth > 0 && rowsHeight > 0);

    this.frozenCols.style.width = `${colsWidth}px`;
    this.frozenColsHeader.style.width = `${colsWidth}px`;
    this.frozenRows.style.height = `${rowsHeight}px`;
    this.frozenRowsHeader.style.height = `${rowsHeight}px`;
    this.frozenCorner.style.width = `${colsWidth}px`;
    this.frozenCorner.style.height = `${rowsHeight}px`;
  }

  dispose(): void {
    this.groupPanel?.remove();
    this.viewport.remove();
    this.host.classList.remove('apg');
  }
}
