import { Grid } from '../../src';
import { makeSales, SalesRow } from '../data';
import { Demo } from './types';

const money = (v: unknown): string => (v == null ? '' : `$${Number(v).toLocaleString()}`);

export const conditionalStyling: Demo = {
  id: 'conditional-styling',
  title: 'Conditional styling',
  tagline: 'Style cells and rows from their values with cellStyle, cellClassRules, and rowClass.',
  mount(host) {
    const gridHost = document.createElement('div');
    gridHost.className = 'apg-demo-grid';
    host.appendChild(gridHost);

    const grid = new Grid(gridHost, {
      columns: [
        { binding: 'id', header: 'ID', width: 60, dataType: 'Number' },
        { binding: 'product', header: 'Product', width: 120 },
        { binding: 'country', header: 'Country', width: 120 },
        {
          binding: 'sales',
          header: 'Sales',
          width: 130,
          dataType: 'Number',
          valueFormatter: money,
          // Inline style straight from the value: bigger sales get greener.
          cellStyle: ({ value }) => {
            const n = Number(value);
            if (n >= 8000) return { backgroundColor: '#d7f2dd', fontWeight: '600' };
            if (n >= 5000) return { backgroundColor: '#eafaef' };
            return null;
          },
        },
        {
          binding: 'expenses',
          header: 'Expenses',
          width: 130,
          dataType: 'Number',
          valueFormatter: money,
          // Class rules: pick a class per threshold. Editing re-evaluates them.
          cellClassRules: {
            'demo-cell-high': ({ value }) => Number(value) >= 4000,
            'demo-cell-low': ({ value }) => Number(value) < 1000,
          },
        },
        {
          binding: 'margin',
          header: 'Margin',
          width: 120,
          dataType: 'Number',
          valueGetter: (r) => (r as SalesRow).sales - (r as SalesRow).expenses,
          valueFormatter: money,
          // Negative margins in red, positive in green — a classic diff column.
          cellClass: ({ value }) => (Number(value) < 0 ? 'demo-neg' : 'demo-pos'),
        },
        { binding: 'active', header: 'Active', width: 80, dataType: 'Boolean' },
      ],
      itemsSource: makeSales(500),
      // Row-level: tint rows for inactive accounts.
      rowClass: ({ item }) => ((item as SalesRow).active ? '' : 'demo-row-inactive'),
    });

    return () => {
      grid.dispose();
      gridHost.remove();
    };
  },
};
