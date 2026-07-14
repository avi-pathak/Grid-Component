import { Grid } from '../../src';
import { makeSales } from '../data';
import { Demo } from './types';

export const virtualization: Demo = {
  id: 'virtualization',
  title: 'A million rows',
  tagline: 'Dual-axis virtualization keeps the DOM tiny no matter how big the data is.',
  mount(host) {
    const gridHost = document.createElement('div');
    gridHost.className = 'apg-demo-grid';
    host.appendChild(gridHost);

    const data = makeSales(1_000_000);
    const grid = new Grid(gridHost, {
      columns: [
        { binding: 'id', header: 'ID', width: 80, dataType: 'Number' },
        { binding: 'product', header: 'Product', width: 130 },
        { binding: 'country', header: 'Country', width: 130 },
        { binding: 'sales', header: 'Sales', width: 110, dataType: 'Number' },
        { binding: 'expenses', header: 'Expenses', width: 110, dataType: 'Number' },
        { binding: 'active', header: 'Active', width: 90, dataType: 'Boolean' },
        { binding: 'joined', header: 'Joined', width: 130, dataType: 'Date' },
      ],
      itemsSource: data,
    });

    // Report how few rows are actually in the DOM while scrolling.
    const badge = document.createElement('div');
    badge.className = 'apg-demo-badge';
    host.appendChild(badge);
    const update = () => {
      const rows = gridHost.querySelectorAll('.apg-row').length;
      badge.textContent = `${data.length.toLocaleString()} rows · ${rows} in the DOM`;
    };
    update();
    const off = grid.on('scrollChanged', update);

    return {
    grid,
    dispose: () => {
      off();
      grid.dispose();
      gridHost.remove();
      badge.remove();
    },
  };
  },
};
