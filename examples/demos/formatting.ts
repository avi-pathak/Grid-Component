import { Grid } from '@avi-pathak/apgrid';
import { makeSales, SalesRow } from '../data';
import { Demo } from './types';

export const formatting: Demo = {
  id: 'formatting',
  title: 'Number & date formats',
  tagline:
    'Declare an Excel-style `format` string on the column — currency, percent, thousands, dates — instead of writing a formatter function.',
  mount(host) {
    const gridHost = document.createElement('div');
    gridHost.className = 'apg-demo-grid';
    host.appendChild(gridHost);

    const grid = new Grid(gridHost, {
      locale: 'en-US',
      currency: 'USD',
      columns: [
        { binding: 'id', header: 'ID', width: 70, dataType: 'Number', format: 'n0' },
        { binding: 'product', header: 'Product', width: 120 },
        {
          binding: 'sales',
          header: 'Sales',
          width: 130,
          dataType: 'Number',
          format: '$#,##0',
          aggregate: 'sum',
        },
        {
          binding: 'expenses',
          header: 'Expenses',
          width: 130,
          dataType: 'Number',
          format: '$#,##0.00',
          aggregate: 'sum',
        },
        {
          header: 'Margin',
          width: 100,
          dataType: 'Number',
          // Calculated column: profit margin, formatted as a percentage.
          valueGetter: (r) => {
            const row = r as SalesRow;
            return row.sales ? (row.sales - row.expenses) / row.sales : 0;
          },
          format: '0.0%',
        },
        {
          binding: 'joined',
          header: 'Joined',
          width: 150,
          dataType: 'Date',
          format: 'MMM d, yyyy',
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
