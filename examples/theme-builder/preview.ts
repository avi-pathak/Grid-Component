import { Grid } from '@avi-pathak/apgrid';
import type { ThemeParams } from '@avi-pathak/apgrid/theming';
import { applyTheme } from '@avi-pathak/apgrid/theming';
import { makeSales } from '../data';

// A representative grid that exercises the tokens a theme touches: striped rows,
// a boolean (checkbox) column, number formatting, a frozen column, grouping (so
// group-header rows show), and filterable headers (so the filter dialog — a
// body-mounted overlay — can be opened to check overlay theming).

const money = (v: unknown): string => (v == null ? '' : `$${Number(v).toLocaleString()}`);

export interface PreviewHandle {
  /** Re-theme the preview and re-apply density. */
  update(params: ThemeParams): void;
  dispose(): void;
}

export function mountPreview(host: HTMLElement): PreviewHandle {
  const gridHost = document.createElement('div');
  gridHost.className = 'tb-preview-grid';
  host.appendChild(gridHost);

  const grid = new Grid(gridHost, {
    groupPanel: true,
    frozenColumns: 1,
    allowFiltering: true,
    columns: [
      { binding: 'country', header: 'Country', width: 130 },
      { binding: 'product', header: 'Product', width: 120 },
      {
        binding: 'sales',
        header: 'Sales',
        width: 120,
        dataType: 'Number',
        aggregate: 'sum',
        valueFormatter: money,
      },
      {
        binding: 'expenses',
        header: 'Expenses',
        width: 120,
        dataType: 'Number',
        aggregate: 'sum',
        valueFormatter: money,
      },
      { binding: 'active', header: 'Active', width: 90, dataType: 'Boolean' },
      { binding: 'joined', header: 'Joined', width: 120, dataType: 'Date' },
    ],
    itemsSource: makeSales(400),
  });
  grid.groupBy('country');

  // Apply to the grid host (which declares its own tokens, so inline props on it
  // win) and to <body> (so the body-mounted overlays — filter dialog, context
  // menu — inherit the same theme). Only apg elements read `--apg-*`, so writing
  // to <body> affects nothing else on the page.
  return {
    update(params) {
      applyTheme(gridHost, params);
      applyTheme(document.body, params);
      grid.setGeometry({ rowHeight: params.rowHeight, headerHeight: params.headerHeight });
    },
    dispose() {
      grid.dispose();
      gridHost.remove();
    },
  };
}
