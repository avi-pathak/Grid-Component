import { Grid } from '@avi-pathak/apgrid';
import { makeSales, SalesRow } from '../data';
import { Demo } from './types';

export const validation: Demo = {
  id: 'validation',
  title: 'Validation',
  tagline: 'Event-based (cellEditEnding.stayInEditMode) and CollectionView-style (getError).',
  mount(host) {
    const hint = document.createElement('p');
    hint.className = 'apg-demo-readout';
    hint.style.margin = '0 0 12px';
    hint.textContent =
      'Sales is validated with getError: try a negative number. Expenses is validated with ' +
      'a cellEditEnding handler: try a value greater than that row’s Sales. Either way the ' +
      'editor stays open with a red border and a tooltip explaining why, instead of silently ' +
      'reverting — fix the value and commit again.';
    host.appendChild(hint);

    const gridHost = document.createElement('div');
    gridHost.className = 'apg-demo-grid';
    host.appendChild(gridHost);

    const columns = [
      { binding: 'id', header: 'ID', width: 70, dataType: 'Number' as const },
      { binding: 'product', header: 'Product', width: 150, editable: true },
      { binding: 'country', header: 'Country', width: 140, editable: true },
      {
        binding: 'sales',
        header: 'Sales',
        width: 120,
        dataType: 'Number' as const,
        editable: true,
      },
      {
        binding: 'expenses',
        header: 'Expenses',
        width: 120,
        dataType: 'Number' as const,
        editable: true,
      },
    ];
    const expensesCol = columns.findIndex((c) => c.binding === 'expenses');

    const grid = new Grid(gridHost, {
      columns,
      itemsSource: makeSales(500),
      // CollectionView-style: `parsing` tells a coercion failure (typed text
      // that couldn't become a number) apart from a value that parsed fine
      // but breaks a business rule.
      getError: (ctx, parsing) => {
        if (ctx.column.binding !== 'sales') return null;
        if (parsing) return 'Sales must be a number';
        return typeof ctx.value === 'number' && ctx.value < 0 ? 'Sales cannot be negative' : null;
      },
    });

    // Event-based: a cross-field rule (Expenses vs. this row's Sales) that
    // getError alone can't express, since getError only sees one field at a time.
    grid.on('cellEditEnding', (e) => {
      if (e.col !== expensesCol) return;
      const row = grid.collectionView.items[e.row] as SalesRow;
      if (typeof e.value === 'number' && e.value > row.sales) {
        e.cancel = true;
        e.stayInEditMode = true;
        e.errorMessage = `Expenses can't exceed this row's Sales ($${row.sales.toLocaleString()})`;
      }
    });

    return {
      grid,
      dispose: () => {
        grid.dispose();
        hint.remove();
        gridHost.remove();
      },
    };
  },
};
