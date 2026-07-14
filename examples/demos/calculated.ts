import { Grid } from '../../src';
import { makeSales, SalesRow } from '../data';
import { Demo } from './types';

export const calculated: Demo = {
  id: 'calculated',
  title: 'Calculated columns',
  tagline: 'Columns with a valueGetter compute from the row and stay read-only.',
  mount(host) {
    const gridHost = document.createElement('div');
    gridHost.className = 'apg-demo-grid';
    host.appendChild(gridHost);

    const grid = new Grid(gridHost, {
      columns: [
        { binding: 'product', header: 'Product', width: 140 },
        { binding: 'sales', header: 'Sales', width: 110, dataType: 'Number', editable: true },
        { binding: 'expenses', header: 'Expenses', width: 110, dataType: 'Number', editable: true },
        {
          header: 'Profit',
          width: 110,
          dataType: 'Number',
          valueGetter: (r) => (r as SalesRow).sales - (r as SalesRow).expenses,
        },
        {
          header: 'Margin',
          width: 90,
          dataType: 'Number',
          valueGetter: (r) => {
            const row = r as SalesRow;
            return row.sales ? Math.round((1 - row.expenses / row.sales) * 100) : 0;
          },
          valueFormatter: (v) => `${v}%`,
        },
      ],
      itemsSource: makeSales(2000),
    });

    return {
    grid,
    dispose: () => {
      grid.dispose();
      gridHost.remove();
    },
  };
  },
};
